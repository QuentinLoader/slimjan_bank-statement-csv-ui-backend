/**
 * FNB Parser (Reconciliation Ready)
 * Returns: { metadata, transactions }
 */
export const parseFnb = (text) => {
  const transactions = [];
  
  // ===========================================================================
  // 1. EXTRACT METADATA (THE TRUTH SOURCE)
  // ===========================================================================
  
  // Account Info
  const accountMatch = text.match(/Account\D*?(\d{11})/i) || text.match(/(\d{11})/);
  const account = accountMatch ? accountMatch[1] : "Unknown";
  
  const statementIdMatch = text.match(/BBST(\d+)/i);
  const uniqueDocNo = statementIdMatch ? statementIdMatch[1] : "Unknown";

  // 1.1 Extract Opening Balance (The Start Point)
  let openingBalance = 0;
  const openMatch = text.match(/Opening Balance\s*([0-9,]+\.[0-9]{2})\s*(Cr|Dr)?/i);
  if (openMatch) {
      openingBalance = parseFloat(openMatch[1].replace(/,/g, ''));
      if (openMatch[2] !== 'Cr') openingBalance = -Math.abs(openingBalance);
  }

  // 1.2 Extract Closing Balance (The Target)
  let closingBalance = 0;
  const closeMatch = text.match(/Closing Balance\s*([0-9,]+\.[0-9]{2})\s*(Cr|Dr)?/i);
  if (closeMatch) {
      closingBalance = parseFloat(closeMatch[1].replace(/,/g, ''));
      if (closeMatch[2] !== 'Cr') closingBalance = -Math.abs(closingBalance);
  }

  // Date Logic
  let currentYear = new Date().getFullYear();
  const dateHeader = text.match(/(20\d{2})\/\d{2}\/\d{2}/);
  if (dateHeader) currentYear = parseInt(dateHeader[1]);

  // ===========================================================================
  // 2. PARSE TRANSACTIONS (Same robust logic as before)
  // ===========================================================================
  let cleanText = text
    .replace(/\s+/g, ' ') 
    .replace(/Page \d+ of \d+/gi, ' ') 
    .replace(/Transactions in RAND/i, ' ')
    .replace(/Statement Balances/i, ' '); 

  // [Amount] [Sign] [Balance] [Sign]
  const moneyRegex = /([0-9\s,]+\.[0-9]{2})\s*(Cr|Dr)?\s*([0-9\s,]+\.[0-9]{2})\s*(Cr|Dr)?/gi;

  let match;
  let lastIndex = 0;
  let runningBalance = openingBalance; // Initialize with the Truth

  while ((match = moneyRegex.exec(cleanText)) !== null) {
    let amountRaw = match[1].replace(/[\s,]/g, '');
    let amountSign = match[2];
    let balanceRaw = match[3].replace(/[\s,]/g, '');
    let balanceSign = match[4];

    // Get Date/Desc from preceding text
    let startIndex = Math.max(lastIndex, match.index - 300);
    let rawSegment = cleanText.substring(startIndex, match.index).trim();
    lastIndex = moneyRegex.lastIndex;

    if (rawSegment.toLowerCase().includes("opening balance")) continue;
    if (rawSegment.length < 2) continue;

    // Date Extraction
    let dateStr = "";
    let description = rawSegment;
    const dateMatch = rawSegment.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i) 
                   || rawSegment.match(/(\d{4})\/(\d{2})\/(\d{2})/);

    if (dateMatch) {
        if (dateMatch[2].length === 3) { 
             const day = dateMatch[1].padStart(2, '0');
             const months = { Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06', Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12' };
             const month = months[dateMatch[2]] || months[dateMatch[2].substring(0,3)];
             let txYear = currentYear;
             if (month === '12' && new Date().getMonth() < 3) txYear = currentYear - 1;
             dateStr = `${day}/${month}/${txYear}`;
        } else {
             dateStr = `${dateMatch[3]}/${dateMatch[2]}/${dateMatch[1]}`;
        }
        description = description.replace(dateMatch[0], "").trim();
    } else {
        if (!description.toLowerCase().includes("balance")) continue;
        dateStr = `01/01/${currentYear}`;
    }

    // Amount Logic
    let finalAmount = parseFloat(amountRaw);
    let finalBalance = parseFloat(balanceRaw);
    if (balanceSign === 'Dr') finalBalance = -Math.abs(finalBalance);
    else finalBalance = Math.abs(finalBalance);

    let isCredit = (amountSign === 'Cr');
    if (isCredit) finalAmount = Math.abs(finalAmount);
    else finalAmount = -Math.abs(finalAmount);

    // --- AUTO-CORRECTION WITH METADATA ---
    // Since we know the Opening Balance, we can trust the running math
    let expectedDiff = finalBalance - runningBalance;
    let expectedAbs = Math.abs(expectedDiff);

    if (Math.abs(Math.abs(finalAmount) - expectedAbs) > 0.02) {
        let amountStr = amountRaw.replace('.', '');
        let expectedStr = expectedAbs.toFixed(2).replace('.', '');
        
        if (expectedAbs > 0.01 && amountStr.endsWith(expectedStr)) {
             // Fix merged number
             let prefix = amountRaw.substring(0, amountRaw.length - expectedStr.length - (amountRaw.includes('.') ? 0 : 0)); 
             // (Simplified prefix logic for brevity - strict substring is safer)
             let charsToChop = amountStr.length - expectedStr.length; 
             // Adjust for original string having dots/commas
             
             finalAmount = (expectedDiff > 0) ? expectedAbs : -expectedAbs;
             description = description + " [Ref Fix]"; 
        } else if (Math.abs(finalAmount) > 10000000) {
            // Fallback for huge numbers
             let strictMatch = amountRaw.match(/(\d{1,7}\.\d{2})$/);
             if (strictMatch) {
                let realVal = parseFloat(strictMatch[1]);
                finalAmount = (isCredit) ? realVal : -realVal;
                description = description + " [Split Fix]";
             }
        }
    } else {
        // Trust the math for sign
        finalAmount = expectedDiff;
    }

    runningBalance = finalBalance; // Update tracker

    description = description.replace(/^[\d\-\.\s]+/, '').trim(); 
    if (!description) description = "Transaction";

    transactions.push({
      date: dateStr,
      description: description,
      amount: finalAmount,
      balance: finalBalance,
      account: account,
      uniqueDocNo: uniqueDocNo
    });
  }

  // ===========================================================================
  // 3. RETURN STRUCTURED DATA
  // ===========================================================================
  return {
    metadata: {
      accountNumber: account,
      statementId: uniqueDocNo,
      openingBalance: openingBalance,
      closingBalance: closingBalance,
      transactionCount: transactions.length
    },
    transactions: transactions
  };
};