/**
 * Each transaction object should include:
 * {
 *   "date": "01/02/2025",          // DD/MM/YYYY
 *   "description": "...",
 *   "amount": -150.00,             // negative for debits, positive for credits
 *   "balance": 6833.61,            // running balance after this transaction
 *   "account": "62854836693",      // account number
 *   "bankName": "FNB",
 *   "bankLogo": "fnb",
 *   "clientName": "...",
 *   "uniqueDocNo": "ST-12345",     // statement ID (not "Check Header")
 * }
 */

export const parseFnb = (text) => {
  const transactions = [];

  // 1. METADATA
  const accountMatch = text.match(/(\d{11})/);
  const account = accountMatch ? accountMatch[1] : "Unknown";

  const statementIdMatch = text.match(/BBST(\d+)/i);
  const statementId = statementIdMatch ? statementIdMatch[1] : "Unknown";

  const clientMatch = text.match(/\*([A-Z\s]+PROPERTIES[A-Z\s]*?)(?:\d|$)/);
  const clientName = clientMatch ? clientMatch[1].trim() : "Unknown";

  let statementYear = 2025;
  const yearMatch = text.match(/(\d{4})\/\d{2}\/\d{2}/);
  if (yearMatch) statementYear = parseInt(yearMatch[1]);

  // 2. FIND TRANSACTION SECTION
  const transStartMatch = text.match(/Transactions in RAND.*?(?:Date.*?Description.*?Amount.*?Balance|$)/is);
  if (!transStartMatch) return transactions;

  let transSection = text.substring(transStartMatch.index + transStartMatch[0].length);
  
  const closingMatch = transSection.match(/Closing Balance/i);
  if (closingMatch) {
    transSection = transSection.substring(0, closingMatch.index);
  }

  // 3. SPLIT BY DATES
  const dateSplitRegex = /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))/gi;
  const parts = transSection.split(dateSplitRegex);
  
  // 4. PROCESS EACH TRANSACTION
  for (let i = 1; i < parts.length; i += 2) {
    const dateStr = parts[i];
    const dataBlock = parts[i + 1] || "";
    
    if (dataBlock.length < 5) continue;
    
    // Skip headers
    const lower = dataBlock.toLowerCase();
    if (lower.includes('opening balance') || lower.includes('description')) continue;
    
    // Find all amounts (including reference numbers unfortunately)
    const amountRegex = /([\d,]+\.\d{2})(Cr)?/g;
    const allAmounts = [...dataBlock.matchAll(amountRegex)];
    
    if (allAmounts.length < 2) continue;
    
    // ENHANCED FILTERING
    const validAmounts = [];
    
    for (let j = 0; j < allAmounts.length; j++) {
      const match = allAmounts[j];
      const numStr = match[1].replace(/,/g, '');
      const num = parseFloat(numStr);
      const hasCr = match[2] === 'Cr';
      
      // Reject obvious reference numbers
      if (num > 100000000) continue; // > 100 million
      
      if (num >= 10000 && !match[1].includes(',') && !hasCr) continue;
      
      // Special case: phone numbers (10 digits, starts with 0)
      if (numStr.length === 12 && numStr.startsWith('0') && !match[1].includes(',')) continue;
      
      const beforeIndex = match.index;
      const afterIndex = match.index + match[0].length;
      const charBefore = beforeIndex > 0 ? dataBlock[beforeIndex - 1] : ' ';
      const charAfter = afterIndex < dataBlock.length ? dataBlock[afterIndex] : ' ';
      
      if (/[a-zA-Z0-9]/.test(charBefore) && /[a-zA-Z0-9]/.test(charAfter)) {
        if (!hasCr) continue;
      }
      
      validAmounts.push(match);
    }
    
    if (validAmounts.length < 2) continue;
    
    let amountMatch, balanceMatch;
    
    const lastAmt = validAmounts[validAmounts.length - 1];
    const lastVal = parseFloat(lastAmt[1].replace(/,/g, ''));
    
    if (validAmounts.length >= 3 && lastVal < 50 && !lastAmt[2]) {
      amountMatch = validAmounts[validAmounts.length - 3];
      balanceMatch = validAmounts[validAmounts.length - 2];
    } else {
      amountMatch = validAmounts[validAmounts.length - 2];
      balanceMatch = validAmounts[validAmounts.length - 1];
    }
    
    // Extract description
    const descEnd = dataBlock.indexOf(amountMatch[0]);
    let description = dataBlock.substring(0, descEnd).trim();
    
    description = description.replace(/\s+/g, ' ').trim();
    description = description.replace(/^[\d\s,\.;:]+/, '').trim();
    
    if (description.length < 3) continue;
    
    // Parse amount
    let amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    if (amount > 1000000000) continue;
    
    if (amountMatch[2] === 'Cr') {
      amount = Math.abs(amount);
    } else {
      amount = -Math.abs(amount);
    }
    
    // Parse balance
    const balance = parseFloat(balanceMatch[1].replace(/,/g, ''));
    if (balance > 1000000000) continue;
    
    // Format date
    const [day, monthName] = dateStr.split(/\s+/);
    const monthMap = {
      jan: "01", feb: "02", mar: "03", apr: "04",
      may: "05", jun: "06", jul: "07", aug: "08",
      sep: "09", oct: "10", nov: "11", dec: "12"
    };
    const month = monthMap[monthName.toLowerCase().substring(0, 3)] || "01";
    const formattedDate = `${day.padStart(2, '0')}/${month}/${statementYear}`;
    
    transactions.push({
      date: formattedDate,
      description: description,
      amount: amount,
      balance: balance,
      account: account,
      bankName: "FNB",
      bankLogo: "fnb",
      clientName: clientName,
      uniqueDocNo: statementId     // using BBST##### format from statement
    });
  }

  return transactions;
};