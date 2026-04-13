import { extractAbsaTransactions } from "./absa/extractor.js";
import {
  extractStandardBankTransactions,
  deriveStandardBankOpeningBalanceFromFirstTransaction,
} from "./standardBank/extractor.js";
import {
  extractAccountNumber,
  extractClientName,
  extractStatementPeriod,
  extractOpeningBalance,
  extractClosingBalance,
  extractStandardBankOpeningBalance,
  extractStandardBankClosingBalance,
} from "./shared/metadata.js";

export function extractBySubtype(text, subtype, period = null) {
  if (subtype === "standard_bank_statement") {
    return extractStandardBankTransactions(text, period);
  }

  return extractAbsaTransactions(text);
}

export function buildBankStatementExtraction(context) {
  const {
    file,
    classification,
    extractedText = "",
    textPreview = "",
    extractionMeta = null,
  } = context;

  const subtype = classification.documentSubtype;
  const period = extractStatementPeriod(extractedText);
  const transactions = extractBySubtype(extractedText, subtype, period);

  let openingBalance = extractOpeningBalance(extractedText);
  let closingBalance =
    extractClosingBalance(extractedText) ??
    (transactions.length
      ? Number(transactions[transactions.length - 1].balance.toFixed(2))
      : null);

  if (subtype === "standard_bank_statement") {
    const sbOpeningBalance = extractStandardBankOpeningBalance(extractedText);
    const sbClosingBalance = extractStandardBankClosingBalance(extractedText);

    openingBalance = sbOpeningBalance ?? openingBalance;
    closingBalance = sbClosingBalance ?? closingBalance;

    const derivedOpening = deriveStandardBankOpeningBalanceFromFirstTransaction(transactions);
    if (derivedOpening !== null) {
      openingBalance = derivedOpening;
    }

    if (
      transactions.length &&
      typeof transactions[transactions.length - 1].balance === "number" &&
      Number.isFinite(transactions[transactions.length - 1].balance)
    ) {
      closingBalance = Number(transactions[transactions.length - 1].balance.toFixed(2));
    }
  }

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
      statementPeriodStart: period.start,
      statementPeriodEnd: period.end,
      openingBalance,
      closingBalance,
    },
    transactions,
  };
}