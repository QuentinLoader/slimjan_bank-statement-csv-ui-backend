/**
 * FNB "Strict Split" Parser
 * * Fixes the 27 Trillion Rand error.
 * * Strategy:
 * 1. If an amount is suspiciously huge (> 10 million), we don't just check if it's a number.
 * 2. We STRICTLY slice off only the last few digits (max 7 digits + decimals) as the Amount.
 * 3. The rest is forced back into the Description.
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
  let cleanText = text
    .replace(/\s+/g, ' ') 
    .replace(/Page \d+ of \d+/gi, ' ') 
    .replace(/Transactions in RAND/i, ' ');

  // ===========================================================================
  // 3. PARSING LOGIC
  // ===========================================================================
  
  const flatRegex = /(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*(.*?)\s*([0-9\s,]+\.[0-9]{2})\s*(Cr|Dr)?\s*([0-9\s,]+\.[0-9]{2})\s*(Cr|Dr)?/gi;

  let match;
  while ((match = flatRegex.exec(cleanText)) !== null) {
    const day = match[1].padStart(2, '0');
    const monthRaw = match[2];
    let description = match[3].trim();
    let amountRaw = match[4].replace(/[\s,]/g, '');
    const amountSign = match[5]; 
    let balanceRaw = match[6].replace(/[\s,]/g, '');
    
    let finalAmount = parseFloat(amountRaw);
    
    // --- STRICT SPLIT LOGIC ---
    // If Amount > 10 Million, we assume it's a merge error.
    if (finalAmount > 10000000) {
        // Regex: Capture only the last 1-7 digits before the dot.
        // This limits the max auto-corrected amount to 9,999,999.99
        const strictMatch = amountRaw.match(/(\d{1,7}\.\d{2})$/);
        
        if (strictMatch) {
            const realAmountStr = strictMatch[1];
            finalAmount = parseFloat(realAmountStr);
            
            // Calculate the prefix (Reference Number)
            const prefixDigits = amountRaw.substring(0, amountRaw.length - realAmountStr.length);
            
            // Append the reference to the description
            description = description + " " + prefixDigits;
        }
    }

    // --- Standard Processing ---
    if (description.toLowerCase().includes('opening balance')) continue;
    if (description.length > 150) continue; 
    description = description.replace(/^[\d\-\.\s]+/, '').trim();

    const months = { Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06', Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12' };
    const month = months[monthRaw] || months[monthRaw.substring(0,3)];
    let txYear = currentYear;
    if (month === '12' && new Date().getMonth() < 3) txYear = currentYear - 1;
    const dateStr = `${day}/${month}/${txYear}`;

    let balance = parseFloat(balanceRaw);

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
  
  // Keep the fallback logic for YYYY/MM/DD if needed (omitted for brevity, assume strictly kept)
  if (transactions.length === 0) {
      // ... (Paste your existing ISO fallback here if needed)
  }

  return transactions;
};