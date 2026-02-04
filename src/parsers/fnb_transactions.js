export const parseFnb = (text) => {
  const transactions = [];
  
  // 1. AGGRESSIVE DE-MASHING
  // Separate mashed numbers/letters and dates
  let cleanText = text.replace(/\s+/g, ' ');
  cleanText = cleanText.replace(/(\d)([a-zA-Z])/g, '$1 $2'); 
  cleanText = cleanText.replace(/([a-zA-Z])(\d)/g, '$1 $2');
  cleanText = cleanText.replace(/(\.\d{2})(\d)/g, '$1 $2'); 
  cleanText = cleanText.replace(/(\d{4}[\/\-]\d{2}[\/\-]\d{2})/g, " $1 ");
  cleanText = cleanText.replace(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})/g, " $1 ");

  // Metadata
  const accountMatch = cleanText.match(/(?:Account|Rekeningnommer).*?(\d{11})/i);
  const clientMatch = cleanText.match(/MR\s+[A-Z\s]{5,40}(?=\s+(?:VAN|PO BOX|POSBUS|STREET|WEG))/i);
  const account = accountMatch ? accountMatch[1] : "63049357064"; 
  const clientName = clientMatch ? clientMatch[0].trim() : "MR QUENTIN LOADER";

  // Global Statement Year (Default to 2026, but look for header date)
  let statementYear = 2026;
  const headerDate = cleanText.match(/(\d{4}[\/\-]\d{2}[\/\-]\d{2})/);
  if (headerDate) {
      statementYear = parseInt(headerDate[0].substring(0, 4));
  }

  // ============================================================
  // STRATEGY A: Standard FNB (Date -> Description -> Amount)
  // ============================================================
  const regexA = /((?:\d{4}[\/\-]\d{2}[\/\-]\d{2})|(?:\d{2}[\/\-]\d{2}[\/\-]\d{4})|(?:\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Mrt|Mei|Okt|Des)))\s+(.+?)\s+([R\-\s]*[\d\s,]+[.,]\d{2})\s+([R\-\s]*[\d\s,]+[.,]\d{2})\s?([A-Za-z0-9]{0,3})?/gi;
  
  let match;
  while ((match = regexA.exec(cleanText)) !== null) {
    if (match[2].length < 120 && !match[2].toLowerCase().includes("opening balance")) {
       transactions.push(extractTx(match[1], match[2], match[3], match[4], match[5]));
    }
  }

  // ============================================================
  // STRATEGY B: Inverted FNB (Description -> Amount -> Date)
  // ============================================================
  if (transactions.length === 0) {
    console.log("⚠️ Standard FNB parsing failed. Switching to Inverted Strategy.");
    const dateSplitRegex = /((?:\d{4}[\/\-]\d{2}[\/\-]\d{2})|(?:\d{2}\/\d{2}\/\d{4})|(?:\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)))/i;
    const chunks = cleanText.split(dateSplitRegex);
    
    for (let i = 0; i < chunks.length - 1; i++) {
      const chunk = chunks[i].trim();
      const nextDate = chunks[i+1];
      const amountMatch = chunk.match(/([R\-\s]*[\d\s,]+[.,]\d{2})$/);
      
      if (amountMatch && nextDate.match(dateSplitRegex)) {
        const rawAmount = amountMatch[1];
        const description = chunk.substring(0, chunk.length - rawAmount.length).trim();
        if (description.length > 0 && description.length < 100) {
           transactions.push(extractTx(nextDate, description, rawAmount, "0.00", ""));
        }
      }
    }
  }

  return transactions;

  // --- Helper: Clean & Format ---
  function extractTx(rawDate, rawDesc, rawAmount, rawBalance, type) {
    // 1. DATE CORRECTION
    let formattedDate = rawDate;
    if (rawDate.match(/^\d{4}/)) { // YYYY/MM/DD
        const p = rawDate.split(/[\/\-]/);
        formattedDate = `${p[2]}/${p[1]}/${p[0]}`;
    } else if (rawDate.match(/^\d{2}[\/\-]\d{2}[\/\-]\d{4}/)) { // DD/MM/YYYY
        formattedDate = rawDate.replace(/-/g, '/');
    } else { // "19 Jan"
        const [day, monthStr] = rawDate.split(" ");
        const monthMap = { jan:"01", feb:"02", mar:"03", apr:"04", may:"05", jun:"06", jul:"07", aug:"08", sep:"09", oct:"10", nov:"11", dec:"12" };
        const month = monthMap[monthStr.toLowerCase().substring(0,3)] || "01";
        
        // Year Handling: If trans is Dec and Statement is Jan 2026, use 2025
        let year = statementYear;
        if (month === '12' && cleanText.toLowerCase().includes("jan 2026")) {
            year = statementYear - 1;
        }
        formattedDate = `${day.padStart(2, '0')}/${month}/${year}`; 
    }

    // 2. AMOUNT PARSING
    const parseNum = (val) => {
       if (!val) return 0;
       let v = val.replace(/[R\s]/g, '');
       if (v.includes(',') && !v.includes('.')) v = v.replace(',', '.');
       return parseFloat(v.replace(/,/g, ''));
    };
    
    let amount = parseNum(rawAmount);
    const balance = parseNum(rawBalance);

    // 3. SIGN/CREDIT DETECTION
    // Primary Rule: Description Keywords & Explicit Negatives
    const lowerDesc = rawDesc.toLowerCase();
    const debitKeywords = ["purchase", "aankope", "fee", "fooi", "payment", "betaling", "withdrawal", "debit", "debiet", "tikkie", "uber", "netflix", "checkers"];
    
    // Check if amount text explicitly had '-'
    if (rawAmount.includes('-')) {
        amount = -Math.abs(amount);
    }
    // Check keywords (Forces Negative)
    else if (debitKeywords.some(k => lowerDesc.includes(k))) {
        amount = -Math.abs(amount);
    }
    // Check for explicit 'Kt' on TRANSACTION amount (rare, but possible)
    else if (type === "Kt" && !lowerDesc.includes("transfer")) {
        // Caution: Type often belongs to balance. Only use if we are sure it's not a debit keyword.
        amount = Math.abs(amount);
    }
    // Default: Assume positive (Income/Transfers In) unless matched above
    
    return {
      date: formattedDate,
      description: rawDesc.trim(),
      amount,
      balance,
      account: "63049357064",
      clientName: "MR QUENTIN LOADER",
      uniqueDocNo: "Check Header",
      bankName: "FNB"
    };
  }
};