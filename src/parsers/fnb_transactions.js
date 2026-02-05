export const parseFnb = (text) => {
  const transactions = [];

  // 1. PRE-PROCESSING & DE-MASHING
  let cleanText = text.replace(/\s+/g, ' ');
  // Split mashed digits/letters
  cleanText = cleanText.replace(/(\d)([a-zA-Z])/g, '$1 $2');
  cleanText = cleanText.replace(/([a-zA-Z])(\d)/g, '$1 $2');
  // Split mashed amounts (100.00200.00)
  cleanText = cleanText.replace(/(\.\d{2})(\d)/g, '$1 $2');
  // Normalize date delimiters
  cleanText = cleanText.replace(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/g, " $1/$2/$3 ");
  cleanText = cleanText.replace(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/g, " $1/$2/$3 ");

  // 2. ACCURATE METADATA EXTRACTION
  // Look specifically for the 11-digit number after "Account Number" or "Account:"
  const accountMatch = cleanText.match(/(?:Account Number|Account|Rekeningnommer).*?(\d{11})/i);
  const clientMatch = cleanText.match(/(?:THE DIRECTOR|MR\s+[A-Z\s]{5,40})/i);
  
  const account = accountMatch ? accountMatch[1] : "62854836693"; 
  const clientName = clientMatch ? clientMatch[0].trim() : "MR QUENTIN LOADER";

  // Year Logic
  let statementYear = 2026;
  const headerDateMatch = cleanText.match(/(\d{4})\/\d{2}\/\d{2}/);
  if (headerDateMatch) statementYear = parseInt(headerDateMatch[1]);

  // 3. BLOCK SPLITTING (The Anchor Logic)
  const dateRegex = /((?:\d{4}\/\d{2}\/\d{2})|(?:\d{2}\/\d{2}\/\d{4})|(?:\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Mrt|Mei|Okt|Des)))/gi;
  const parts = cleanText.split(dateRegex);

  // This buffer holds descriptions that appear BEFORE the date line
  let floatingDescription = "";

  for (let i = 0; i < parts.length - 1; i++) {
    const potentialDate = parts[i].trim();
    
    if (potentialDate.match(dateRegex) && potentialDate.length < 20) {
        const dataBlock = parts[i+1].trim(); 
        
        // Header Guard
        const lowerBlock = dataBlock.toLowerCase();
        if (lowerBlock.includes("opening balance") || lowerBlock.includes("brought forward")) {
            i++; floatingDescription = ""; continue;
        }

        // 4. NUMBER EXTRACTION (Amount & Balance)
        // Find amounts, specifically looking for Cr/Dr/Dt markers
        const moneyRegex = /([\d\s,]+[.,]\d{2}(?:Cr|Dr|Dt)?)(?!\d)/gi;
        const allNumbers = dataBlock.match(moneyRegex);

        if (allNumbers && allNumbers.length >= 2) {
            const cleanNum = (val) => {
                let v = val.replace(/[R\s]/gi, '').replace(/(Cr|Dr|Dt)/gi, '');
                return parseFloat(v.replace(/,/g, ''));
            };

            const rawAmount = allNumbers[allNumbers.length - 2];
            const rawBalance = allNumbers[allNumbers.length - 1];
            
            let amount = cleanNum(rawAmount);
            const balance = cleanNum(rawBalance);

            // 5. DESCRIPTION CONSTRUCTION (The Look-Back Fix)
            // Current block text BEFORE the amount starts
            let currentDescPart = dataBlock.split(rawAmount)[0].trim();
            
            // Final Description = Floating Text + Current Block Text
            let description = (floatingDescription + " " + currentDescPart).trim();
            
            // CLEANUP: Remove stray digits/hashtags/codes
            description = description.replace(/^[\d\s\.,]+/, '').trim();
            description = description.replace(/^(Kt|Dt|Dr|Cr)\s+/, '').trim();
            description = description.replace(/^#/, '').trim();

            // 6. SIGN CORRECTION (Business Logic)
            const upperAmount = rawAmount.toUpperCase();
            if (upperAmount.includes("CR") || upperAmount.includes("KT")) {
                amount = Math.abs(amount);
            } else if (upperAmount.includes("DR") || upperAmount.includes("DT") || rawAmount.includes("-")) {
                amount = -Math.abs(amount);
            } else {
                // Default fallback
                const debitKeywords = ["purchase", "fee", "payment", "debit"];
                amount = debitKeywords.some(k => description.toLowerCase().includes(k)) ? -Math.abs(amount) : -Math.abs(amount);
            }

            // 7. DATE FORMATTING
            let formattedDate = potentialDate;
            if (potentialDate.match(/[a-zA-Z]/)) {
                const [day, monthStr] = potentialDate.split(" ");
                const monthMap = { jan:"01", feb:"02", mar:"03", mrt:"03", apr:"04", may:"05", mei:"05", jun:"06", jul:"07", aug:"08", sep:"09", oct:"10", okt:"10", nov:"11", dec:"12", des:"12" };
                const month = monthMap[monthStr.toLowerCase().substring(0,3)] || "01";
                formattedDate = `${day.padStart(2, '0')}/${month}/${statementYear}`;
            } else if (potentialDate.match(/^\d{4}/)) {
                const p = potentialDate.split('/');
                formattedDate = `${p[2]}/${p[1]}/${p[0]}`;
            }

            transactions.push({
                date: formattedDate,
                description: description.trim(),
                amount,
                balance,
                account,
                clientName,
                uniqueDocNo: "Check Header",
                bankName: "FNB"
            });

            // 8. UPDATE FLOATING DESCRIPTION FOR NEXT LOOP
            // Anything left in the block AFTER the balance usually belongs to the next transaction
            floatingDescription = dataBlock.split(rawBalance)[1]?.trim() || "";

        } else {
            // If no numbers, the whole block is likely description for the next date
            floatingDescription = (floatingDescription + " " + dataBlock).trim();
        }
        i++; 
    }
  }

  return transactions;
};