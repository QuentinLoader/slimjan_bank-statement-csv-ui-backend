// src/parsers/nedbank_transactions.js

export function parseNedbank(text) {
  if (!text || typeof text !== "string") return { metadata: {}, transactions: [] };

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  const transactions = [];
  let openingBalance = null;
  let closingBalance = null;

  const dateLineRegex = /^(\d{2}\/\d{2}\/\d{4})\s+(.*)$/;
  const moneyRegex = /-?\d{1,3}(?:,\d{3})*(?:\.\d{2})/g;

  for (const line of lines) {
    const dateMatch = line.match(dateLineRegex);
    if (!dateMatch) continue;

    const date = dateMatch[1];
    const rest = dateMatch[2];

    // Opening balance
    if (rest.toLowerCase().includes("opening balance")) {
      const money = rest.match(moneyRegex);
      if (money) {
        openingBalance = parseMoney(money[money.length - 1]);
      }
      continue;
    }

    const moneyMatches = rest.match(moneyRegex);
    if (!moneyMatches || moneyMatches.length < 1) continue;

    // Last number = balance
    const balance = parseMoney(moneyMatches[moneyMatches.length - 1]);

    // Second last number = transaction amount (if exists)
    let amount = null;
    if (moneyMatches.length >= 2) {
      amount = parseMoney(moneyMatches[moneyMatches.length - 2]);
    } else {
      continue;
    }

    // Remove trailing money values from description
    const description = rest.replace(moneyRegex, "").replace(/\*/g, "").trim();

    transactions.push({
      date,
      description,
      amount,
      balance
    });
  }

  // Closing balance from final line
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