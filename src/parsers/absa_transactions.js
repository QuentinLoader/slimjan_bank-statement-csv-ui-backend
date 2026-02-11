/**
 * ABSA Parser (De-Mashed & Reconciled)
 * * Strategy:
 * 1. Pre-processing: Injects spaces to fix "Mashed" PDF text (e.g. "Forward0,00" -> "Forward 0,00").
 * 2. Segmentation: Splits by Date (DD/MM/YYYY).
 * 3. Extraction: Uses Balance verification to identify the correct Amount in the chunk.
 */

export const parseAbsa = (text) => {
  const transactions = [];

  // ===========================================================================
  // 1. HELPER: ABSA NUMBER PARSER
  // ===========================================================================
  const parseAbsaNum = (val) => {
    if (!val) return 0;
    let clean = val.trim();
    
    // Handle trailing minus (100.00-) -> -100.00
    let isNegative = clean.endsWith('-');
    if (isNegative) clean = clean.substring(0, clean.length - 1);
    
    // Cleanup: Remove spaces (thousands) and replace comma with dot
    // Regex: Keep only digits, dots, commas, minus
    clean = clean.replace(/[^0-9,.-]/g, '').replace(',', '.');
    
    let num = parseFloat(clean);
    return isNegative ? -Math.abs(num) : num;
  };

  // ===========================================================================
  // 2. TEXT DE-MASHING (Crucial Step)
  // ===========================================================================
  // The PDF extractor is deleting spaces. We must put them back.
  
  let cleanText = text
    .replace(/\r\n/g, '\n')
    // 1. Separate Text from Numbers (e.g., "Forward0,00" -> "Forward 0,00")
    .replace(/([a-zA-Z])([0-9])/g, '$1 $2')
    // 2. Separate Numbers from Text (e.g., "2025Bal" -> "2025 Bal")
    .replace(/([0-9])([a-zA-Z])/g, '$1 $2')
    // 3. Isolate Dates (e.g. "50-15/12/2025" -> "50- 15/12/2025")
    .replace(/(\d{2}\/\d{2}\/\d{4})/g, ' $1 ')
    // 4. Normalize Spaces
    .replace(/\s+/g, ' ');

  // ===========================================================================
  // 3. METADATA EXTRACTION
  // ===========================================================================
  
  const accountMatch = text.match(/Account\D*?([\d-]{10,})/i) || text.match(/(\d{2}-\d{4}-\d{4})/);
  let account = accountMatch ? accountMatch[1].replace(/-/g, '') : "Unknown";

  // Opening Balance
  let openingBalance = 0;
  // Regex: "Balance Brought Forward" ... [Number]
  const openMatch = cleanText.match(/Balance Brought Forward.*?([0-9\s]+,[0-9]{2}-?)/i);
  if (openMatch) {
      openingBalance = parseAbsaNum(openMatch[1]);
  }

  // Closing Balance (Search for "Balance" key in summary or end of file)
  let closingBalance = 0;
  // Look for "Balance" followed by number at end of string or summary block
  const closeMatch = cleanText.match(/Charges.*?Balance\s*([0-9\s]+,[0-9]{2}-?)/i);
  if (closeMatch) {
      closingBalance = parseAbsaNum(closeMatch[1]);
  }

  // ===========================================================================
  // 4. PARSING LOGIC (Date-Split)
  // ===========================================================================
  // Now that dates are spaced out, we can split reliably.
  const chunks = cleanText.split(/(?=\d{2}\/\d{2}\/\d{4})/);

  let runningBalance = openingBalance;

  chunks.forEach(chunk => {
    // 1. Validate Date Start
    const dateMatch = chunk.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (!dateMatch) return; // Header or garbage

    const dateStr = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`;
    
    // Remove date from content
    let rawContent = chunk.substring(10).trim();
    
    // Skip "Balance Brought Forward" lines
    if (rawContent.toLowerCase().includes("balance brought forward")) return;

    // 2. SCAVENGE NUMBERS
    // Find all potential money values (e.g. "1 200,50" or "50,00-")
    const numRegex = /(\d{1,3}(?: \d{3})*,\d{2}-?)/g;
    const numbersFound = rawContent.match(numRegex);

    if (!numbersFound || numbersFound.length === 0) return;

    // 3. IDENTIFY BALANCE & AMOUNT
    // The LAST number is the Running Balance for this row.
    const candidateBalanceStr = numbersFound[numbersFound.length - 1];
    const currentBalance = parseAbsaNum(candidateBalanceStr);

    // Calculate Expected Amount
    const mathDiff = currentBalance - runningBalance;
    const mathAbs = Math.abs(mathDiff);

    let finalAmount = 0;
    let matchedNumStr = null;

    // Search for the amount in the other numbers
    const potentialAmounts = numbersFound.slice(0, -1);
    
    if (potentialAmounts.length > 0) {
        // Try to find a number that matches the Math Diff
        const matchIndex = potentialAmounts.findIndex(numStr => {
            return Math.abs(parseAbsaNum(numStr) - mathAbs) < 0.05;
        });

        if (matchIndex !== -1) {
            // Perfect Match found
            finalAmount = mathDiff;
            matchedNumStr = potentialAmounts[matchIndex];
        } else {
            // No exact match? It might be a fee + transaction row.
            // In ABSA, if we can't match it, trust the Math (Balance Difference).
            finalAmount = mathDiff;
        }
    } else {
        // Only one number found (The Balance)? 
        // Then the amount wasn't captured or it's a 0.00 movement.
        // We'll trust the math if it's significant.
        if (mathAbs > 0.01) finalAmount = mathDiff;
        else return; // Skip 0.00 filler rows
    }

    // 4. CLEANUP DESCRIPTION
    let description = rawContent.replace(candidateBalanceStr, '');
    if (matchedNumStr) description = description.replace(matchedNumStr, '');
    
    description = description
        .replace(numRegex, '') // Remove remaining numbers (like fees)
        .replace(/Settlement/gi, '')
        .replace(/^[\d\-\.,\s]+/, '') // Remove leading junk
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
      bankName: "ABSA" // Explicitly set bank name
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