export const parseFnb = (text) => {
  const transactions = [];

  // 1. DE-MASHING ENGINE (Updated)
  let cleanText = text.replace(/\s+/g, ' ');
  // Split CamelCase (e.g., "DesPOS" -> "Des POS") - FIXES THE MERGED TRANSACTIONS
  cleanText = cleanText.replace(/([a-z])([A-Z])/g, '$1 $2');
  // Split Digit-Letter (e.g., "19Jan" -> "19 Jan")
  cleanText = cleanText.replace(/(\d)([a-zA-Z])/g, '$1 $2');
  cleanText = cleanText.replace(/([a-zA-Z])(\d)/g, '$1 $2');
  // Split mashed amounts (e.g., "100.00200.00" -> "100.00 200.00")
  cleanText = cleanText.replace(/(\.\d{2})(\d)/g, '$1 $2');
  // Normalize date delimiters
  cleanText = cleanText.replace(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/g, " $1/$2/$3 ");
  cleanText = cleanText.replace(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/g, " $1/$2/$3 ");

  // Metadata
  const accountMatch = cleanText.match(/(?:Account|Rekeningnommer).*?(\d{11})/i);
  const clientMatch = cleanText.match(/MR\s+[A-Z\s]{5,40}(?=\s+(?:VAN|PO BOX|POSBUS|STREET|WEG))/i);
  const account = accountMatch ? accountMatch[1] : "63049357064"; 
  const clientName = clientMatch ? clientMatch[0].trim() : "MR QUENTIN LOADER";

  // 2. SMART YEAR LOGIC
  // We find the "Statement Date" to use as the anchor.
  let statementDate = new Date(); // Default to today
  // Look for YYYY/MM/DD header date (e.g. 2026/01/19)
  const headerDateMatch = cleanText.match(/(\d{4})\/(\d{2})\/(\d{2})/);
  if (headerDateMatch) {
      statementDate = new Date(`${headerDateMatch[1]}-${headerDateMatch[2]}-${headerDateMatch[3]}`);
  }

  // 3. BLOCK SPLITTING
  // Regex for all date formats.
  const dateRegex = /((?:\d{4}\/\d{2}\/\d{2})|(?:\d{2}\/\d{2}\/\d{4})|(?:\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Mrt|Mei|Okt|Des)))/gi;
  const parts = cleanText.split(dateRegex);

  for (let i = 0; i < parts.length - 1; i++) {
    const potentialDate = parts[i].trim();
    const dataBlock = parts[i+1].trim(); 

    if (potentialDate.match(dateRegex) && potentialDate.length < 20) {
        
        // Extract Numbers (Last 2 are Amount & Balance)
        const moneyRegex = /([R\-\s]*[\d\s]+[.,]\d{2})(?!\d)/g;
        const allNumbers = dataBlock.match(moneyRegex);

        if (allNumbers && allNumbers.length >= 2) {
            const cleanNum = (val) => {
                let v = val.replace(/[R\s]/g, '');
                if (v.includes(',') && !v.includes('.')) v = v.replace(',', '.');
                return parseFloat(v.replace(/,/g, ''));
            };

            const rawAmount = allNumbers[allNumbers.length - 2];
            const rawBalance = allNumbers[allNumbers.length - 1];
            let amount = cleanNum(rawAmount);
            const balance = cleanNum(rawBalance);

            // Description Cleanup
            let description = dataBlock.split(rawAmount)[0].trim();
            // Remove leftover numbers at start (Fixes "7.50 15.28" issue)
            description = description.replace(/^[\d\s\.,]+/, '').trim();
            // Remove codes
            description = description.replace(/^(Kt|Dt|Dr|Cr)\s+/, '').trim();

            // DATE PARSING & YEAR CORRECTION
            let formattedDate = potentialDate;
            
            if (potentialDate.match(/[a-zA-Z]/)) { // "19 Jan"
                const [day, monthStr] = potentialDate.split(" ");
                const monthMap = { jan:"01", feb:"02", mar:"03", apr:"04", may:"05", jun:"06", jul:"07", aug:"08", sep:"09", oct:"10", nov:"11", dec:"12" };
                const monthStr3 = monthStr.toLowerCase().substring(0,3);
                const month = monthMap[monthStr3] || "01";
                
                // Logic: If Transaction Month > Statement Month (by a margin), it's previous year.
                // e.g. Trans Dec (12), Stmt Jan (01) -> Year = StmtYear - 1
                const stmtYear = statementDate.getFullYear();
                const stmtMonth = statementDate.getMonth() + 1;
                const transMonthInt = parseInt(month);

                let year = stmtYear;
                if (transMonthInt > stmtMonth + 1) { 
                    year = stmtYear - 1;
                }
                
                formattedDate = `${day.padStart(2, '0')}/${month}/${year}`;
            } else if (potentialDate.match(/^\d{4}/)) { // 2026/01/19
                const p = potentialDate.split('/');
                formattedDate = `${p[2]}/${p[1]}/${p[0]}`;
            }

            // SIGN CORRECTION
            const textAfterAmount = dataBlock.split(rawAmount)[1] || "";
            if (rawAmount.includes('-')) {
                amount = -Math.abs(amount); 
            } else if (textAfterAmount.toLowerCase().includes("dt")) {
                amount = -Math.abs(amount);
            } else if (textAfterAmount.toLowerCase().includes("kt")) {
                amount = Math.abs(amount); 
            } else {
                const debitKeywords = ["purchase", "fee", "payment", "debit", "withdrawal", "tikkie", "uber", "netflix"];
                if (debitKeywords.some(k => description.toLowerCase().includes(k))) {
                    amount = -Math.abs(amount);
                }
            }

            transactions.push({
                date: formattedDate,
                description: description.trim(),
                amount: amount,
                balance: balance,
                account: account,
                clientName: clientName,
                uniqueDocNo: "Check Header",
                bankName: "FNB"
            });
        }
        i++; // Skip next block (data)
    }
  }

  return transactions;
};