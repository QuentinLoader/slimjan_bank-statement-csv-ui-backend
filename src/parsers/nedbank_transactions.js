// src/parsers/nedbank_transactions.js

export function parseNedbank(text, sourceFile = "") {
  if (!text || typeof text !== "string") {
    return { metadata: {}, transactions: [] };
  }

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  // ── Metadata extraction ──────────────────────────────────────────────────
  let accountNumber = "";
  let clientName = "";
  let bankName = "Nedbank";
  let statementId = "";
  let openingBalance = null;
  let closingBalance = null;

  // Account number: "Current account  1605175781"  or  "Account number  1605175781"
  const accountMatch = text.match(/(?:Current account|Account number)[^\d]*(\d{8,12})/i);
  if (accountMatch) accountNumber = accountMatch[1];

  // Client name: line starting with "Mr" / "Mrs" / "Ms" / "Dr" before the address block
  const nameMatch = text.match(/^((?:Mr|Mrs|Ms|Dr|Prof)\.?\s+[A-Z][A-Z\s]+)$/m);
  if (nameMatch) clientName = nameMatch[1].trim();

  // Statement ID: envelope or statement number near "Envelope"
  const envMatch = text.match(/Envelope[:\s]+(\d+)\s+of\s+\d+/i);
  if (envMatch) statementId = envMatch[1];

  // ── Transaction parsing ──────────────────────────────────────────────────
  const transactions = [];

  // Date at the START of the line (after optional tran-list number + spaces)
  // Tran list lines look like:  "000643 26/06/2025 VAT ..."
  // Normal lines look like:     "26/06/2025 MAINTENANCE FEE ..."
  const lineRegex = /^(?:\d+\s+)?(\d{2}\/\d{2}\/\d{4})\s+(.+)$/;

  // Money value: optional leading minus, digits with optional comma-thousands, dot-cents
  //   e.g.  343.27  |  11,369.18  |  250.00
  const moneyVal = /-?\d{1,3}(?:,\d{3})*\.\d{2}/g;

  let previousBalance = null;

  for (const line of lines) {
    const lineMatch = line.match(lineRegex);
    if (!lineMatch) continue;

    const date = lineMatch[1];
    const rest = lineMatch[2];

    // ── Opening balance ────────────────────────────────────────────────────
    if (/opening balance/i.test(rest)) {
      const money = rest.match(moneyVal);
      if (money) {
        openingBalance = parseMoney(money[money.length - 1]);
        previousBalance = openingBalance;
      }
      continue; // don't emit as a transaction
    }

    // ── Closing balance ────────────────────────────────────────────────────
    if (/closing balance/i.test(rest)) {
      const money = rest.match(moneyVal);
      if (money) closingBalance = parseMoney(money[money.length - 1]);
      continue;
    }

    // ── VAT / informational lines (no debit or credit movement) ───────────
    // e.g. "VAT 28/05-25/06 = R41.73  0.00  343.27"  — balance unchanged, amount 0
    // We still want to capture these but they are noise; skip lines where the
    // second-to-last money value is 0.00 AND the description says VAT.
    // Actually: include them so the ledger is complete — they show 0 movement.

    // Collect all money values on the line
    const restClean = rest.replace(/\*/g, "").trim(); // strip asterisks
    const moneyMatches = restClean.match(moneyVal);

    // Need at least one money value to be a transaction line
    if (!moneyMatches || moneyMatches.length < 1) continue;

    // Balance is always the LAST money value on the line
    const balance = parseMoney(moneyMatches[moneyMatches.length - 1]);

    // Raw amount is the second-to-last, or same as balance if only one value
    let rawAmount = moneyMatches.length >= 2
      ? parseMoney(moneyMatches[moneyMatches.length - 2])
      : 0;

    // ── Description: everything before the money values ───────────────────
    // Find where the first money-like token starts in restClean and slice before it
    const firstMoneyIndex = restClean.search(/-?\d{1,3}(?:,\d{3})*\.\d{2}/);
    let description = firstMoneyIndex > 0
      ? restClean.slice(0, firstMoneyIndex).trim()
      : restClean;

    // Remove trailing asterisk or "Fees (R)" column artefacts
    description = description.replace(/\s*\*\s*$/, "").trim();

    // ── Determine sign from balance movement ──────────────────────────────
    let amount;
    if (previousBalance !== null) {
      const diff = parseFloat((balance - previousBalance).toFixed(2));
      // Use the actual diff so we capture fees correctly
      amount = diff;

      // Sanity: if rawAmount is 0 (VAT/info line) treat movement as 0
      if (rawAmount === 0 && diff === 0) amount = 0;
    } else {
      // No previous balance yet — use sign from balance direction vs raw
      amount = rawAmount;
    }

    previousBalance = balance;

    transactions.push({
      date,
      description,
      amount: parseFloat(amount.toFixed(2)),
      balance,
      account: accountNumber,
      clientName,
      statementId,
      bankName,
      sourceFile
    });
  }

  // Fallback closing balance from summary block
  if (closingBalance === null) {
    const cb = text.match(/Closing balance\s+R?([\d,]+\.\d{2})/i);
    if (cb) closingBalance = parseMoney(cb[1]);
  }

  return {
    metadata: {
      accountNumber,
      clientName,
      bankName,
      statementId,
      openingBalance,
      closingBalance,
      sourceFile
    },
    transactions
  };
}

function parseMoney(value) {
  if (typeof value !== "string") return 0;
  return parseFloat(value.replace(/,/g, ""));
}