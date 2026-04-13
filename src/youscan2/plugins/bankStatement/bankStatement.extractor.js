/**
 * YouScan 2.0
 * Bank statement extractor
 */

function extractAccountNumber(text) {
  const patterns = [
    /account number[:\s]+([0-9]{6,20})/i,
    /acc(?:ount)?\s*(?:no|number)?[:\s]+([0-9]{6,20})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }

  return null;
}

function extractClientName(text) {
  const patterns = [
    /account holder[:\s]+([A-Z][A-Z\s'.-]{3,60})/i,
    /customer name[:\s]+([A-Z][A-Z\s'.-]{3,60})/i,
    /name[:\s]+([A-Z][A-Z\s'.-]{3,60})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }

  return null;
}

function extractBalance(label, text) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`${escaped}[:\\s]+(-?[0-9,]+\\.?[0-9]{0,2})`, "i");
  const match = text.match(regex);

  if (!match) return null;

  const value = Number(match[1].replace(/,/g, ""));
  return Number.isNaN(value) ? null : value;
}

function extractStatementPeriod(text) {
  const patterns = [
    /statement period[:\s]+([0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{2,4})\s+(?:to|-)\s+([0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{2,4})/i,
    /period[:\s]+([0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{2,4})\s+(?:to|-)\s+([0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{2,4})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        start: match[1],
        end: match[2],
      };
    }
  }

  return {
    start: null,
    end: null,
  };
}

function parseMoney(value) {
  if (!value) return null;

  const cleaned = String(value)
    .replace(/\s+/g, "")
    .replace(/,/g, "");

  const number = Number(cleaned);
  return Number.isNaN(number) ? null : number;
}

function looksLikeTransactionLine(line) {
  return /^\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?/.test(line.trim());
}

function extractTransactions(text) {
  const lines = String(text)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const transactions = [];

  for (const line of lines) {
    if (!looksLikeTransactionLine(line)) continue;

    const dateMatch = line.match(/^(\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?)/);
    if (!dateMatch) continue;

    const date = dateMatch[1];
    const rest = line.slice(date.length).trim();

    // Capture money-like values, assuming amount + balance near the end
    const moneyMatches = [...rest.matchAll(/-?\d[\d,]*\.\d{2}/g)].map(m => ({
      value: m[0],
      index: m.index,
    }));

    if (moneyMatches.length < 2) continue;

    const amountMatch = moneyMatches[moneyMatches.length - 2];
    const balanceMatch = moneyMatches[moneyMatches.length - 1];

    const description = rest.slice(0, amountMatch.index).trim();
    let amount = parseMoney(amountMatch.value);

// Determine sign from description
const descLower = description.toLowerCase();

const isDebit =
  descLower.includes("fee") ||
  descLower.includes("charge") ||
  descLower.includes("pmt") ||
  descLower.includes("payment") ||
  descLower.includes("withdrawal");

const isCredit =
  descLower.includes("credit") ||
  descLower.includes("deposit");

if (isDebit && amount > 0) {
  amount = -Math.abs(amount);
}

if (isCredit && amount < 0) {
  amount = Math.abs(amount);
}

// Ignore clearly invalid zero rows
if (amount === 0) {
  continue;
}
    const balance = parseMoney(balanceMatch.value);

    if (!description || amount === null) continue;

    transactions.push({
      date,
      description,
      amount,
      balance,
    });
  }

  return transactions;
}

export async function extractBankStatement(context) {
  const {
    file,
    classification,
    extractedText = "",
    textPreview = "",
    extractionMeta = null
  } = context;

  const period = extractStatementPeriod(extractedText);
  const transactions = extractTransactions(extractedText);

  return {
    sourceFileName: file?.originalname || "unknown.pdf",
    detectedSubtype: classification.documentSubtype,
    rawTextPreview: textPreview,
    rawText: extractedText,
    extractionMeta,
    metadata: {
      bankName: classification.documentSubtype || "unknown",
      accountNumber: extractAccountNumber(extractedText),
      clientName: extractClientName(extractedText),
      statementPeriodStart: period.start,
      statementPeriodEnd: period.end,
      openingBalance: extractBalance("opening balance", extractedText),
      closingBalance: extractBalance("closing balance", extractedText),
    },
    transactions,
  };
}