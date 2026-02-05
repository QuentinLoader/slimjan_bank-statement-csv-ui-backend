export const parseFnb = (text) => {
  const transactions = [];

  // 1. DE-MASHING & CLEANUP
  let cleanText = text.replace(/\s+/g, ' ');
  // Split CamelCase
  cleanText = cleanText.replace(/([a-z])([A-Z])/g, '$1 $2');
  // Split Letters/Numbers
  cleanText = cleanText.replace(/(\d)([a-zA-Z])/g, '$1 $2');
  cleanText = cleanText.replace(/([a-zA-Z])(\d)/g, '$1 $2');
  // Split mashed amounts
  cleanText = cleanText.replace(/(\.\d{2})(\d)/g, '$1 $2');
  // Normalize date delimiters
  cleanText = cleanText.replace(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/g, " $1/$2/$3 ");
  cleanText = cleanText.replace(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/g, " $1/$2/$3 ");

  // Metadata
  const accountMatch = cleanText.match(/(?:Account|Rekeningnommer).*?(\d{11})/i);
  const clientMatch = cleanText.match(/THE DIRECTOR|MR\s+[A-Z\s]{5,40}/i);
  const account = accountMatch ? accountMatch[1] : "Check Header"; 
  const clientName = clientMatch ? clientMatch[0].trim() : "Client Name";

  // Year Logic
  let statementDate = new Date();
  const headerDateMatch = cleanText.match(/(\d{4})\/(\d{2})\/(\d{2})/);
  if (headerDateMatch) {
      statementDate = new Date(`${headerDateMatch[1]}-${headerDateMatch[2]}-${headerDateMatch[3]}`);
  }

  // 2. BLOCK SPLITTING STRATEGY
  // We split by Date.
  const dateRegex = /((?:\d{4}\/\d{2}\/\d{2})|(?:\d{2}\/\d{2}\/\d{4})|(?:\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Mrt|Mei|Okt|Des)))/gi;
  const parts = cleanText.split(dateRegex);

  // "Carry-Over" Description Buffer
  // If we find text at the end of Block A that belongs to Block B, we store it here.
  let descriptionBuffer = "";

  // Loop through parts: [Text_Before_Date] -> [Date] -> [Text_After_Date]
  for (let i = 0; i < parts.length - 1; i++) {
    const potentialDate = parts[i].trim();
    
    // Check if valid date
    if (potentialDate.match(dateRegex) && potentialDate.length < 20) {
        const dataBlock = parts[i+1].trim(); 
        
        // Header Guard
        const lowerBlock = dataBlock.toLowerCase();
        if (lowerBlock.includes("opening balance") || 
            lowerBlock.includes("brought forward") || 
            lowerBlock.includes("current account") ||
            lowerBlock.includes("statement period")) { 
            i++; descriptionBuffer = ""; continue;
        }

        // 3. NUMBER EXTRACTION
        // Match numbers, optionally with Cr/Dr/Dt suffix
        const moneyRegex = /([R\-\s]*[\d\s]+[.,]\d{2}(?:Cr|Dr|Dt)?)(?!\d)/gi;
        const allNumbers = dataBlock.match(moneyRegex);

        if (allNumbers && allNumbers.length >= 2) {
            const cleanNum = (val) => {
                let v = val.replace(/[R\s]/g, '');
                // Keep Cr/Dr markers for logic, strip them for parsing
                let num = parseFloat(v.replace(/,/g, '').replace(/(Cr|Dr|Dt)/yi, ''));
                return num;
            };

            // STRICT RULE: Last number is Balance. Second Last is Amount.
            const rawAmount = allNumbers[allNumbers.length - 2];
            const rawBalance = allNumbers[allNumbers.length - 1];
            
            let amount = cleanNum(rawAmount);
            const balance = cleanNum(rawBalance);

            // 4. DESCRIPTION LOGIC (The "Sandwich" Fix)
            // Description = (Buffer from previous block) + (Text before Amount in current block)
            const textBeforeAmount = dataBlock.split(rawAmount)[0].trim();
            
            // Text AFTER balance? This belongs to the NEXT transaction (Buffer)
            const textAfterBalance = dataBlock.split(rawBalance)[1] || "";
            
            // Construct full description
            let description = (descriptionBuffer + " " + textBeforeAmount).trim();
            
            // Update Buffer for NEXT loop
            descriptionBuffer = textAfterBalance.trim();

            // CLEANUP: Orphan Scrubber
            // Remove stray digits/dots from start of description
            description = description.replace(/^[\d\s\.,]+/, '').trim();
            description = description.replace(/^(Kt|Dt|Dr|Cr)\s+/, '').trim();
            // Remove # hashtags often found in FNB descriptions
            description = description.replace(/^#/, '').trim();

            // 5. DEBIT / CREDIT LOGIC (Standardized)
            // Check Explicit Indicators on the Amount String first
            const isCredit = rawAmount.toLowerCase().includes("cr") || rawAmount.toLowerCase().includes("kt");
            const isDebit = rawAmount.toLowerCase().includes("dr") || rawAmount.toLowerCase().includes("dt");

            if (isCredit) {
                amount = Math.abs(amount); // Income (Green)
            } else if (isDebit || rawAmount.includes('-')) {
                amount = -Math.abs(amount); // Expense (Red)
            } else {
                // FNB Standard: No indicator usually means Debit (Expense)
                // Unless text explicitly says "Transfer From" or "Deposit"
                if (description.toLowerCase().includes("transfer from") || description.toLowerCase().includes("deposit")) {
                    amount = Math.abs(amount);
                } else {
                    amount = -Math.abs(amount);
                }
            }

            // 6. DATE FORMATTING
            let formattedDate = potentialDate;
            if (potentialDate.match(/[a-zA-Z]/)) { // "19 Jan"
                const [day, monthStr] = potentialDate.split(" ");
                const monthMap = { jan:"01", feb:"02", mar:"03", apr:"04", may:"05", jun:"06", jul:"07", aug:"08", sep:"09", oct:"10", nov:"11", dec:"12" };
                const monthStr3 = monthStr.toLowerCase().substring(0,3);
                const month = monthMap[monthStr3] || "01";
                
                const stmtYear = statementDate.getFullYear();
                const stmtMonth = statementDate.getMonth() + 1;
                const transMonthInt = parseInt(month);
                let year = stmtYear;
                if (transMonthInt > stmtMonth + 1) year = stmtYear - 1;
                
                formattedDate = `${day.padStart(2, '0')}/${month}/${year}`;
            } else if (potentialDate.match(/^\d{4}/)) { // 2026/01/19
                const p = potentialDate.split('/');
                formattedDate = `${p[2]}/${p[1]}/${p[0]}`;
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
        } else {
            // No numbers found in this block? 
            // The entire text might be part of the NEXT transaction's description (Buffer)
            // e.g. Block is just "FNB App Transfer From" and Date is in next block.
            descriptionBuffer = (descriptionBuffer + " " + dataBlock).trim();
        }
        i++; 
    }
  }

  return transactions;
};