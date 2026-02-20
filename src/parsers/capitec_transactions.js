/**
 * Capitec Parser - Production Grade (Main Account Statement)
 * Handles:
 * - Multi-line rows
 * - Money In / Money Out / Fee / Balance columns
 * - Header/footer isolation
 * - Running balance validation
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
  // 1️⃣ Extract Metadata
  // ------------------------------------------------------------------

  const accountMatch = text.match(/Account\s*\n?\s*(\d{10,})/i);
  const account = accountMatch ? accountMatch[1] : "Unknown";

  const openMatch = text.match(/Opening Balance:\s*R?([\d\s,.]+)/i);
  const closeMatch = text.match(/Closing Balance:\s*R?([\d\s,.]+)/i);

  const openingBalance = openMatch ? parseNum(openMatch[1]) : 0;
  const closingBalance = closeMatch ? parseNum(closeMatch[1]) : 0;

  // ------------------------------------------------------------------
  // 2️⃣ Isolate Transaction History Section
  // ------------------------------------------------------------------

  const startIndex = text.indexOf("Transaction History");
  if (startIndex === -1) {
    return {
      metadata: { accountNumber: account, openingBalance, closingBalance, bankName: "Capitec" },
      transactions: []
    };
  }

  let txSection = text.substring(startIndex);

  // Stop at VAT/footer
  const footerIndex = txSection.indexOf("* Includes VAT");
  if (footerIndex !== -1) {
    txSection = txSection.substring(0, footerIndex);
  }

  const lines = txSection.split('\n').map(l => l.trim()).filter(Boolean);

  // ------------------------------------------------------------------
  // 3️⃣ Reconstruct Rows (Handle Multi-line Descriptions)
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

  // Remove header row
  const filteredRows = reconstructed.filter(row =>
    !row.startsWith("Date Description")
  );

  // ------------------------------------------------------------------
  // 4️⃣ Parse Each Row
  // ------------------------------------------------------------------

  let runningBalance = openingBalance;

  filteredRows.forEach(row => {
    const dateMatch = row.match(/^(\d{2}\/\d{2}\/\d{4})/);
    if (!dateMatch) return;

    const date = dateMatch[1];
    let body = row.substring(date.length).trim();

    // Extract all numbers in row
    const numbers = body.match(/-?\d[\d\s,.]*/g);
    if (!numbers || numbers.length === 0) return;

    const balance = parseNum(numbers[numbers.length - 1]);

    let amount = 0;
    if (numbers.length >= 2) {
      const possibleAmount = parseNum(numbers[numbers.length - 2]);
      if (Math.abs(runningBalance + possibleAmount - balance) < 0.05) {
        amount = possibleAmount;
      } else {
        amount = balance - runningBalance;
      }
    } else {
      amount = balance - runningBalance;
    }

    // Remove numeric values from description
    numbers.forEach(n => {
      body = body.replace(n, '');
    });

    const description = body.replace(/\s+/g, ' ').trim() || "Transaction";

    runningBalance = balance;

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
  // 5️⃣ Final Balance Validation
  // ------------------------------------------------------------------

  if (transactions.length > 0) {
    const lastBalance = transactions[transactions.length - 1].balance;
    if (Math.abs(lastBalance - closingBalance) > 0.1) {
      console.warn("⚠️ Capitec closing balance mismatch detected.");
    }
  }

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