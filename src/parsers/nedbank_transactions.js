/**
 * Nedbank Parser
 * Strategy: Balance-driven verification (ABSA style)
 * Columns:
 * Date | Description | Fees | Debits | Credits | Balance
 */

export const parseNedbank = (text) => {
  const transactions = [];

  const parseNum = (val) => {
    if (!val) return 0;
    let clean = val.replace(/[\s,]/g, '');
    return parseFloat(clean) || 0;
  };

  const accountMatch = text.match(/Current account\s+(\d+)/i);
  const account = accountMatch ? accountMatch[1] : "Unknown";

  const openMatch = text.match(/Opening balance\s+R?([\d.,]+)/i);
  const closeMatch = text.match(/Closing balance\s+R?([\d.,]+)/i);

  const openingBalance = openMatch ? parseNum(openMatch[1]) : 0;
  const closingBalance = closeMatch ? parseNum(closeMatch[1]) : 0;

  const lines = text.split('\n');
  let runningBalance = openingBalance;

  const txRegex = /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([\d,.\*]*)\s*([\d,.\*]*)\s*([\d,.\*]*)\s+([\d,.-]+)/;

  lines.forEach(line => {
    const match = line.match(txRegex);
    if (!match) return;

    const date = match[1];
    let description = match[2].trim();
    const debit = parseNum(match[4]);
    const credit = parseNum(match[5]);
    const balance = parseNum(match[6].replace('-', ''));

    let amount = 0;
    if (credit > 0) amount = credit;
    else if (debit > 0) amount = -debit;
    else amount = balance - runningBalance;

    runningBalance = balance;

    transactions.push({
      date,
      description,
      amount,
      balance,
      account,
      bankName: "Nedbank"
    });
  });

  return {
    metadata: {
      accountNumber: account,
      openingBalance,
      closingBalance,
      bankName: "Nedbank"
    },
    transactions
  };
};