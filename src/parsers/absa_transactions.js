/**
 * ABSA Parser (Surgical & Context-Aware)
 * Fixes: 12/01/2026 being read as 02/01/2026, and merged reference numbers.
 */

export const parseAbsa = (text) => {
  const transactions = [];

  // 1. Pre-process: Separate text from numbers to prevent "Forward0,00"
  let cleanText = text
    .replace(/([a-zA-Z])([0-9])/g, '$1 $2')
    .replace(/([0-9])([a-zA-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ');

  // 2. Helper: Number Parser
  const parseAbsaNum = (val) => {
    if (!val) return 0;
    let clean = val.trim();
    let isNegative = clean.endsWith('-');
    if (isNegative) clean = clean.substring(0, clean.length - 1);
    clean = clean.replace(/[^0-9,.-]/g, '').replace(',', '.');
    let num = parseFloat(clean);
    return isNegative ? -Math.abs(num) : num;
  };

  // 3. Metadata
  const accountMatch = text.match(/Account\D*?([\d-]{10,})/i) || text.match(/(\d{2}-\d{4}-\d{4})/);
  let account = accountMatch ? accountMatch[1].replace(/-/g, '') : "Unknown";

  let openingBalance = 0;
  const openMatch = cleanText.match(/Balance Brought Forward.*?([0-9\s]+,[0-9]{2}-?)/i);
  if (openMatch) openingBalance = parseAbsaNum(openMatch[1]);

  let closingBalance = 0;
  const closeMatch = cleanText.match(/Charges.*?Balance\s*([0-9\s]+,[0-9]{2}-?)/i);
  if (closeMatch) closingBalance = parseAbsaNum(closeMatch[1]);

  // 4. Parsing Logic (The Split Fix)
  // Split by Date but keep the 1-digit/2-digit flexibility
  const chunks = cleanText.split(/(?=\d{1,2}\/\d{2}\/\d{4})/);

  let runningBalance = openingBalance;

  chunks.forEach((chunk, index) => {
    let dateMatch = chunk.match(/^(\d{1,2})\/(\d{2})\/(\d{4})/);
    if (!dateMatch) return;

    let day = dateMatch[1];
    // REPAIR MASHED 1: Check if the previous chunk ended in a '1'
    if (index > 0 && day.length === 1) {
       const prevChunk = chunks[index-1].trim();
       if (prevChunk.endsWith('1')) {
           day = '1' + day; // Re-attach the '1' from 12, 13, 14, etc.
       }
    }

    const dateStr = `${day.padStart(2, '0')}/${dateMatch[2]}/${dateMatch[3]}`;
    let rawContent = chunk.substring(dateMatch[0].length).trim();
    
    if (rawContent.toLowerCase().includes("balance brought forward")) return;

    // SCAVENGE NUMBERS
    const numRegex = /(\d{1,3}(?: \d{3})*[.,]\d{2}-?)/g;
    const allNums = rawContent.match(numRegex) || [];

    if (allNums.length === 0) return;

    let finalAmount = 0;
    let currentBalance = runningBalance;
    let matchedBalanceStr = "";
    let matchedAmountStr = "";

    // SMART SELECTION: Test pairs of numbers against the running balance
    // ABSA usually has: [Amount] [Balance] OR [Charge] [Amount] [Balance]
    // We work backwards from the end of the line.
    for (let i = allNums.length - 1; i >= 0; i--) {
        let balCandidate = parseAbsaNum(allNums[i]);
        
        // Check if any other number in the line makes the math work
        for (let j = i - 1; j >= 0; j--) {
            let amtCandidate = parseAbsaNum(allNums[j]);
            if (Math.abs(runningBalance + amtCandidate - balCandidate) < 0.05) {
                finalAmount = amtCandidate;
                currentBalance = balCandidate;
                matchedAmountStr = allNums[j];
                matchedBalanceStr = allNums[i];
                break;
            }
        }
        if (matchedBalanceStr) break;
    }

    // FALLBACK: If math check fails, take the last number as balance
    if (!matchedBalanceStr) {
        currentBalance = parseAbsaNum(allNums[allNums.length - 1]);
        finalAmount = currentBalance - runningBalance;
    }

    // Description Cleanup
    let description = rawContent
        .replace(matchedBalanceStr, '')
        .replace(matchedAmountStr, '')
        .replace(numRegex, '')
        .replace(/^\)\s*/, '')
        .replace(/\s+/g, ' ')
        .trim();

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
    metadata: { accountNumber: account, openingBalance, closingBalance, bankName: "ABSA" },
    transactions
  };
};