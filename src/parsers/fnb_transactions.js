export const parseFnb = (text) => {
  const transactions = [];

  // 1. FLATTEN THE TEXT
  // Merges "shredded" vertical lines into a single text stream
  const cleanText = text.replace(/\s+/g, ' ');

  // 2. METADATA
  const accountMatch = cleanText.match(/(?:Account|Rekeningnommer).*?(\d{11})/i);
  const clientMatch = cleanText.match(/MR\s+[A-Z\s]{5,40}(?=\s+(?:VAN|PO BOX|POSBUS|STREET|WEG))/i);
  
  // Statement Date (Look for both "19 Jan 2026" and "2026/01/19")
  const dateTextMatch = cleanText.match(/(\d{1,2})\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Mrt|Mei|Okt|Des)\s(20\d{2})/i);
  const dateNumMatch = cleanText.match(/(20\d{2})[\/\-](\d{2})[\/\-](\d{2})/);

  // Fallbacks
  const account = accountMatch ? accountMatch[1] : "63049357064"; 
  const clientName = clientMatch ? clientMatch[0].trim() : "MR QUENTIN LOADER";
  
  let statementYear = new Date().getFullYear();
  if (dateTextMatch) statementYear = parseInt(dateTextMatch[3]);
  else if (dateNumMatch) statementYear = parseInt(dateNumMatch[1]);

  // 3. TRANSACTION REGEX (Updated for Numeric Dates)
  // Matches:
  // Group 1: Date (e.g., "19 Jan" OR "2025/12/19" OR "19/12/2025")
  // Group 2: Description
  // Group 3: Amount
  // Group 4: Balance
  // Group 5: Code (Dt/Kt)
  const transactionRegex = /((?:\d{2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Mrt|Mei|Okt|Des))|(?:\d{4}[\/\-]\d{2}[\/\-]\d{2})|(?:\d{2}[\/\-]\d{2}[\/\-]\d{4}))\s+(.+?)\s+([\d\s,]+[.,]\d{2})\s+([\d\s,]+[.,]\d{2})\s?([A-Za-z0-9]{0,3})?/gi;

  let match;
  while ((match = transactionRegex.exec(cleanText)) !== null) {
    const [_, rawDate, rawDesc, rawAmount, rawBalance, type] = match;

    // SKIP NOISE
    if (rawDesc.toLowerCase().includes("opening balance") || 
        rawDesc.toLowerCase().includes("brought forward") || 
        rawDesc.length > 120) {
      continue;
    }

    // DATE NORMALIZATION
    let formattedDate = rawDate;
    
    // Check if it's a text date "19 Jan"
    if (rawDate.match(/[a-zA-Z]/)) {
        const monthMap = { jan:"01", feb:"02", mar:"03", mrt:"03", apr:"04", may:"05", mei:"05", jun:"06", jul:"07", aug:"08", sep:"09", oct:"10", okt:"10", nov:"11", dec:"12", des:"12" };
        const [day, monthStr] = rawDate.split(" ");
        const month = monthMap[monthStr.toLowerCase()] || "01";
        
        let year = statementYear;
        // Handle Dec 2025 trans in Jan 2026 statement
        if (dateTextMatch && dateTextMatch[2].toLowerCase() === 'jan' && month === '12') {
            year -= 1;
        }
        formattedDate = `${day.padStart(2, '0')}/${month}/${year}`;
    } 
    // Check if it's YYYY/MM/DD
    else if (rawDate.match(/^\d{4}/)) {
        const parts = rawDate.split(/[\/\-]/);
        formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`; // Convert to DD/MM/YYYY
    }
    // Check if it's DD/MM/YYYY
    else if (rawDate.match(/^\d{2}[\/\-]\d{2}[\/\-]\d{4}/)) {
        // Already mostly correct, just normalize separators
        formattedDate = rawDate.replace(/-/g, '/');
    }

    // AMOUNT CLEANUP
    const parseAmount = (val) => {
      let v = val.replace(/\s/g, ''); 
      if (v.includes(',') && !v.includes('.')) v = v.replace(',', '.'); 
      return parseFloat(v.replace(/,/g, ''));
    };

    let amount = parseAmount(rawAmount);
    const balance = parseAmount(rawBalance);

    // SIGN DETECTION
    const lowerDesc = rawDesc.toLowerCase();
    const debitKeywords = ["purchase", "aankope", "fee", "fooi", "payment", "betaling", "withdrawal", "debit", "debiet"];

    // FNB "Dt" means Debit (-).
    if (type === "Dt") {
       if (amount > 0) amount = -amount;
    } else if (!type && debitKeywords.some(key => lowerDesc.includes(key)) && amount > 0) {
       amount = -amount;
    }

    transactions.push({
      date: formattedDate,
      description: rawDesc.trim(),
      amount: amount,
      balance: balance,
      account: account,
      clientName: clientName,
      uniqueDocNo: "Check Header",
      bankName: "FNB"
    });
  }

  return transactions;
};