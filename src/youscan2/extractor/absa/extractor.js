import { normalizeWhitespace } from "../shared/utils.js";

function parseAbsaMoney(value) {
  if (!value) return null;

  let raw = String(value).trim();
  let negative = false;

  if (raw.endsWith("-")) {
    negative = true;
    raw = raw.slice(0, -1);
  }

  raw = raw.replace(/\s+/g, "");

  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");

  if (hasComma && hasDot) {
    raw = raw.replace(/,/g, "");
  } else if (hasComma && !hasDot) {
    raw = raw.replace(/\./g, "").replace(",", ".");
  }

  const num = Number(raw);
  if (Number.isNaN(num)) return null;

  return negative ? -Math.abs(num) : num;
}

function extractDate(line) {
  const match = line.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
  return match ? match[1] : null;
}

export function extractAbsaTransactions(text) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((l) => normalizeWhitespace(l))
    .filter(Boolean);

  const transactions = [];

  for (const line of lines) {
    const date = extractDate(line);
    if (!date) continue;

    // 🔥 find all money tokens (robust)
    const matches = [...line.matchAll(/\d[\d\s,.]*\d(?:[.,]\d{2})-?/g)];

    if (matches.length < 2) continue;

    const amountRaw = matches[matches.length - 2][0];
    const balanceRaw = matches[matches.length - 1][0];

    const amount = parseAbsaMoney(amountRaw);
    const balance = parseAbsaMoney(balanceRaw);

    if (amount === null || balance === null) continue;

    const descEndIndex = matches[matches.length - 2].index;
    const description = normalizeWhitespace(
      line.replace(date, "").slice(0, descEndIndex)
    );

    if (!description) continue;

    const lower = description.toLowerCase();

    if (
      lower.includes("proof of pmt") ||
      lower.includes("notific fee") ||
      lower.includes("smsnotifyme")
    ) {
      continue;
    }

    let finalAmount = amount;

    if (
      lower.includes("credit") ||
      lower.includes("cr") ||
      lower.includes("deposit")
    ) {
      finalAmount = Math.abs(amount);
    } else if (
      lower.includes("fee") ||
      lower.includes("charge") ||
      lower.includes("debit") ||
      lower.includes("pmt")
    ) {
      finalAmount = -Math.abs(amount);
    }

    transactions.push({
      date,
      description,
      amount: Number(finalAmount.toFixed(2)),
      balance: Number(balance.toFixed(2)),
    });
  }

  return transactions;
}