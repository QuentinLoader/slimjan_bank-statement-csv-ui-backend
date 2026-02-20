/**
 * Standard Bank Metadata Extractor
 * Production-grade, deterministic, layout-aware.
 */

export const extractStandardBankMetadata = (text) => {
  const cleanText = text.replace(/\s+/g, " ");

  // Account Number (format: 1009 547 382 1)
  const accountMatch = cleanText.match(/Account Number\s*([\d\s]{10,20})/i);
  const account = accountMatch
    ? accountMatch[1].replace(/\s/g, "")
    : "Unknown";

  // Client Name (MR. JA LOADER)
  const clientMatch = cleanText.match(/MR\.\s+[A-Z\s]+/);
  const clientName = clientMatch ? clientMatch[0].trim() : "Unknown";

  // Statement Date (08 January 2026)
  const statementDateMatch = cleanText.match(
    /\d{2}\s+[A-Za-z]+\s+20\d{2}/
  );
  const statementDate = statementDateMatch
    ? statementDateMatch[0]
    : null;

  // Statement Period
  const periodMatch = cleanText.match(
    /Statement from\s+(.+?)\s+to\s+(.+?)\s+BANK STATEMENT/i
  );

  const periodStart = periodMatch ? periodMatch[1].trim() : null;
  const periodEnd = periodMatch ? periodMatch[2].trim() : null;

  // Opening Balance (BALANCE BROUGHT FORWARD)
  const openingMatch = cleanText.match(
    /BALANCE BROUGHT FORWARD\s+\d+\s+\d+\s+([\d,]+\.\d{2}-?)/
  );

  let openingBalance = 0;
  if (openingMatch) {
    openingBalance = parseFloat(
      openingMatch[1].replace(/[, -]/g, "")
    );
    if (openingMatch[1].includes("-"))
      openingBalance = -openingBalance;
  }

  // Closing Balance (Balance outstanding at date of statement)
  const closingMatch = cleanText.match(
    /Balance outstanding at date of statement\s+([\d,]+\.\d{2}-?)/
  );

  let closingBalance = 0;
  if (closingMatch) {
    closingBalance = parseFloat(
      closingMatch[1].replace(/[, -]/g, "")
    );
    if (closingMatch[1].includes("-"))
      closingBalance = -closingBalance;
  }

  return {
    account,
    clientName,
    bankName: "Standard Bank",
    statementDate,
    periodStart,
    periodEnd,
    openingBalance,
    closingBalance
  };
};