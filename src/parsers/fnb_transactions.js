/**
 * FNB "Smart Split" Parser
 * * Fixes "Greedy Number" bug where phone numbers merge with amounts.
 * * Strategy:
 * 1. Flattens text to handle broken layouts.
 * 2. Detects "Suspiciously Large Amounts" (e.g. > 10 million).
 * 3. Splits merged strings: "0831234567500.00" -> Desc: "0831234567", Amt: "500.00".
 */

export const parseFnb = (text) => {
  const transactions = [];

  // ===========================================================================
  // 1. METADATA
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

  // ===========================================================================
  // 2. TEXT FLATTENING
  // ===========================================================================
  // Collapse all whitespace to single spaces. 
  // This is crucial for FNB PDFs where columns drift.
  let cleanText = text
    .replace(/\s+/g, ' ') 
    .replace(/Page \d+ of \d+/gi, ' ') 
    .replace(/Transactions in RAND/i, ' ');

  // ===========================================================================
  // 3. PARSING LOGIC
  // ===========================================================================
  // Regex: 
  // We capture the "Amount" as a raw string first, to check for merges later.
  // Group 1: Date
  // Group 3: Description
  // Group 4: Amount Raw String (could be "083...500.00")
  // Group 6: Balance Raw String
  
  const flatRegex = /(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*(.*?)\s*([0-9\s,]+\.[0-9]{2})\s*(Cr|Dr)?\s*([0-9\s,]+\.[0-9]{2})\s*(Cr|Dr)?/gi;

  let match;
  while ((match = flatRegex.exec(cleanText)) !== null) {
    const day = match[1].padStart(2, '0');
    const monthRaw = match[2];
    let description = match[3].trim();
    let amountRaw = match[4].replace(/[\s,]/g, ''); // Strip spaces/commas for analysis
    const amountSign = match[5]; 
    let balanceRaw = match[6].replace(/[\s,]/g, '');
    
    // --- SMART SPLIT LOGIC ---
    // Problem: "27839489137350.00" is parsed as one number.
    // Solution: If amount is > 10,000,000 (unlikely for this client), check for merge.
    
    let finalAmount = parseFloat(amountRaw);
    
    // Heuristic: If Amount > 10 Million, it's probably a Phone Number + Amount
    if (finalAmount > 10000000) {
        // We look for the last valid price pattern (.XX) in the string
        const splitMatch = amountRaw.match(/(\d+\.\d{2})$/);
        
        if (splitMatch) {
            const realAmountStr = splitMatch[1];
            
            // Check if the "Real Amount" is reasonable (e.g. < 1 million)
            // and implies the rest is a reference.
            if (parseFloat(realAmountStr) < 1000000) {
                // 1. Set the new, correct amount
                finalAmount = parseFloat(realAmountStr);
                
                // 2. Move the prefix digits back to Description
                // The prefix is the original string minus the real amount part
                const prefixDigits = amountRaw.substring(0, amountRaw.length - realAmountStr.length);
                description = description + " " + prefixDigits;
            }
        }
    }

    // --- Standard Processing ---
    
    // Validation
    if (description.toLowerCase().includes('opening balance')) continue;
    if (description.length > 150) continue; 
    
    // Description Cleanup (remove leading loose numbers/dates)
    description = description.replace(/^[\d\-\.\s]+/, '').trim();

    // Date
    const months = { Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06', Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12' };
    const month = months[monthRaw] || months[monthRaw.substring(0,3)];
    let txYear = currentYear;
    if (month === '12' && new Date().getMonth() < 3) txYear = currentYear - 1;
    const dateStr = `${day}/${month}/${txYear}`;

    // Balance
    let balance = parseFloat(balanceRaw);

    // Signs
    if (amountSign === 'Cr') {
      finalAmount = Math.abs(finalAmount);
    } else {
      finalAmount = -Math.abs(finalAmount);
    }

    transactions.push({
      date: dateStr,
      description: description,
      amount: finalAmount,
      balance: balance,
      account: account,
      bankName: "FNB",
      clientName: clientName,
      uniqueDocNo: uniqueDocNo
    });
  }
  
  // Fallback for YYYY/MM/DD dates if needed (same as before)
  if (transactions.length === 0) {
       // ... existing fallback code ...
       const isoRegex = /(\d{4})\/(\d{2})\/(\d{2})\s*(.*?)\s*([0-9\s,]+\.[0-9]{2})\s*(Cr|Dr)?\s*([0-9\s,]+\.[0-9]{2})\s*(Cr|Dr)?/gi;
      while ((match = isoRegex.exec(cleanText)) !== null) {
          let description = match[4].trim();
          let amountRaw = match[5].replace(/[\s,]/g, '');
          let balanceRaw = match[7].replace(/[\s,]/g, '');
          
          let finalAmount = parseFloat(amountRaw);
          // Apply same smart split logic here if needed
          if (finalAmount > 10000000) {
             const splitMatch = amountRaw.match(/(\d+\.\d{2})$/);
             if (splitMatch) {
                finalAmount = parseFloat(splitMatch[1]);
                description = description + " " + amountRaw.substring(0, amountRaw.length - splitMatch[1].length);
             }
          }
          
          if (match[6] !== 'Cr') finalAmount = -Math.abs(finalAmount);
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