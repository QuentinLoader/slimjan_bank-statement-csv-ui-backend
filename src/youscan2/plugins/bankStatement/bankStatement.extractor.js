/**
 * YouScan 2.0
 * Bank statement extractor (ABSA + Standard Bank)
 */

function normalizeWhitespace(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function parseMoney(value) {
  if (!value) return null;

  const cleaned = String(value)
    .replace(/\s+/g, "")
    .replace(/,/g, "");

  const number = Number(cleaned);
  return Number.isNaN(number) ? null : number;
}

/* =========================
   METADATA
========================= */

function extractAccountNumber(text) {
  const patterns = [
    /account number[:\s]+([0-9]{6,20})/i,
    /acc(?:ount)?\s*(?:no|number)?[:\s]+([0-9]{6,20})/i,
    /account no[:\s]+([0-9]{6,20})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }

  return null;
}

function extractClientName(text) {
  const match = text.match(/([A-Z][A-Z\s]{5,})/);
  return match ? normalizeWhitespace(match[1]) : null;
}

function extractOpeningBalance(text) {
  const match = text.match(/(opening balance|balance brought forward)[^\d-]*(-?[0-9,]+\.\d{2})/i);
  return match ? parseMoney(match[2]) : null;
}

function extractClosingBalance(text) {
  const match = text.match(/(closing balance|final balance)[^\d-]*(-?[0-9,]+\.\d{2})/i);
  return match ? parseMoney(match[2]) : null;
}

/* =========================
   ABSA (existing logic)
========================= */

function looksLikeTransactionLine(line) {
  return /^\d{1,2}[\/-]\d{1,2}/.test(line.trim());
}

function extractAbsaTransactions(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const transactions = [];

  for (const line of lines) {
    if (!looksLikeTransactionLine(line)) continue;

    const dateMatch = line.match(/^(\d{1,2}[\/-]\d{1,2})/);
    if (!dateMatch) continue;

    const date = dateMatch[1];
    const rest = line.slice(date.length).trim();

    const numbers = [...rest.matchAll(/-?\d[\d,]*\.\d{2}/g)];
    if (numbers.length < 2) continue;

    const amount = parseMoney(numbers[numbers.length - 2][0]);
    const balance = parseMoney(numbers[numbers.length - 1][0]);

    const description = normalizeWhitespace(
      rest.slice(0, numbers[numbers.length - 2].index)
    );

    if (amount === null || balance === null) continue;

    transactions.push({ date, description, amount, balance });
  }

  return transactions;
}

/* =========================
   STANDARD BANK (NEW)
========================= */

function extractStandardBankTransactions(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const transactions = [];

  for (const line of lines) {
    // Standard Bank often: DD MMM or DD/MM/YYYY
    if (!/^\d{1,2}/.test(line)) continue;

    const parts = line.split(/\s{2,}|\t/);

    if (parts.length < 3) continue;

    const date = parts[0];
    const description = normalizeWhitespace(parts.slice(1, parts.length - 2).join(" "));

    const amount = parseMoney(parts[parts.length - 2]);
    const balance = parseMoney(parts[parts.length - 1]);

    if (amount === null || balance === null) continue;

    transactions.push({
      date,
      description,
      amount,
      balance,
    });
  }

  // Apply balance correction
  for (let i = 1; i < transactions.length; i++) {
    const prev = transactions[i - 1];
    const curr = transactions[i];

    const diff = Number((curr.balance - prev.balance).toFixed(2));

    if (diff !== 0) {
      curr.amount = diff;
    }
  }

  return transactions;
}

/* =========================
   MAIN ROUTER
========================= */

function extractTransactionsBySubtype(text, subtype) {
  if (subtype === "standard_bank_statement") {
    return extractStandardBankTransactions(text);
  }

  // default = ABSA-style
  return extractAbsaTransactions(text);
}

/* =========================
   ENTRY
========================= */

export async function extractBankStatement(context) {
  const {
    file,
    classification,
    extractedText = "",
    textPreview = "",
    extractionMeta = null,
  } = context;

  const subtype = classification.documentSubtype;

  const transactions = extractTransactionsBySubtype(extractedText, subtype);

  const openingBalance = extractOpeningBalance(extractedText);

  const closingBalance =
    extractClosingBalance(extractedText) ??
    (transactions.length
      ? transactions[transactions.length - 1].balance
      : null);

  return {
    sourceFileName: file?.originalname || "unknown.pdf",
    detectedSubtype: subtype,
    rawTextPreview: textPreview,
    rawText: extractedText,
    extractionMeta,
    metadata: {
      bankName: subtype || "unknown",
      accountNumber: extractAccountNumber(extractedText),
      clientName: extractClientName(extractedText),
      statementPeriodStart: null,
      statementPeriodEnd: null,
      openingBalance,
      closingBalance,
    },
    transactions,
  };
}