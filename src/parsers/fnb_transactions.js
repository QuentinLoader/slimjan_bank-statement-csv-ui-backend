export const parseFnb = (text) => {
  const transactions = [];
  
  // 1. CLEANING & NORMALIZATION
  // Replace multiple newlines/spaces with single spaces to fix the "staircase" extraction issue
  const normalizedText = text.replace(/\s+/g, ' ');
  const headerArea = normalizedText.substring(0, 2000);

  // 2. METADATA EXTRACTION (Using flexible lookaheads)
  const accountMatch = normalizedText.match(/(?:Account:|Rekeningnommer)\s*(\d{11})/i);
  const clientMatch = normalizedText.match(/MR\s+([A-Z\s]{5,30})(?=\s+(?:VAN DER WALT|PO BOX|POSBUS))/i);
  const refMatch = normalizedText.match(/Referance Number:\s*([A-Z0-9]+)/i);
  const statementDateMatch = normalizedText.match(/\d{2}\s(?:JAN|FEB|MRT|APR|MEI|JUN|JUL|AUG|SEP|OKT|NOV|DES)\s(202\d)/i);

  const account = accountMatch ? accountMatch[1] : "Check Header";
  const uniqueDocNo = refMatch ? refMatch[1] : "Check Header";
  const clientName = clientMatch ? clientMatch[1].trim() : "MR QUENTIN LOADER";
  const statementYear = statementDateMatch ? parseInt(statementDateMatch[1]) : 2026;

  // 3. TRANSACTION EXTRACTION
  // FNB Pattern: Date (DD MMM) -> Description -> Amount -> Balance
  // Afrikaans Months: Jan, Feb, Mrt, Apr, Mei, Jun, Jul, Aug, Sep, Okt, Nov, Des
  const transactionRegex = /(\d{2}\s(?:Jan|Feb|Mrt|Mar|Apr|Mei|May|Jun|Jul|Aug|Sep|Okt|Oct|Nov|Des|Dec))\s+(.+?)\s+([\d\s,]+\.\d{2}|[\d\s]+\,\d{2})\s+([\d\s,]+\.\d{2}|[\d\s]+\,\d{2})\s?(Kt|Dt)?/gi;

  let match;
  while ((match = transactionRegex.exec(normalizedText)) !== null) {
    const [fullMatch, rawDate, rawDesc, rawAmount, rawBalance, type] = match;

    // Skip summary lines
    if (rawDesc.toLowerCase().includes("saldo") || rawDesc.toLowerCase().includes("omset")) continue;

    // Handle Month/Year
    const monthMap = { jan:"01", feb:"02", mrt:"03", mar:"03", apr:"04", mei:"05", may:"05", jun:"06", jul:"07", aug:"08", sep:"09", okt:"10", oct:"10", nov:"11", des:"12", dec:"12" };
    const [day, monthStr] = rawDate.split(" ");
    let year = statementYear;
    if (statementDateMatch && statementDateMatch[0].includes("JAN") && monthStr.toLowerCase() === "des") {
      year = statementYear - 1;
    }
    const formattedDate = `${day}/${monthMap[monthStr.toLowerCase()]}/${year}`;

    // Clean Numbers (Handles both "1 234,56" and "1,234.56")
    const cleanNum = (str) => {
      let cleaned = str.replace(/\s/g, ''); // Remove spaces
      if (cleaned.includes(',') && cleaned.includes('.')) cleaned = cleaned.replace(',', ''); // Standard US format
      else if (cleaned.includes(',')) cleaned = cleaned.replace(',', '.'); // AFR format
      return parseFloat(cleaned);
    };

    let amount = cleanNum(rawAmount);
    const balance = cleanNum(rawBalance);

    // Direction Logic: "Dt" is Debit (Negative)
    if (type === "Dt" && amount > 0) amount = -amount;

    transactions.push({
      date: formattedDate,
      description: rawDesc.trim().replace(/"/g, '""'),
      amount,
      balance,
      account,
      clientName,
      uniqueDocNo,
      approved: true
    });
  }

  return transactions;
};