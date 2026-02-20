/**
 * Standard Bank Parser
 * Strategy: Money-first + balance-driven correction (FNB style)
 */

export const parseStandardBank = (text) => {
  const transactions = [];

  const parseNum = (val) => {
    if (!val) return 0;
    let clean = val.replace(/[\s,]/g, '');
    let isNeg = clean.endsWith('-');
    clean = clean.replace(/[^0-9.]/g, '');
    const num = parseFloat(clean) || 0;
    return isNeg ? -Math.abs(num) : Math.abs(num);
  };

  const accountMatch = text.match(/Account Number\s+([\d\s]+)/i);
  const account = accountMatch ? accountMatch[1].replace(/\s/g, '') : "Unknown";

  const periodMatch = text.match(/Statement from .*? (\d{4})/);
  const year = periodMatch ? periodMatch[1] : new Date().getFullYear();

  const openMatch = text.match(/BALANCE BROUGHT FORWARD.*?([\d,.-]+)/i);
  const openingBalance = openMatch ? parseNum(openMatch[1]) : 0;

  const closeMatch = text.match(/Balance outstanding.*?([\d,.-]+)/i);
  const closingBalance = closeMatch ? parseNum(closeMatch[1]) : 0;

  const moneyRegex = /(.+?)\s+([\d,.\-]+)\s+(\d{2})\s+(\d{2})\s+([\d,.\-]+)/g;

  let match;
  let runningBalance = openingBalance;

  while ((match = moneyRegex.exec(text)) !== null) {
    let description = match[1].trim();
    const amount = parseNum(match[2]);
    const month = match[3].padStart(2, '0');
    const day = match[4].padStart(2, '0');
    const balance = parseNum(match[5]);

    if (description.toLowerCase().includes("balance brought forward"))
      continue;

    const formattedDate = `${day}/${month}/${year}`;

    const expectedDiff = balance - runningBalance;
    let finalAmount = amount;

    if (Math.abs(expectedDiff - amount) > 0.05) {
      finalAmount = expectedDiff;
    }

    runningBalance = balance;

    transactions.push({
      date: formattedDate,
      description,
      amount: finalAmount,
      balance,
      account,
      bankName: "Standard Bank"
    });
  }

  return {
    metadata: {
      accountNumber: account,
      openingBalance,
      closingBalance,
      bankName: "Standard Bank"
    },
    transactions
  };
};