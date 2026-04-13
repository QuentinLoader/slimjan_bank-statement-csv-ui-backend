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

export async function extractBankStatement(context) {
  const { file, classification, extractedText = "", textPreview = "", extractionMeta = null } = context;

  const period = extractStatementPeriod(extractedText);

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
    transactions: [],
  };
}