/**
 * ABSA Parser (Surgical Footer Control)
 * Fixes: 12/01/2026 description leak & mashed numbers.
 */

export const parseAbsa = (text) => {
  const transactions = [];

  // 1. Pre-process: Isolate dates and numbers
  let cleanText = text
    .replace(/([a-zA-Z])([0-9])/g, '$1 $2')
    .replace(/([0-9])([a-zA-Z])/g, '$1 $2')
    // Fix merged amount/balance like 5.5078.20
    .replace(/(\.\d{2})([0-9])/g, '$1 $2')
    .replace(/\s+/g, ' ');

  // 2. Helper: Number Parser
  const parseAbsaNum = (val) => {
    if (!val) return 0;
    let clean = val.trim();
    let isNegative = clean.endsWith('-');
    if (isNegative) clean = clean.substring(0, clean.length - 1);
    clean = clean.replace(/[^0-9,.-]/g, '').replace(',', '.');
    return isNegative ? -Math.abs(parseFloat(clean)) : parseFloat(clean);
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

  // 4. Parsing Logic (The Split)
  const chunks = cleanText.split(/(?=\d{1,2}\/\d{2}\/\d{4})/);
  let runningBalance = openingBalance;

  chunks.forEach((chunk, index) => {
    let dateMatch = chunk.match(/^(\d{1,2})\/(\d{2})\/(\d{4})/);
    if (!dateMatch) return;

    let day = dateMatch[1];
    // Repair 12/01/2026 split issue
    if (index > 0 && day.length === 1 && chunks[index-1].trim().endsWith('1')) {
        day = '1' + day;
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

    // Math check for Balance vs Amount
    for (let i = allNums.length - 1; i >= 0; i--) {
        let balCandidate = parseAbsaNum(allNums[i]);
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

    if (!matchedBalanceStr) {
        currentBalance = parseAbsaNum(allNums[allNums.length - 1]);
        finalAmount = currentBalance - runningBalance;
    }

    // 5. FOOTER CONTROL: Stop the description from leaking
    const stopWords = [
      "Cheque account statement", "Return address", "Our Privacy Notice", 
      "Account Type", "Issued on", "Statement no", "Client VAT", 
      "Balance Overdraft", "Page 1", "Registration Number"
    ];

    let description = rawContent
        .replace(matchedBalanceStr, '')
        .replace(matchedAmountStr, '')
        .replace(numRegex, '');

    // Cut off description at first stop word
    stopWords.forEach(word => {
      const stopIndex = description.indexOf(word);
      if (stopIndex !== -1) {
        description = description.substring(0, stopIndex);
      }
    });

    description = description
        .replace(/\s+/g, ' ')
        .replace(/^\W+/, '') // Remove leading symbols
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