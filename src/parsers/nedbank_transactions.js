// src/parsers/nedbank_transactions.js

export function parseNedbank(text) {
  if (!text || typeof text !== "string") {
    return { metadata: {}, transactions: [] };
  }

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  const transactions = [];
  let openingBalance = null;
  let closingBalance = null;

  const dateRegex = /^\d{2}\/\d{2}\/\d{4}/;
  const moneyRegex = /-?\d{1,3}(?:,\d{3})*(?:\.\d{2})/g;

  let previousBalance = null;

  for (const line of lines) {

    if (!dateRegex.test(line)) continue;

    // Opening balance
    if (line.toLowerCase().includes("opening balance")) {
      const money = line.match(moneyRegex);
      if (money) {
        openingBalance = parseMoney(money[money.length - 1]);
        previousBalance = openingBalance;
      }
      continue;
    }

    const moneyMatches = line.match(moneyRegex);
    if (!moneyMatches || moneyMatches.length < 2) continue;

    const balance = parseMoney(moneyMatches[moneyMatches.length - 1]);
    const rawAmount = parseMoney(moneyMatches[moneyMatches.length - 2]);

    let description = line.replace(dateRegex, "").trim();
    description = description.replace(
      new RegExp(`${moneyMatches[moneyMatches.length - 2]}\\s*\\*?\\s*${moneyMatches[moneyMatches.length - 1]}$`),
      ""
    ).trim();

    let amount = rawAmount;

    if (previousBalance !== null) {
      if (balance > previousBalance) {
        amount = Math.abs(rawAmount);   // Credit
      } else {
        amount = -Math.abs(rawAmount);  // Debit
      }
    }

    previousBalance = balance;

    transactions.push({
      date: line.match(dateRegex)[0],
      description,
      amount,
      balance
    });
  }

  const closingMatch = text.match(/Closing balance\s+(-?\d{1,3}(?:,\d{3})*(?:\.\d{2}))/);
  if (closingMatch) {
    closingBalance = parseMoney(closingMatch[1]);
  }

  return {
    metadata: {
      openingBalance,
      closingBalance
    },
    transactions
  };
}

function parseMoney(value) {
  return parseFloat(value.replace(/,/g, ""));
}