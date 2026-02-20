/**
 * Capitec Parser - Revised for Real Main Account Statement Format
 * Strategy: Date-based split + balance-driven extraction
 */

export const parseCapitec = (text) => {
  const transactions = [];

  const parseNum = (val) => {
    if (!val) return 0;
    let clean = val.replace(/[\s,]/g, '');
    let isNeg = clean.startsWith('-');
    clean = clean.replace(/[^0-9.]/g, '');
    const num = parseFloat(clean) || 0;
    return isNeg ? -Math.abs(num) : Math.abs(num);
  };

  const accountMatch = text.match(/Account\s+(\d{10,})/i);
  const account = accountMatch ? accountMatch[1] : "Unknown";

  const openMatch = text.match(/Opening Balance:\s*R?([\d\s,.]+)/i);
  const closeMatch = text.match(/Closing Balance:\s*R?([\d\s,.]+)/i);

  const openingBalance = openMatch ? parseNum(openMatch[1]) : 0;
  const closingBalance = closeMatch ? parseNum(closeMatch[1]) : 0;

  const chunks = text.split(/(?=\d{2}\/\d{2}\/\d{4})/);

  let runningBalance = openingBalance;

  chunks.forEach(chunk => {
    const dateMatch = chunk.match(/^(\d{2}\/\d{2}\/\d{4})/);
    if (!dateMatch) return;

    const date = dateMatch[1];
    let body = chunk.substring(date.length).trim();

    const numRegex = /(-?\d[\d\s,.]*)/g;
    const numbers = body.match(numRegex);
    if (!numbers || numbers.length === 0) return;

    const balance = parseNum(numbers[numbers.length - 1]);

    let amount = 0;
    if (numbers.length >= 2) {
      const candidate = parseNum(numbers[numbers.length - 2]);
      if (Math.abs(runningBalance + candidate - balance) < 0.05) {
        amount = candidate;
      } else {
        amount = balance - runningBalance;
      }
    } else {
      amount = balance - runningBalance;
    }

    let description = body;
    numbers.forEach(n => {
      description = description.replace(n, '');
    });

    description = description.replace(/\s+/g, ' ').trim();
    runningBalance = balance;

    transactions.push({
      date,
      description: description || "Transaction",
      amount,
      balance,
      account,
      bankName: "Capitec"
    });
  });

  return {
    metadata: {
      accountNumber: account,
      openingBalance,
      closingBalance,
      bankName: "Capitec"
    },
    transactions
  };
};