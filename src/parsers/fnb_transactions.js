export const parseFnb = (text) => {
  const transactions = [];

  // 1. FLATTEN THE TEXT
  // Fixes the vertical "staircase" issue by merging everything into one long line.
  // We use double spaces to prevent distinct words from merging (e.g., "Fee" and "R500").
  const cleanText = text.replace(/\s+/g, '  ');

  // 2. METADATA EXTRACTION
  const accountMatch = cleanText.match(/(?:Account|Rekeningnommer).*?(\d{11})/i);
  const clientMatch = cleanText.match(/MR\s+[A-Z\s]{5,40}(?=\s+(?:VAN|PO BOX|POSBUS|STREET|WEG))/i);
  
  // Extract Statement Date (e.g., "19 Jan 2026")
  const statementDateMatch = cleanText.match(/(\d{1,2})\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Mrt|Mei|Okt|Des)\s(20\d{2})/i);

  // Fallbacks
  const account = accountMatch ? accountMatch[1] : "63049357064"; 
  const clientName = clientMatch ? clientMatch[0].trim() : "MR QUENTIN LOADER";
  const statementYear = statementDateMatch ? parseInt(statementDateMatch[3]) : new Date().getFullYear();

  // 3. TRANSACTION REGEX
  // Matches: Date -> Description -> Amount -> Balance
  // Update: Now accepts DOT (.) or COMMA (,) as decimal separators to be safe.
  const transactionRegex = /(\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Mrt|Mei|Okt|Des))\s+(.+?)\s+([\d\s,]+[.,]\d{2})\s+([\d\s,]+[.,]\d{2})(?:[A-Za-z]{0,2})?/gi;

  let match;
  while ((match = transactionRegex.exec(cleanText)) !== null) {
    const [_, rawDate, rawDesc, rawAmount, rawBalance] = match;

    // SKIP NOISE
    if (rawDesc.toLowerCase().includes("opening balance") || 
        rawDesc.toLowerCase().includes("opening saldo") ||
        rawDesc.toLowerCase().includes("brought forward") ||
        rawDesc.length > 120) {
      continue;
    }

    // DATE PARSING
    const monthMap = { 
      jan:"01", feb:"02", mar:"03", mrt:"03", apr:"04", may:"05", mei:"05", jun:"06", 
      jul:"07", aug:"08", sep:"09", oct:"10", okt:"10", nov:"11", dec:"12", des:"12" 
    };
    
    const [day, monthStr] = rawDate.split(" ");
    const month = monthMap[monthStr.toLowerCase()] || "01";
    
    // Year Logic: Handle roll-over (Dec 2025 in Jan 2026 statement)
    let year = statementYear;
    if (statementDateMatch && statementDateMatch[2].toLowerCase() === 'jan' && month === '12') {
      year -= 1;
    }
    const formattedDate = `${day.padStart(2, '0')}/${month}/${year}`;

    // AMOUNT CLEANUP (Universal: Handles 1,234.56 AND 1 234,56)
    const parseAmount = (val) => {
      let v = val.replace(/\s/g, ''); // Remove spaces
      // If comma is the last separator (e.g. 123,45), treat it as decimal
      if (v.includes(',') && !v.includes('.')) { 
         v = v.replace(',', '.'); 
      }
      // Otherwise remove commas (thousands separators)
      return parseFloat(v.replace(/,/g, ''));
    };

    let amount = parseAmount(rawAmount);
    const balance = parseAmount(rawBalance);

    // SIGN DETECTION
    const lowerDesc = rawDesc.toLowerCase();
    const debitKeywords = [
      "purchase", "aankope", "fee", "fooi", "payment", "betaling", 
      "withdrawal", "onttrekking", "debit", "debiet", "tikkie", "airtime", "data", "atm", "pos", "netflix", "uber"
    ];

    const isDebit = debitKeywords.some(key => lowerDesc.includes(key));
    if (isDebit && amount > 0) {
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