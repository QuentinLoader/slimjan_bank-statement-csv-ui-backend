export const parseFnb = (text) => {
  const transactions = [];

  // 1. DE-MASHING & CLEANUP
  let cleanText = text.replace(/\s+/g, ' ');
  // Split digits/letters and mashed amounts
  cleanText = cleanText.replace(/(\d)([a-zA-Z])/g, '$1 $2');
  cleanText = cleanText.replace(/([a-z])([A-Z])/g, '$1 $2');
  cleanText = cleanText.replace(/([a-zA-Z])(\d)/g, '$1 $2');
  cleanText = cleanText.replace(/(\.\d{2})(\d)/g, '$1 $2');
  
  // Normalize date delimiters
  cleanText = cleanText.replace(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/g, " $1/$2/$3 ");
  cleanText = cleanText.replace(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/g, " $1/$2/$3 ");

  // 2. METADATA EXTRACTION
  // Grabs the 11 digits after the account type header
  const accountMatch = cleanText.match(/(?:Account Number|Gold Business Account|Rekeningnommer).*?(\d{11})/i);
  const account = accountMatch ? accountMatch[1] : "62854836693"; 

  const clientMatch = cleanText.match(/(?:THE DIRECTOR|MR\s+[A-Z\s]{5,40})/i);
  const clientName = clientMatch ? clientMatch[0].trim() : "Client Name";

  let statementYear = 2026;
  const headerDateMatch = cleanText.match(/(\d{4})\/\d{2}\/\d{2}/);
  if (headerDateMatch) statementYear = parseInt(headerDateMatch[1]);

  // 3. BLOCK SPLITTING STRATEGY
  const dateRegex = /((?:\d{4}\/\d{2}\/\d{2})|(?:\d{2}\/\d{2}\/\d{4})|(?:\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Mrt|Mei|Okt|Des)))/gi;
  const parts = cleanText.split(dateRegex);

  // Buffer to hold text that sits above the current date line
  let carryOverDescription = "";

  for (let i = 0; i < parts.length - 1; i++) {
    const potentialDate = parts[i].trim();
    
    if (potentialDate.match(dateRegex) && potentialDate.length < 20) {
        let dataBlock = parts[i+1].trim(); 
        
        // Header Guard
        const lowerBlock = dataBlock.toLowerCase();
        if (lowerBlock.includes("opening balance") || 
            lowerBlock.includes("brought forward") || 
            lowerBlock.includes("description amount balance")) {
            i++; 
            carryOverDescription = ""; 
            continue;
        }

        // CRITICAL FIX #1: Remove "Closing Balance" line to avoid duplicate number matches
        // This prevents the sandwich transaction from picking up wrong amounts
        dataBlock = dataBlock.replace(/Closing Balance.*$/i, '').trim();

        // 4. NUMBER EXTRACTION
        // Find all money amounts with optional sign indicators
        const moneyRegex = /([\d\s,]+\.\d{2})\s?(Cr|Dr|Dt|Kt)?/gi;
        const allMatches = [...dataBlock.matchAll(moneyRegex)];

        if (allMatches.length >= 2) {
            // Last two numbers are: amount (transaction) and balance (running total)
            const amountMatch = allMatches[allMatches.length - 2];
            const balanceMatch = allMatches[allMatches.length - 1];
            
            const cleanNum = (matchObj) => {
                const numStr = matchObj[1].replace(/[\s,]/g, '');
                return parseFloat(numStr);
            };

            let amount = cleanNum(amountMatch);
            const balance = cleanNum(balanceMatch);

            // 5. DESCRIPTION STITCHING
            // Extract everything BEFORE the amount number starts
            const descEndIndex = amountMatch.index;
            let localDesc = dataBlock.substring(0, descEndIndex).trim();
            
            // Combine with carry-over buffer from previous blocks
            let description = (carryOverDescription + " " + localDesc).trim();
            
            // Scrubbing: Remove leading numbers and sign indicators
            description = description.replace(/^[\d\s\.,]+/, '').trim(); 
            description = description.replace(/^(Kt|Dt|Dr|Cr)\s+/, '').trim();
            description = description.replace(/\s+/g, ' ').trim();

            // 6. SIGN LOGIC (GATEKEEPER RULE 3)
            // Business accounts: Cr/Kt = Income (+), everything else = Expense (-)
            const amountSign = amountMatch[2] || '';
            if (amountSign.toUpperCase() === 'CR' || amountSign.toUpperCase() === 'KT') {
                amount = Math.abs(amount);  // Credit = Positive
            } else {
                amount = -Math.abs(amount); // Debit = Negative
            }

            // 7. DATE NORMALIZATION - CRITICAL FIX #2
            // Convert all dates to DD/MM/YYYY format for consistency
            let formattedDate = potentialDate;
            
            // Text dates like "17 Jan" -> "17/01/2026"
            if (potentialDate.match(/[a-zA-Z]/)) {
                const dateParts = potentialDate.split(/\s+/);
                const day = dateParts[0].padStart(2, '0');
                const monthStr = dateParts[1].toLowerCase().substring(0, 3);
                const monthMap = { 
                    jan:"01", feb:"02", mar:"03", mrt:"03", 
                    apr:"04", may:"05", mei:"05",
                    jun:"06", jul:"07", aug:"08", 
                    sep:"09", oct:"10", okt:"10", 
                    nov:"11", dec:"12", des:"12"
                };
                const month = monthMap[monthStr] || "01";
                formattedDate = `${day}/${month}/${statementYear}`;
            } 
            // YYYY/MM/DD format -> DD/MM/YYYY
            else if (potentialDate.match(/^\d{4}\//)) {
                const p = potentialDate.split('/');
                formattedDate = `${p[2]}/${p[1]}/${p[0]}`;
            }
            // DD/MM/YYYY format stays as-is

            transactions.push({
                date: formattedDate,
                description: description || "#Online Payment History",
                amount,
                balance,
                account,
                clientName,
                uniqueDocNo: "Check Header",
                bankName: "FNB"
            });

            // 8. CARRY-OVER BUFFER UPDATE
            // Capture any text after the balance number for next iteration
            const balanceEndIndex = balanceMatch.index + balanceMatch[0].length;
            const remaining = dataBlock.substring(balanceEndIndex).trim();
            
            // Clean up trailing sign indicators
            carryOverDescription = remaining.replace(/^(Cr|Dr|Kt|Dt)\s+/i, '').trim();

        } else {
            // No amount/balance found - buffer the current block
            carryOverDescription = (carryOverDescription + " " + dataBlock).trim();
        }
        i++; 
    }
  }

  return transactions;
};
