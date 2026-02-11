/**
 * ABSA Parser (Robust & Reconciled)
 * * Strategy:
 * 1. Handles "Mashed" text (e.g. "2025Description").
 * 2. Normalizes ABSA numbers ("1 234,56-").
 * 3. Uses Balance-Driven logic to verify amounts and fix merged text.
 * 4. Returns { metadata, transactions } for Lovable.
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
    if (isNegative) {
        clean = clean.substring(0, clean.length - 1);
    }
    
    // Remove spaces (thousands separator) and replace comma with dot
    clean = clean.replace(/\s/g, '').replace(',', '.');
    
    // Safety check for non-numeric junk
    if (isNaN(clean)) return 0;

    let num = parseFloat(clean);
    return isNegative ? -Math.abs(num) : num;
  };

  // ===========================================================================
  // 2. METADATA EXTRACTION (Relaxed Regex)
  // ===========================================================================
  
  // Account: Look for pattern near "Account" or standalone 10-digit format
  const accountMatch = text.match(/Account\D*?([\d-]{10,})/i) || text.match(/(\d{2}-\d{4}-\d{4})/);
  let account = accountMatch ? accountMatch[1].replace(/-/g, '') : "Unknown";

  // Opening Balance (Relaxed to handle "Forward0,00")
  let openingBalance = 0;
  // Regex: "Balance Brought Forward" ... [Number]
  const openMatch = text.match(/Balance Brought Forward.*?([0-9\s]+,[0-9]{2}-?)/i);
  if (openMatch) {
      openingBalance = parseAbsaNum(openMatch[1]);
  }

  // Closing Balance (Look for the final balance in summary)
  let closingBalance = 0;
  // Strategy: Find "Balance" followed by a number at the end of the text block is risky.
  // Better: Look for "Balance" key in the summary section (usually implies closing)
  // ABSA Summary often has: "Charges... Balance... Overdraft"
  const summaryMatch = text.match(/Charges.*?Balance\s*([0-9\s]+,[0-9]{2}-?)/is);
  if (summaryMatch) {
      closingBalance = parseAbsaNum(summaryMatch[1]);
  }

  // ===========================================================================
  // 3. TEXT CLEANUP
  // ===========================================================================
  let cleanText = text
    .replace(/\s+/g, ' ') 
    .replace(/Page \d+ of \d+/gi, ' ')
    // Protect the "Balance Brought Forward" so it doesn't get parsed as a transaction
    .replace(/Balance Brought Forward/gi, 'OB_Marker'); 

  // ===========================================================================
  // 4. PARSING LOGIC
  // ===========================================================================
  // ABSA Pattern: Date ... Description ... Amount ... Balance
  // We use \s* (zero or more spaces) to handle mashed text.
  
  // Regex Breakdown:
  // 1. Date: DD/MM/YYYY
  // 2. Description: (Greedy match)
  // 3. Amount: Number (with comma decimal and optional trailing minus)
  // 4. Balance: Number (same format)
  
  const absaRegex = /(\d{2}\/\d{2}\/\d{4})\s*(.*?)\s*([0-9\s]+,[0-9]{2}-?)\s*([0-9\s]+,[0-9]{2}-?)/gi;

  let match;
  let runningBalance = openingBalance;

  while ((match = absaRegex.exec(cleanText)) !== null) {
    const dateStr = match[1];
    let description = match[2].trim();
    const amountRaw = match[3];
    const balanceRaw = match[4];

    // Parse Financials
    const finalBalance = parseAbsaNum(balanceRaw);
    let finalAmount = parseAbsaNum(amountRaw);

    // --- BALANCE-DRIVEN VERIFICATION ---
    // Calculate what the amount *should* be based on balance movement
    const expectedDiff = finalBalance - runningBalance;
    const expectedAbs = Math.abs(expectedDiff);

    // Check if Parsed Amount matches Expected Amount (Tolerance 0.02)
    if (Math.abs(Math.abs(finalAmount) - expectedAbs) > 0.02) {
        
        // DISCREPANCY detected.
        // It's possible the regex grabbed "Charges" + "Amount" as one Description,
        // or a merged number occurred.
        
        // Trust the Math?
        // In ABSA, columns are strict. If we miss a column (e.g. Credit is empty),
        // the regex might grab the Balance as the Amount.
        
        // Check if `finalAmount` is actually the Balance?
        // (If regex skipped a column)
        // No, because we captured two numbers. 
        
        // Check if the Expected Amount is buried in the Description?
        // (Unlikely for ABSA column layouts, but possible if mashed)
        
        // Fallback: If the parsed amount is clearly wrong, trust the Balance Math.
        // ABSA Statements are sequential.
        finalAmount = expectedDiff;
        description = description + " [Calc Fix]";
    } else {
        // If values match, ensure the Sign is correct based on math.
        // (ABSA text usually has the sign, but this is a double-check)
        finalAmount = expectedDiff;
    }

    // Update Tracker
    runningBalance = finalBalance;

    // Cleanup Description
    description = description
        .replace(/OB_Marker/g, '') // Remove our temp marker if leaked
        .replace(/^[\d\-\.,\s]+/, '') // Remove leading junk
        .trim();
        
    // Filter out summary lines captured by mistake
    if (description.toLowerCase().includes("statement no") || 
        description.toLowerCase().includes("account summary")) continue;

    transactions.push({
      date: dateStr,
      description: description,
      amount: finalAmount, // Returns float (negative for debit)
      balance: finalBalance,
      account: account,
      uniqueDocNo: "ABSA-Stmt",
      bankName: "ABSA"
    });
  }

  // ===========================================================================
  // 5. RETURN OBJECT
  // ===========================================================================
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