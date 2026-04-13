/**
 * YouScan 2.0
 * Bank statement normalizer
 */

function mapSubtypeToBankName(subtype) {
  if (!subtype) return "unknown";

  if (subtype.includes("absa")) return "ABSA";
  if (subtype.includes("fnb")) return "FNB";
  if (subtype.includes("nedbank")) return "Nedbank";
  if (subtype.includes("capitec")) return "Capitec";
  if (subtype.includes("discovery")) return "Discovery";

  return "unknown";
}

export async function normalizeBankStatement(raw) {
  const metadata = raw?.metadata || {};

  return {
    bankName: metadata.bankName
      ? mapSubtypeToBankName(metadata.bankName)
      : "unknown",
    accountNumber: metadata.accountNumber || null,
    clientName: metadata.clientName || null,
    statementPeriodStart: metadata.statementPeriodStart || null,
    statementPeriodEnd: metadata.statementPeriodEnd || null,
    openingBalance: metadata.openingBalance ?? null,
    closingBalance: metadata.closingBalance ?? null,
    transactions: raw?.transactions || [],
    sourceFileName: raw?.sourceFileName || null,
  };
}