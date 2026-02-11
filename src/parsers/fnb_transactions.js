/**
 * FNB "Balance-Aware" Parser
 * * FIXES: 
 * 1. "27 Trillion" Merged Amounts -> Uses Running Balance to verify & slice correct amount.
 * 2. Missing Descriptions -> Ensures fallback text.
 * 3. Lowers "Huge Amount" threshold to 1 Million.
 */

export const parseFnb = (text) => {
  const transactions = [];

  // ===========================================================================
  // 1. METADATA & SETUP
  // ===========================================================================
  const accountMatch = text.match(/Account\D*?(\d{11})/i) || text.match(/(\d{11})/);
  const account = accountMatch ? accountMatch[1] : "Unknown";

  const statementIdMatch = text.match(/BBST(\d+)/i);
  const uniqueDocNo = statementIdMatch ? statementIdMatch[1] : "Unknown";

  const clientMatch = text.match(/\*?([A-Z\s\.]+(?:PROPERTIES|LIVING|TRADING|LTD|PTY)[A-Z\s\.]*)/i);
  const clientName = clientMatch ? clientMatch[1].trim() : "Unknown";

  let currentYear = new Date().getFullYear();
  const dateHeader = text.match(/(20\d{2})\/\d{2}\/\d{2}/);
  if (dateHeader) currentYear = parseInt(dateHeader[1]);

  // Find Opening Balance to initialize our tracker
  // Pattern: "Opening Balance 123.45 Cr"
  let lastBalance = null;
  const openingMatch = text.match(/Opening Balance\s*([0-9,]+\.[0-9]{2})\s*(Cr|Dr)?/i);
  if (openingMatch) {
      let val = parseFloat(openingMatch[1].replace(/,/g, ''));
      if (openingMatch[2] !== 'Cr') val = -Math.abs(val); // Assume Dr is negative
      lastBalance = val;
  }

  // ===========================================================================
  // 2. TEXT FLATTENING
  // ===========================================================================
  let cleanText = text
    .replace(/\s+/g, ' ') 
    .replace(/Page \d+ of \d+/gi, ' ') 
    .replace(/Transactions in RAND/i, ' ');

  // ===========================================================================
  // 3. PARSING LOGIC
  // ===========================================================================
  // Regex: Date ... Description ... Amount ... Balance
  const flatRegex = /(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*(.*?)\s*([0-9\s,]+\.[0-9]{2})\s*(Cr|Dr)?\s*([0-9\s,]+\.[0-9]{2})\s*(Cr|Dr)?/gi;

  let match;
  while ((match = flatRegex.exec(cleanText)) !== null) {
    const day = match[1].padStart(2, '0');
    const monthRaw = match[2];
    let description = match[3].trim();
    let amountRaw = match[4].replace(/[\s,]/g, '');
    const amountSign = match[5]; 
    let balanceRaw = match[6].replace(/[\s,]/g, '');
    const balanceSign = match[7]; // Balance Sign

    // --- 1. Parse Basic Values ---
    let finalAmount = parseFloat(amountRaw);
    let finalBalance = parseFloat(balanceRaw);
    
    // Balance Sign Logic
    // In FNB, Balance usually has Cr/Dr. If Cr -> Positive.
    // If Dr or No Sign -> Negative? Usually FNB Balances are Credit (Positive).
    // Let's assume Cr = Positive, Dr = Negative.
    if (balanceSign === 'Dr') finalBalance = -Math.abs(finalBalance);
    else finalBalance = Math.abs(finalBalance); // Default to positive if Cr or missing (usually)

    // Amount Sign Logic
    // Cr = Income (+), Dr/NoSign = Expense (-)
    let isCredit = (amountSign === 'Cr');
    
    // --- 2. BALANCE-BASED REPAIR (The "Golden Key") ---
    // If we have a running balance, we can calculate what the amount SHOULD be.
    // Diff = NewBalance - OldBalance
    
    if (lastBalance !== null) {
        let expectedDiff = finalBalance - lastBalance;
        let expectedAbs = Math.abs(expectedDiff).toFixed(2);
        
        // If the parsed amount is HUGE (> 1 Million)
        if (finalAmount > 1000000) {
            // Check if the "Expected Amount" (e.g. 350.00) exists at the END of the huge string
            // Regex: /350\.00$/
            if (amountRaw.endsWith(expectedAbs)) {
                // FOUND IT! The merged string ends with the real amount.
                finalAmount = parseFloat(expectedAbs);
                
                // Fix Description: The prefix is the reference number
                let prefix = amountRaw.substring(0, amountRaw.length - expectedAbs.length);
                description = description + " " + prefix;
                
                // Fix Sign based on balance movement
                // If Balance decreased, it's an expense.
                isCredit = (expectedDiff > 0);
            }
        }
    }
    
    // Update Tracker
    lastBalance = finalBalance;

    // --- 3. FINAL FORMATTING ---
    if (isCredit) {
        finalAmount = Math.abs(finalAmount);
    } else {
        finalAmount = -Math.abs(finalAmount);
    }
    
    // Validation
    if (description.toLowerCase().includes('opening balance')) continue;
    if (description.length > 150) continue; 
    
    // Cleanup Description
    description = description.replace(/^[\d\-\.\s]+/, '').trim();
    // Fallback for empty descriptions (fixes FNB 3 NaN issue)
    if (!description || description.length === 0) {
        description = "Transaction"; 
    }

    // Date
    const months = { Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06', Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12' };
    const month = months[monthRaw] || months[monthRaw.substring(0,3)];
    let txYear = currentYear;
    if (month === '12' && new Date().getMonth() < 3) txYear = currentYear - 1;
    const dateStr = `${day}/${month}/${txYear}`;

    transactions.push({
      date: dateStr,
      description: description,
      amount: finalAmount,
      balance: finalBalance,
      account: account,
      bankName: "FNB",
      clientName: clientName,
      uniqueDocNo: uniqueDocNo
    });
  }

  // --- FALLBACK: ISO DATES (YYYY/MM/DD) ---
  // Same logic, just different regex for date
  if (transactions.length < 2) {
      const isoRegex = /(\d{4})\/(\d{2})\/(\d{2})\s*(.*?)\s*([0-9\s,]+\.[0-9]{2})\s*(Cr|Dr)?\s*([0-9\s,]+\.[0-9]{2})\s*(Cr|Dr)?/gi;
      
      // Reset tracker if needed, or continue? 
      // Safest to rely on regex matching for fallback without complex balance logic 
      // unless we want to replicate it fully. For now, simple split is better than 0 items.
      
      while ((match = isoRegex.exec(cleanText)) !== null) {
          let description = match[4].trim();
          if (description.toLowerCase().includes('opening balance')) continue;
          
          let amountRaw = match[5].replace(/[\s,]/g, '');
          let balanceRaw = match[7].replace(/[\s,]/g, '');
          
          let finalAmount = parseFloat(amountRaw);
          
          // Simple Threshold Logic for Fallback (since we might not have balance sync)
          if (finalAmount > 1000000) {
              let strictMatch = amountRaw.match(/(\d{1,6}\.\d{2})$/); // Max 999k
              if (strictMatch) {
                  finalAmount = parseFloat(strictMatch[1]);
                  description = description + " " + amountRaw.substring(0, amountRaw.length - strictMatch[1].length);
              }
          }
          
          if (match[6] !== 'Cr') finalAmount = -Math.abs(finalAmount);
          
          description = description.replace(/^[\d\-\.\s]+/, '').trim();
          if (!description) description = "Transaction";

          const dateStr = `${match[3]}/${match[2]}/${match[1]}`;

          transactions.push({
            date: dateStr,
            description: description,
            amount: finalAmount,
            balance: parseFloat(balanceRaw),
            account: account,
            bankName: "FNB",
            clientName: clientName,
            uniqueDocNo: uniqueDocNo
          });
      }
  }

  return transactions;
};