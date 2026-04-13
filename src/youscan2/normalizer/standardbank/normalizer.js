/**
 * YouScan 2.0
 * Standard Bank transaction normalizer
 */

function isValidDateString(value) {
  if (!value) return false;

  const match = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;

  const dd = Number(match[1]);
  const mm = Number(match[2]);
  const yyyy = Number(match[3]);

  return dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yyyy >= 2000 && yyyy <= 2100;
}

function extractStatementEndYear(statementPeriodEnd) {
  const text = String(statementPeriodEnd || "").trim();

  let match = text.match(/(\d{4})$/);
  if (match) return Number(match[1]);

  match = text.match(/\b(\d{4})\b/);
  if (match) return Number(match[1]);

  return 2026;
}

function resolveYear(yy, statementEndYear) {
  const candidate = 2000 + Number(yy);

  if (candidate < statementEndYear - 2 || candidate > statementEndYear + 1) {
    return statementEndYear - 1;
  }

  return candidate;
}

function extractDateFromDescription(description, statementEndYear = 2026) {
  const text = String(description || "").trim();

  let match = text.match(/ROL(\d{2})(\d{2})(\d{2})/i);
  if (match) {
    const dd = match[1];
    const mm = match[2];
    const yy = Number(match[3]);
    const yyyy = resolveYear(yy, statementEndYear);
    return `${dd}/${mm}/${yyyy}`;
  }

  match = text.match(/(\d{6})$/);
  if (match) {
    const token = match[1];
    const dd = Number(token.slice(0, 2));
    const mm = Number(token.slice(2, 4));
    const yy = Number(token.slice(4, 6));

    if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) {
      const yyyy = resolveYear(yy, statementEndYear);
      return `${token.slice(0, 2)}/${token.slice(2, 4)}/${yyyy}`;
    }
  }

  match = text.match(/\b(\d{6})\b/);
  if (match) {
    const token = match[1];
    const dd = Number(token.slice(0, 2));
    const mm = Number(token.slice(2, 4));
    const yy = Number(token.slice(4, 6));

    if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) {
      const yyyy = resolveYear(yy, statementEndYear);
      return `${token.slice(0, 2)}/${token.slice(2, 4)}/${yyyy}`;
    }
  }

  return null;
}

function shouldRemoveTransaction(description) {
  const upper = String(description || "").toUpperCase();

  return (
    upper.includes("RTD-NOT PROVIDED FOR") ||
    upper === "##" ||
    upper.includes("FEE-UNPAID ITEM") ||
    upper.includes("UNPAID FEE DEBICHECK D/O") ||
    upper.includes("VAT SUMMARY") ||
    upper.includes("ACCOUNT SUMMARY") ||
    upper.includes("DETAILS OF AGREEMENT") ||
    upper.includes("THIS DOCUMENT CONSTITUTES A CREDIT NOTE") ||
    upper.includes("TOTAL VAT")
  );
}

function normalizeStandardBankTransaction(tx, statementEndYear) {
  const description = String(tx?.description || "").trim();
  const upper = description.toUpperCase();

  const normalized = {
    date: tx?.date || null,
    description,
    amount: typeof tx?.amount === "number" ? Number(tx.amount.toFixed(2)) : null,
    balance: typeof tx?.balance === "number" ? Number(tx.balance.toFixed(2)) : null,
  };

  if (!isValidDateString(normalized.date)) {
    normalized.date = extractDateFromDescription(description, statementEndYear);
  }

  if (
    normalized.amount != null &&
    upper.includes("CREDIT") &&
    !upper.includes("DEBIT") &&
    !upper.includes("DEBIT ORDER")
  ) {
    normalized.amount = Math.abs(normalized.amount);
  }

  return normalized;
}

export function normalizeStandardBankTransactions(
  transactions = [],
  statementPeriodEnd = null
) {
  const list = Array.isArray(transactions) ? transactions : [];
  const statementEndYear = extractStatementEndYear(statementPeriodEnd);

  const normalized = [];

  for (const tx of list) {
    if (!tx) continue;
    if (shouldRemoveTransaction(tx.description)) continue;

    normalized.push(
      normalizeStandardBankTransaction(tx, statementEndYear)
    );
  }

  return normalized;
}