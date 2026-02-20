export const parseFnb = (text) => {
  const transactions = [];

  // ===========================================================================
  // 1. EXTRACT METADATA (Expanded)
  // ===========================================================================

  const bankName = "First National Bank";

  const accountMatch =
    text.match(/Gold Business Account\s*:\s*(\d+)/i) ||
    text.match(/Account\D*?(\d{11})/i) ||
    text.match(/(\d{11})/);

  const account = accountMatch ? accountMatch[1] : "Unknown";

  const statementIdMatch = text.match(/Tax Invoice\/Statement Number\s*:\s*(\d+)/i);
  const uniqueDocNo = statementIdMatch ? statementIdMatch[1] : "Unknown";

  const clientMatch = text.match(/\*(.+?)\s{2,}|\*(.+?)\n/);
  const clientName = clientMatch
    ? (clientMatch[1] || clientMatch[2]).trim()
    : "Unknown";

  const periodMatch = text.match(/Statement Period\s*:\s*(.+?)\s*to\s*(.+)/i);
  const periodStart = periodMatch ? periodMatch[1].trim() : null;
  const periodEnd = periodMatch ? periodMatch[2].trim() : null;

  const statementDateMatch = text.match(/Statement Date\s*:\s*(.+)/i);
  const statementDate = statementDateMatch
    ? statementDateMatch[1].trim()
    : null;

  // Opening Balance
  let openingBalance = 0;
  const openMatch = text.match(/Opening Balance\s*([0-9,]+\.[0-9]{2})\s*(Cr|Dr)?/i);
  if (openMatch) {
    openingBalance = parseFloat(openMatch[1].replace(/,/g, ""));
    if (openMatch[2] !== "Cr") openingBalance = -Math.abs(openingBalance);
  }

  // Closing Balance
  let closingBalance = 0;
  const closeMatch = text.match(/Closing Balance\s*([0-9,]+\.[0-9]{2})\s*(Cr|Dr)?/i);
  if (closeMatch) {
    closingBalance = parseFloat(closeMatch[1].replace(/,/g, ""));
    if (closeMatch[2] !== "Cr") closingBalance = -Math.abs(closingBalance);
  }

  const vatMatch = text.match(/Total VAT.*?([0-9,]+\.[0-9]{2})\s*(Dr|Cr)/i);
  const totalVat = vatMatch
    ? (vatMatch[2] === "Cr" ? 1 : -1) *
      parseFloat(vatMatch[1].replace(/,/g, ""))
    : 0;

  // ===========================================================================
  // 2. ISOLATE TRANSACTION BLOCK (CRITICAL FIX)
  // ===========================================================================

  const txBlockMatch = text.match(
    /Transactions in RAND[\s\S]*?Closing Balance/i
  );

  if (!txBlockMatch) {
    return {
      metadata: {
        accountNumber: account,
        statementId: uniqueDocNo,
        error: "No transaction block found"
      },
      transactions: []
    };
  }

  let cleanText = txBlockMatch[0]
    .replace(/Page \d+ of \d+/gi, " ")
    .replace(/Branch Number[\s\S]*?FN/gi, " ")
    .replace(/Delivery Method[\s\S]*?AA/gi, " ")
    .replace(/\s+/g, " ");

  // ===========================================================================
  // 3. TRANSACTION PARSING (Your Logic Preserved)
  // ===========================================================================

  const moneyRegex =
    /([0-9\s,]+\.[0-9]{2})\s*(Cr|Dr)?\s*([0-9\s,]+\.[0-9]{2})\s*(Cr|Dr)?/gi;

  let match;
  let lastIndex = 0;
  let runningBalance = openingBalance;
  let totalCredits = 0;
  let totalDebits = 0;

  while ((match = moneyRegex.exec(cleanText)) !== null) {
    let amountRaw = match[1].replace(/[\s,]/g, "");
    let amountSign = match[2];
    let balanceRaw = match[3].replace(/[\s,]/g, "");
    let balanceSign = match[4];

    let startIndex = Math.max(lastIndex, match.index - 300);
    let rawSegment = cleanText.substring(startIndex, match.index).trim();
    lastIndex = moneyRegex.lastIndex;

    if (rawSegment.length < 3) continue;
    if (rawSegment.toLowerCase().includes("transactions in rand")) continue;

    // Date Extraction
    let dateStr = "";
    let description = rawSegment;

    const dateMatch = rawSegment.match(
      /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i
    );

    if (!dateMatch) continue;

    const months = {
      Jan: "01",
      Feb: "02",
      Mar: "03",
      Apr: "04",
      May: "05",
      Jun: "06",
      Jul: "07",
      Aug: "08",
      Sep: "09",
      Oct: "10",
      Nov: "11",
      Dec: "12"
    };

    const day = dateMatch[1].padStart(2, "0");
    const month = months[dateMatch[2]];
    const yearMatch = text.match(/(20\d{2})\/\d{2}\/\d{2}/);
    const year = yearMatch ? yearMatch[1] : new Date().getFullYear();

    dateStr = `${day}/${month}/${year}`;
    description = description.replace(dateMatch[0], "").trim();

    let finalBalance = parseFloat(balanceRaw);
    if (balanceSign === "Dr") finalBalance = -Math.abs(finalBalance);

    let expectedDiff = finalBalance - runningBalance;
    let finalAmount = expectedDiff;

    runningBalance = finalBalance;

    if (finalAmount > 0) totalCredits += finalAmount;
    else totalDebits += Math.abs(finalAmount);

    if (!description) description = "Transaction";

    transactions.push({
      date: dateStr,
      description,
      amount: finalAmount,
      balance: finalBalance,
      account,
      clientName,
      statementId: uniqueDocNo,
      bankName
    });
  }

  // ===========================================================================
  // 4. VALIDATION
  // ===========================================================================

  const calculatedClosing =
    openingBalance + totalCredits - totalDebits;

  const reconciliationOk =
    Math.abs(calculatedClosing - closingBalance) < 0.02;

  // ===========================================================================
  // RETURN
  // ===========================================================================

  return {
    metadata: {
      bankName,
      accountNumber: account,
      clientName,
      statementId: uniqueDocNo,
      statementDate,
      periodStart,
      periodEnd,
      openingBalance,
      closingBalance,
      totalVat,
      transactionCount: transactions.length,
      totalCredits,
      totalDebits,
      reconciliationOk
    },
    transactions
  };
};