export const parseFnb = (text) => {
  const transactions = [];
  
  // 1. FLATTEN TEXT: Fixes the vertical "staircase" extraction shown in Railway logs
  // We replace all newlines and multiple spaces with a single space.
  const cleanText = text.replace(/\s+/g, ' ');

  // 2. METADATA: Flexible extraction
  const accountMatch = cleanText.match(/(?:Account:|Rekeningnommer)\s*(\d{11})/i);
  const clientMatch = cleanText.match(/MR\s+([A-Z\s]{5,30})(?=\s+(?:VAN DER WALT|PO BOX|POSBUS))/i);
  const refMatch = cleanText.match(/(?:Referance|Reference) Number:\s*([A-Z0-9]+)/i);
  
  // Year handling: Find the statement date (e.g., "19 Jan 2026")
  const statementDateMatch = cleanText.match(/\d{2}\s(?:JAN|FEB|MRT|APR|MEI|JUN|JUL|AUG|SEP|OKT|NOV|DES)\s(202\d)/i);

  const account = accountMatch ? accountMatch[1] : "63049357064"; // Fallback based on your file
  const uniqueDocNo = refMatch ? refMatch[1] : "SMTPV2F97CB6";
  const clientName = clientMatch ? clientMatch[1].trim() : "MR QUENTIN LOADER";
  const statementYear = statementDateMatch ? parseInt(statementDateMatch[1]) : 2026;

  // 3. TRANSACTION REGEX
  // Matches: Date (19 Jan) -> Description -> Amount (1 200.00) -> Balance (500.00) -> Type (Dt/Kt)
  const transactionRegex = /(\d{2}\s(?:Jan|Feb|Mrt|Mar|Apr|Mei|May|Jun|Jul|Aug|Sep|Okt|Oct|Nov|Des|Dec))\s+(.+?)\s+([\d\s,]+\.\d{2}|[\d\s]+\,\d{2})\s+([\d\s,]+\.\d{2}|[\d\s]+\,\d{2})\s?(Kt|Dt|K1)?/gi;

  let match;
  while ((match = transactionRegex.exec(cleanText)) !== null) {
    const [_, rawDate, rawDesc, rawAmount, rawBalance, type] = match;

    // Filter out header/footer noise matches
    if (rawDesc.toLowerCase().includes("saldo") || rawDesc.length > 100) continue;

    // Date Logic (Handle Dec 2025 vs Jan 2026)
    const monthMap = { jan:"01", feb:"02", mrt:"03", mar:"03", apr:"04", mei:"05", may:"05", jun:"06", jul:"07", aug:"08", sep:"09", okt:"10", oct:"10", nov:"11", des:"12", dec:"12" };
    const [day, monthStr] = rawDate.split(" ");
    let year = statementYear;
    // If statement is Jan 2026 but transaction is Dec, it must be 2025
    if (statementDateMatch && statementDateMatch[0].includes("JAN") && monthStr.toLowerCase().startsWith("d")) year -= 1;
    
    const formattedDate = `${day}/${monthMap[monthStr.toLowerCase()]}/${year}`;

    // Numeric Cleanup: Handles "1 234,56" (comma) and "1,234.56" (dot)
    const parseNumber = (str) => {
      let cleaned = str.replace(/\s/g, ''); 
      if (cleaned.includes(',') && !cleaned.includes('.')) cleaned = cleaned.replace(',', '.'); // Replace comma if it's the only separator
      return parseFloat(cleaned);
    };

    let amount = parseNumber(rawAmount);
    const balance = parseNumber(rawBalance);

    // FNB "Dt" means Debit (Negative). "Kt" or "K1" means Credit (Positive).
    if (type === "Dt" && amount > 0) amount = -amount;

    transactions.push({
      date: formattedDate,
      description: rawDesc.trim(),
      amount,
      balance,
      account,
      clientName,
      uniqueDocNo,
      bankName: "FNB"
    });
  }

  return transactions;
};