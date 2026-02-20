/**
 * Capitec Parser - Production Safe (Simplified Model)
 * Handles:
 * - Multi-page statements
 * - Multi-line descriptions
 * - Fee + MoneyOut combined via balance math
 * - Dynamic opening balance derivation
 * - Reliable account extraction
 */

export const parseCapitec = (text) => {
  const transactions = [];

  const parseNum = (val) => {
    if (!val) return 0;
    let clean = val.replace(/[\s,]/g, '');
    let isNeg = clean.startsWith('-');
    clean = clean.replace(/[^0-9.]/g, '');
    const num = parseFloat(clean) || 0;
    return isNeg ? -Math.abs(num) : Math.abs(num);
  };

  // ------------------------------------------------------------------
  // 1️⃣ Extract Account Number (Robust)
  // ------------------------------------------------------------------

  let account = "Unknown";

  // Pattern: Account \n 1234567890
  const accountBlockMatch = text.match(/Account\s*\n\s*(\d{10,})/i);
  if (accountBlockMatch) {
    account = accountBlockMatch[1];
  } else {
    // Fallback: standalone 10–11 digit number near Main Account Statement
    const fallbackMatch = text.match(/\b\d{10,11}\b/);
    if (fallbackMatch) account = fallbackMatch[0];
  }

  // ------------------------------------------------------------------
  // 2️⃣ Isolate Transaction History Section
  // ------------------------------------------------------------------

  const startIndex = text.indexOf("Transaction History");
  if (startIndex === -1) {
    return {
      metadata: { accountNumber: account, bankName: "Capitec" },
      transactions: []
    };
  }

  let txSection = text.substring(startIndex);

  const footerIndex = txSection.indexOf("* Includes VAT");
  if (footerIndex !== -1) {
    txSection = txSection.substring(0, footerIndex);
  }

  const lines = txSection
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  // ------------------------------------------------------------------
  // 3️⃣ Reconstruct Multi-line Rows
  // ------------------------------------------------------------------

  const reconstructed = [];
  let currentRow = "";
  const dateRegex = /^\d{2}\/\d{2}\/\d{4}/;

  lines.forEach(line => {
    if (dateRegex.test(line)) {
      if (currentRow) reconstructed.push(currentRow.trim());
      currentRow = line;
    } else {
      currentRow += " " + line;
    }
  });

  if (currentRow) reconstructed.push(currentRow.trim());

  const filteredRows = reconstructed.filter(row =>
    !row.startsWith("Date Description")
  );

  // ------------------------------------------------------------------
  // 4️⃣ Parse Rows (Balance-Driven Logic)
  // ------------------------------------------------------------------

  let runningBalance = null;
  let openingBalance = null;

  filteredRows.forEach(row => {
    const dateMatch = row.match(/^(\d{2}\/\d{2}\/\d{4})/);
    if (!dateMatch) return;

    const date = dateMatch[1];
    let body = row.substring(date.length).trim();

    const numbers = body.match(/-?\d[\d\s,.]*/g);
    if (!numbers || numbers.length === 0) return;

    const balance = parseNum(numbers[numbers.length - 1]);

    let amount = 0;

    if (runningBalance === null) {
      // First transaction → derive opening balance later
      const possibleAmount =
        numbers.length >= 2
          ? parseNum(numbers[numbers.length - 2])
          : 0;

      amount = possibleAmount;
      openingBalance = balance - amount;
      runningBalance = balance;
    } else {
      amount = balance - runningBalance;
      runningBalance = balance;
    }

    // Remove numeric fields from description
    numbers.forEach(n => {
      body = body.replace(n, '');
    });

    const description = body.replace(/\s+/g, ' ').trim() || "Transaction";

    transactions.push({
      date,
      description,
      amount,
      balance,
      account,
      bankName: "Capitec"
    });
  });

  // ------------------------------------------------------------------
  // 5️⃣ Closing Balance
  // ------------------------------------------------------------------

  const closingBalance =
    transactions.length > 0
      ? transactions[transactions.length - 1].balance
      : null;

  return {
    metadata: {
      accountNumber: account,
      openingBalance,
      closingBalance,
      transactionCount: transactions.length,
      bankName: "Capitec"
    },
    transactions
  };
};