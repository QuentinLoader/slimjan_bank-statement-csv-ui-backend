/**
 * ABSA Parser (Surgical De-Mashed & Reconciled)
 * * Fixed Specific Issues:
 * 1. Merged Financials: Splits "5.5078.20" -> "5.50" and "78.20".
 * 2. Header/Footer Leak: Removes "Cheque account statement", "Return address", etc.
 * 3. Mashed Text/Numbers: Injects spaces between Text-Numbers and Number-Numbers.
 */

export const parseAbsa = (text) => {
  const transactions = [];

  // ===========================================================================
  // 1. SURGICAL TEXT CLEANUP (The Fix)
  // ===========================================================================
  let cleanText = text
    .replace(/\r\n/g, '\n')
    // Remove known Footers/Headers that pollute descriptions
    .replace(/Cheque account statement.*?(\d{2}\/\d{2}\/\d{4}|$)/gis, '$1') // Remove header block
    .replace(/Return address:.*?(?=\d{2}\/\d{2}\/\d{4})/gis, ' ') 
    .replace(/Our Privacy Notice.*?version\./gi, ' ')
    .replace(/Page \d+ of \d+/gi, ' ')
    .replace(/ABSA Bank Limited/gi, ' ')
    .replace(/Authorised Financial Services/gi, ' ');

  // FIX MERGED NUMBERS (e.g. "5.5078.20" -> "5.50 78.20")
  // Strategy: Look for .XX followed immediately by a digit
  cleanText = cleanText.replace(/(\.\d{2})([0-9])/g, '$1 $2');

  // FIX TEXT-NUMBER MERGES (e.g. "FeeHeadoffice" -> "Fee Headoffice", "Headoffice*5.50")
  cleanText = cleanText
    .replace(/([a-z])([A-Z])/g, '$1 $2') // CamelCase split
    .replace(/([a-zA-Z])([0-9])/g, '$1 $2') // Text-Number split
    .replace(/([0-9])([a-zA-Z])/g, '$1 $2') // Number-Text split
    .replace(/\*/g, ' * ') // Isolate asterisks
    .replace(/\s+/g, ' '); // Normalize spaces

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

  // Opening Balance
  let openingBalance = 0;
  const openMatch = cleanText.match(/Balance Brought Forward.*?([0-9\s]+,[0-9]{2}-?)/i);
  if (openMatch) openingBalance = parseAbsaNum(openMatch[1]);

  // Closing Balance
  let closingBalance = 0;
  const closeMatch = cleanText.match(/Charges.*?Balance\s*([0-9\s]+,[0-9]{2}-?)/i);
  if (closeMatch) closingBalance = parseAbsaNum(closeMatch[1]);

  // ===========================================================================
  // 4. PARSING LOGIC (Date-Split)
  // ===========================================================================
  // Split by Date Pattern (DD/MM/YYYY)
  const chunks = cleanText.split(/(?=\d{2}\/\d{2}\/\d{4})/);

  let runningBalance = openingBalance;

  chunks.forEach(chunk => {
    // 1. Validate Date
    const dateMatch = chunk.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (!dateMatch) return; 

    const dateStr = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`;
    let rawContent = chunk.substring(10).trim();

    if (rawContent.toLowerCase().includes("balance brought forward")) return;

    // 2. SCAVENGE NUMBERS
    // Find numbers: 1 200,50 or 50.00 or 60.00-
    // We updated cleanText to space them out, so simple regex works
    const numRegex = /(\d{1,3}(?: \d{3})*[.,]\d{2}-?)/g;
    const numbersFound = rawContent.match(numRegex);

    if (!numbersFound || numbersFound.length === 0) return;

    // 3. IDENTIFY BALANCE & AMOUNT
    // Last number is Balance
    const candidateBalanceStr = numbersFound[numbersFound.length - 1];
    const currentBalance = parseAbsaNum(candidateBalanceStr);

    // Calculate Amount
    const mathDiff = currentBalance - runningBalance;
    const mathAbs = Math.abs(mathDiff);

    let finalAmount = 0;
    let amountStrFound = null;

    // Search for Amount in previous numbers
    const potentialAmounts = numbersFound.slice(0, -1);
    
    if (potentialAmounts.length > 0) {
        const matchIndex = potentialAmounts.findIndex(numStr => {
            return Math.abs(parseAbsaNum(numStr) - mathAbs) < 0.05;
        });

        if (matchIndex !== -1) {
            finalAmount = mathDiff; // Trust Math for sign
            amountStrFound = potentialAmounts[matchIndex];
        } else {
            // Fallback: Use math difference
            finalAmount = mathDiff;
        }
    } else {
        // Only one number? If mathDiff is significant, assume it's valid
        if (mathAbs > 0.01) finalAmount = mathDiff;
        else return; // Skip 0.00 filler
    }

    // 4. DESCRIPTION CLEANUP
    let description = rawContent.replace(candidateBalanceStr, '');
    if (amountStrFound) description = description.replace(amountStrFound, '');
    else description = description.replace(numRegex, ''); // Remove all numbers if not specific

    description = description
        .replace(/Settlement/gi, '')
        .replace(/^[\d\-\.,\s*]+/, '') // Remove leading junk
        .trim();

    // Update Tracker
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