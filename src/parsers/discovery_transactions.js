/**
 * Discovery Bank Parser
 * Strategy: Line-based parsing (Money-last format)
 * Format observed:
 * 8 Jan 2026 Description ... R97.50
 * 8 Jan 2026 Description ... - R80.00
 */

export const parseDiscovery = (text) => {
  const transactions = [];

  const parseAmount = (val) => {
    if (!val) return 0;
    let clean = val.replace(/R/g, '').replace(/\s/g, '');
    let isNeg = clean.includes('-');
    clean = clean.replace(/[^0-9.]/g, '');
    const num = parseFloat(clean) || 0;
    return isNeg ? -Math.abs(num) : Math.abs(num);
  };

  // Metadata
  const accountMatch = text.match(/Discovery Gold Transaction Account\s+(\d+)/i);
  const account = accountMatch ? accountMatch[1] : "Unknown";

  const openMatch = text.match(/Opening balance.*?R([\d.,]+)/i);
  const closingMatch = text.match(/Closing balance.*?R([\d.,]+)/i);

  const openingBalance = openMatch ? parseAmount(openMatch[1]) : 0;
  const closingBalance = closingMatch ? parseAmount(closingMatch[1]) : 0;

  const months = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04',
    May: '05', Jun: '06', Jul: '07', Aug: '08',
    Sep: '09', Oct: '10', Nov: '11', Dec: '12'
  };

  const lines = text.split('\n');

  const txRegex = /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(20\d{2})\s+(.+?)\s+(-?\s?R[\d\s,.]+)/;

  lines.forEach(line => {
    const match = line.match(txRegex);
    if (!match) return;

    const day = match[1].padStart(2, '0');
    const month = months[match[2]];
    const year = match[3];
    const description = match[4].trim();
    const amount = parseAmount(match[5]);

    transactions.push({
      date: `${day}/${month}/${year}`,
      description,
      amount,
      balance: null,
      account,
      bankName: "Discovery"
    });
  });

  return {
    metadata: {
      accountNumber: account,
      openingBalance,
      closingBalance,
      bankName: "Discovery"
    },
    transactions
  };
};