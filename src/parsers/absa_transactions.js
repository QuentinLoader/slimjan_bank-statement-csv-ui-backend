/**
 * ABSA Parser (Fixed for Single-Digit Dates)
 * * Improvements:
 * 1. Date Regex: Now accepts "2/01/2026" (Single digit day).
 * 2. Segmentation: Correctly splits the "Super-Row" into individual transactions.
 * 3. Footer Filtering: Ignores "STANDARD - REFER TO BRANCH" garbage.
 */

export const parseAbsa = (text) => {
  const transactions = [];

  // ===========================================================================
  // 1. SURGICAL TEXT CLEANUP
  // ===========================================================================
  let cleanText = text
    .replace(/\r\n/g, '\n')
    // Remove specific Headers/Footers
    .replace(/Cheque account statement.*?(\d{1,2}\/\d{2}\/\d{4}|$)/gis, '$1') 
    .replace(/Return address:.*?(?=\d{1,2}\/\d{2}\/\d{4})/gis, ' ') 
    .replace(/Our Privacy Notice.*?version\./gi, ' ')
    .replace(/Page \d+ of \d+/gi, ' ')
    .replace(/ABSA Bank Limited/gi, ' ')
    .replace(/Authorised Financial Services/gi, ' ')
    .replace(/STANDARD - REFER TO BRANCH.*?TS&CS APPLY\./gis, ' '); // Remove the big footer

  // FIX MERGED NUMBERS (e.g. "5.5078.20" -> "5.50 78.20")
  cleanText = cleanText.replace(/(\.\d{2})([0-9])/g, '$1 $2');

  // FIX TEXT-NUMBER MERGES
  cleanText = cleanText
    .replace(/([a-z])([A-Z])/g, '$1 $2') 
    .replace(/([a-zA-Z])([0-9])/g, '$1 $2') 
    .replace(/([0-9])([a-zA-Z])/g, '$1 $2') 
    .replace(/\*/g, ' * ') 
    .replace(/\s+/g, ' '); 

  // ===========================================================================
  // 2. HELPER: NUMBER PARSER
  // ===========================================================================
  const parseAbsaNum = (val) => {
    if (!val) return 0;
    let clean = val.trim();
    let isNegative = clean.endsWith('-');
    if (isNegative) clean = clean.substring(0, clean.length - 1);
    clean = clean.replace(/[^0-9,.-]/g, '').replace(',', '.');
    let num = parseFloat(clean);
    return isNegative ? -Math.abs(num) : num;
  };

  // ===========================================================================
  // 3. METADATA EXTRACTION
  // ===========================================================================
  const accountMatch = text.match(/Account\D*?([\d-]{10,})/i) || text.match(/(\d{2}-\d{4}-\d{4})/);
  let account = accountMatch ? accountMatch[1].replace(/-/g, '') : "Unknown";

  let openingBalance = 0;
  const openMatch = cleanText.match(/Balance Brought Forward.*?([0-9\s]+,[0-9]{2}-?)/i);
  if (openMatch) openingBalance = parseAbsaNum(openMatch[1]);

  let closingBalance = 0;
  const closeMatch = cleanText.match(/Charges.*?Balance\s*([0-9\s]+,[0-9]{2}-?)/i);
  if (closeMatch) closingBalance = parseAbsaNum(closeMatch[1]);

  // ===========================================================================
  // 4. PARSING LOGIC (Fixed Split)
  // ===========================================================================
  // FIX: Allow 1 or 2 digits for day: (?=\d{1,2}\/\d{2}\/\d{4})
  const chunks = cleanText.split(/(?=\d{1,2}\/\d{2}\/\d{4})/);

  let runningBalance = openingBalance;

  chunks.forEach(chunk => {
    // 1. Validate Date (1 or 2 digits)
    const dateMatch = chunk.match(/^(\d{1,2})\/(\d{2})\/(\d{4})/);
    if (!dateMatch) return; 

    // Pad day with 0 if single digit (2 -> 02)
    const day = dateMatch[1].padStart(2, '0');
    const dateStr = `${day}/${dateMatch[2]}/${dateMatch[3]}`;
    
    let rawContent = chunk.substring(dateMatch[0].length).trim();

    if (rawContent.toLowerCase().includes("balance brought forward")) return;

    // 2. SCAVENGE NUMBERS
    const numRegex = /(\d{1,3}(?: \d{3})*[.,]\d{2}-?)/g;
    const numbersFound = rawContent.match(numRegex);

    if (!numbersFound || numbersFound.length === 0) return;

    // 3. IDENTIFY BALANCE & AMOUNT
    const candidateBalanceStr = numbersFound[numbersFound.length - 1];
    const currentBalance = parseAbsaNum(candidateBalanceStr);

    const mathDiff = currentBalance - runningBalance;
    const mathAbs = Math.abs(mathDiff);

    let finalAmount = 0;
    let amountStrFound = null;

    const potentialAmounts = numbersFound.slice(0, -1);
    
    if (potentialAmounts.length > 0) {
        const matchIndex = potentialAmounts.findIndex(numStr => {
            return Math.abs(parseAbsaNum(numStr) - mathAbs) < 0.05;
        });

        if (matchIndex !== -1) {
            finalAmount = mathDiff; 
            amountStrFound = potentialAmounts[matchIndex];
        } else {
            finalAmount = mathDiff;
        }
    } else {
        if (mathAbs > 0.01) finalAmount = mathDiff;
        else return; 
    }

    // 4. DESCRIPTION CLEANUP
    let description = rawContent.replace(candidateBalanceStr, '');
    if (amountStrFound) description = description.replace(amountStrFound, '');
    else description = description.replace(numRegex, ''); 

    description = description
        .replace(/Settlement/gi, '')
        .replace(/^[\d\-\.,\s*]+/, '') 
        .replace(/^\)\s*/, '') // Remove loose closing parenthesis from splits
        .trim();

    // Ignore garbage rows that slipped through
    if (description.startsWith("STANDARD - REFER TO BRANCH")) return;

    runningBalance = currentBalance;

    transactions.push({
      date: dateStr,
      description: description || "Transaction",
      amount: finalAmount,
      balance: currentBalance,
      account: account,
      uniqueDocNo: "ABSA-Stmt",
      bankName: "ABSA"
    });
  });

  return {
    metadata: {
      accountNumber: account,
      openingBalance: openingBalance,
      closingBalance: closingBalance,
      transactionCount: transactions.length,
      bankName: "ABSA"
    },
    transactions: transactions
  };
};