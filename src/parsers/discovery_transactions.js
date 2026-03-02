// src/parsers/discovery_bank_transactions.js

export function parseDiscovery(text, sourceFile = "") {
  if (!text || typeof text !== "string") {
    console.log("❌ No text received in Discovery parser");
    return { metadata: {}, transactions: [] };
  }

  console.log("🟡 DISCOVERY PARSER STARTED");

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  console.log(`📏 Total lines extracted: ${lines.length}`);

  // ─────────────────────────────────────────────
  // METADATA EXTRACTION
  // ─────────────────────────────────────────────

  const accountMatch = text.match(/Transaction Account\s+(\d{8,16})/i);
  const accountNumber = accountMatch ? accountMatch[1] : null;

  const clientNameMatch = text.match(/(?:Mr|Mrs|Ms|Dr|Prof)\s+[A-Z][A-Za-z\s]+/);
  const clientName = clientNameMatch ? clientNameMatch[0].trim() : null;

  const openMatch = text.match(
    /Opening balance on\s+\d{1,2}\s+\w+\s+\d{4}\s+R([\d\s,.]+\.\d{2})/i
  );

  const openingBalance = openMatch
    ? parseDiscoveryMoney(openMatch[1])
    : 0;

  const closeMatch = text.match(
    /Closing balance on\s+\d{1,2}\s+\w+\s+\d{4}\s+R([\d\s,.]+\.\d{2})/i
  );

  const closingBalance = closeMatch
    ? parseDiscoveryMoney(closeMatch[1])
    : 0;

  console.log("📊 Metadata extracted:");
  console.log({
    accountNumber,
    clientName,
    openingBalance,
    closingBalance
  });

  let runningBalance = openingBalance;
  const transactions = [];

  const months = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12"
  };

  // RELAXED REGEX (no end-of-line anchor)
  const txRegex =
    /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(20\d{2})\s+(.+?)\s+(-?\s?R[\d\s,.]+\.\d{2})/;

  // ─────────────────────────────────────────────
  // TRANSACTION LOOP
  // ─────────────────────────────────────────────

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    console.log(`🔎 Checking line ${i}:`, JSON.stringify(line));

    const match = line.match(txRegex);

    if (!match) {
      continue;
    }

    console.log("✅ MATCH FOUND:", JSON.stringify(line));

    const day = match[1].padStart(2, "0");
    const month = months[match[2]];
    const year = match[3];

    const date = `${year}-${month}-${day}`;

    let description = match[4].trim();
    const amount = parseDiscoveryMoney(match[5]);

    const nextLine = lines[i + 1];

    // Handle wrapped descriptions
    if (
      nextLine &&
      !nextLine.match(/^\d{1,2}\s+\w+/) &&
      !nextLine.match(/R\s?\d/)
    ) {
      console.log("↪️ Multi-line description detected:", nextLine);
      description += " " + nextLine.trim();
      i++;
    }

    runningBalance = parseFloat((runningBalance + amount).toFixed(2));

    transactions.push({
      date,
      description: description.toUpperCase(),
      amount,
      balance: runningBalance,
      account: accountNumber,
      clientName,
      bankName: "Discovery",
      sourceFile
    });
  }

  console.log(`📦 Transactions extracted: ${transactions.length}`);

  return {
    metadata: {
      accountNumber,
      clientName,
      openingBalance,
      closingBalance,
      bankName: "Discovery",
      sourceFile
    },
    transactions
  };
}

/**
 * Money parser
 */
function parseDiscoveryMoney(val) {
  if (!val) return 0;

  let clean = val.replace(/[R,\s]/g, "");
  const isNegative = clean.includes("-");
  clean = clean.replace("-", "");

  const parsed = parseFloat(clean);

  if (isNaN(parsed)) return 0;

  return isNegative ? -parsed : parsed;
}