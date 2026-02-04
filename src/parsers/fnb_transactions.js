export const parseFnb = (text) => {
  const transactions = [];
  
  // 1. PRE-PROCESSING (Un-mash the text)
  // Ensure space around dates (e.g., "2025/12/19FNB" -> "2025/12/19 FNB")
  let cleanText = text.replace(/\s+/g, ' ');
  cleanText = cleanText.replace(/(\d{4}[\/\-]\d{2}[\/\-]\d{2})/g, " $1 "); 
  cleanText = cleanText.replace(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})/g, " $1 ");

  // Metadata
  const accountMatch = cleanText.match(/(?:Account|Rekeningnommer).*?(\d{11})/i);
  const clientMatch = cleanText.match(/MR\s+[A-Z\s]{5,40}(?=\s+(?:VAN|PO BOX|POSBUS|STREET|WEG))/i);
  const account = accountMatch ? accountMatch[1] : "63049357064"; 
  const clientName = clientMatch ? clientMatch[0].trim() : "MR QUENTIN LOADER";

  // ============================================================
  // STRATEGY A: Standard FNB (Date -> Description -> Amount)
  // ============================================================
  const regexA = /((?:\d{4}[\/\-]\d{2}[\/\-]\d{2})|(?:\d{2}[\/\-]\d{2}[\/\-]\d{4})|(?:\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Mrt|Mei|Okt|Des)))\s+(.+?)\s+([R\-\s]*[\d\s,]+[.,]\d{2})\s+([R\-\s]*[\d\s,]+[.,]\d{2})\s?([A-Za-z0-9]{0,3})?/gi;
  
  let match;
  while ((match = regexA.exec(cleanText)) !== null) {
    if (match[2].length < 100 && !match[2].toLowerCase().includes("opening balance")) {
       transactions.push(extractTx(match[1], match[2], match[3], match[4], match[5]));
    }
  }

  // ============================================================
  // STRATEGY B: Credit Card / Inverted (Description -> Amount -> Date)
  // Only run if Strategy A failed
  // ============================================================
  if (transactions.length === 0) {
    console.log("⚠️ Standard FNB parsing failed. Switching to Inverted Strategy (Desc -> Amt -> Date).");
    
    // Split text by Date Pattern (DD/MM/YYYY)
    // We look for the date at the END of the transaction
    const chunks = cleanText.split(/(\d{2}\/\d{2}\/\d{4})/);
    
    // Iterate chunks (Chunk i is text, Chunk i+1 is the date that followed it)
    for (let i = 0; i < chunks.length - 1; i += 2) {
      const descAndAmount = chunks[i].trim();
      const date = chunks[i+1];

      // Find the Amount at the very end of the text block
      // Look for: -R 179.00 or 179.00 at the end of string
      const amountMatch = descAndAmount.match(/([R\-\s]*[\d\s,]+[.,]\d{2})$/);
      
      if (amountMatch) {
        const rawAmount = amountMatch[1];
        const description = descAndAmount.substring(0, descAndAmount.length - rawAmount.length).trim();
        
        // Filter noise (headers/footers usually don't have amounts ending exactly before a date)
        if (description.length > 0 && description.length < 100) {
           transactions.push(extractTx(date, description, rawAmount, "0.00", ""));
        }
      }
    }
  }

  return transactions;

  // --- Helper Function to Clean & Format ---
  function extractTx(rawDate, rawDesc, rawAmount, rawBalance, type) {
    // Date Cleaning
    let formattedDate = rawDate;
    if (rawDate.match(/^\d{4}/)) {
        const p = rawDate.split(/[\/\-]/);
        formattedDate = `${p[2]}/${p[1]}/${p[0]}`;
    } else if (rawDate.match(/^\d{2}[\/\-]\d{2}[\/\-]\d{4}/)) {
        formattedDate = rawDate.replace(/-/g, '/');
    } else { // 19 Jan
        const [day, monthStr] = rawDate.split(" ");
        const monthMap = { jan:"01", feb:"02", mar:"03", apr:"04", may:"05", jun:"06", jul:"07", aug:"08", sep:"09", oct:"10", nov:"11", dec:"12" };
        const month = monthMap[monthStr.toLowerCase().substring(0,3)] || "01";
        formattedDate = `${day.padStart(2, '0')}/${month}/2026`; // Defaulting year for text dates
    }

    // Amount Cleaning
    const parseNum = (val) => {
       if (!val) return 0;
       let v = val.replace(/[R\s]/g, '');
       if (v.includes(',') && !v.includes('.')) v = v.replace(',', '.');
       return parseFloat(v.replace(/,/g, ''));
    };
    
    let amount = parseNum(rawAmount);
    const balance = parseNum(rawBalance);

    // Sign Detection
    const debitKeywords = ["purchase", "fee", "payment", "withdrawal", "debit"];
    if ((type === "Dt" || rawAmount.includes('-')) && amount > 0) amount = -amount;
    else if (debitKeywords.some(k => rawDesc.toLowerCase().includes(k)) && amount > 0) amount = -amount;

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