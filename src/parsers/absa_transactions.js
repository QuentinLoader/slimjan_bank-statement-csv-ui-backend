/**
 * ABSA Parser (Railway Final)
 * Fixes: Mashed 12th-of-month dates and Footer description leaks.
 */

export const parseAbsa = (text) => {
  const transactions = [];

  // 1. Pre-process: Separate text from numbers to fix "Forward0,00"
  let cleanText = text
    .replace(/([a-zA-Z])([0-9])/g, '$1 $2')
    .replace(/([0-9])([a-zA-Z])/g, '$1 $2')
    .replace(/(\.\d{2})([0-9])/g, '$1 $2') // Fix merged amounts
    .replace(/\s+/g, ' ');

  // 2. Metadata Extraction
  const accountMatch = text.match(/Account\D*?([\d-]{10,})/i) || text.match(/(\d{2}-\d{4}-\d{4})/);
  let account = accountMatch ? accountMatch[1].replace(/-/g, '') : "Unknown";

  const parseNum = (val) => {
    if (!val) return 0;
    let clean = val.trim();
    let isNeg = clean.endsWith('-');
    clean = clean.replace(/[^0-9,.-]/g, '').replace(',', '.');
    return isNeg ? -Math.abs(parseFloat(clean)) : parseFloat(clean);
  };

  let openingBalance = 0;
  const openMatch = cleanText.match(/Balance Brought Forward.*?([0-9\s]+,[0-9]{2}-?)/i);
  if (openMatch) openingBalance = parseNum(openMatch[1]);

  let closingBalance = 0;
  const closeMatch = cleanText.match(/Charges.*?Balance\s*([0-9\s]+,[0-9]{2}-?)/i);
  if (closeMatch) closingBalance = parseNum(closeMatch[1]);

  // 3. Parsing Logic
  // Split by Date (1 or 2 digits)
  const chunks = cleanText.split(/(?=\d{1,2}\/\d{2}\/\d{4})/);
  let runningBalance = openingBalance;

  chunks.forEach((chunk, index) => {
    let dateMatch = chunk.match(/^(\d{1,2})\/(\d{2})\/(\d{4})/);
    if (!dateMatch) return;

    let day = dateMatch[1];
    // FIX THE "12th" BUG: Check if the text immediately before the split was a '1'
    if (day.length === 1 && index > 0) {
        if (chunks[index-1].trim().endsWith('1')) {
            day = '1' + day;
        }
    }

    const dateStr = `${day.padStart(2, '0')}/${dateMatch[2]}/${dateMatch[3]}`;
    let rawContent = chunk.substring(dateMatch[0].length).trim();
    
    if (rawContent.toLowerCase().includes("balance brought forward")) return;

    // Scavenge Numbers
    const numRegex = /(\d{1,3}(?: \d{3})*[.,]\d{2}-?)/g;
    const allNums = rawContent.match(numRegex) || [];
    if (allNums.length === 0) return;

    let finalAmount = 0;
    let currentBalance = runningBalance;
    let matchedBalanceStr = "";
    let matchedAmountStr = "";

    // Work backwards to find Balance that satisfies (Prev + Amt = New)
    for (let i = allNums.length - 1; i >= 0; i--) {
        let balCandidate = parseNum(allNums[i]);
        for (let j = i - 1; j >= 0; j--) {
            let amtCandidate = parseNum(allNums[j]);
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

    // Default if math fails
    if (!matchedBalanceStr) {
        currentBalance = parseNum(allNums[allNums.length - 1]);
        finalAmount = currentBalance - runningBalance;
    }

    // 4. CLEAN DESCRIPTION (Prevent Footer Leak)
    const stopWords = ["Our Privacy Notice", "Cheque account statement", "Return address", "Page 1", "Registration Number", "Tax Invoice"];
    let description = rawContent.replace(matchedBalanceStr, '').replace(matchedAmountStr, '').replace(numRegex, '');

    stopWords.forEach(word => {
      const idx = description.indexOf(word);
      if (idx !== -1) description = description.substring(0, idx);
    });

    description = description.replace(/\s+/g, ' ').replace(/^\W+/, '').trim();
    runningBalance = currentBalance;

    transactions.push({
      date: dateStr,
      description: description || "Transaction",
      amount: finalAmount,
      balance: currentBalance,
      account: account,
      bankName: "ABSA"
    });
  });

  return { metadata: { accountNumber: account, openingBalance, closingBalance, bankName: "ABSA" }, transactions };
};