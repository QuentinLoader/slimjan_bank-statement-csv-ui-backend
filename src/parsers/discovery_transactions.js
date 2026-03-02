// src/parsers/discovery_bank_transactions.js

export function parseDiscovery(text, sourceFile = "") {
  if (!text || typeof text !== "string") {
    return { metadata: {}, transactions: [] };
  }

  // ───── NORMALIZE TEXT ─────
  // Remove quotes and handle line breaks to simplify regex matching
  let normalized = text.replace(/"/g, "").replace(/\r/g, "\n");

  // Ensure each transaction date starts on a new line
  normalized = normalized.replace(
    /(\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+20\d{2})/g,
    "\n$1"
  );

  const lines = normalized
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  // ───── METADATA EXTRACTION ─────
  
  // Account number usually follows the account type label [cite: 10]
  const accountMatch = normalized.match(/Transaction Account\s*,?\s*(\d{8,16})/i);
  const accountNumber = accountMatch ? accountMatch[1] : null;

  // Name usually appears as Mr/Mrs followed by the name [cite: 3, 22]
  const clientNameMatch = normalized.match(/(?:Mr|Mrs|Ms|Dr|Prof)\s+[A-Z][A-Za-z\s]+/);
  const clientName = clientNameMatch ? clientNameMatch[0].trim() : null;

  // Find balances by looking for the labels followed by currency 
  const openMatch = normalized.match(/Opening balance\s*,?\s*R([\d\s,.]+\.\d{2})/i);
  const openingBalance = openMatch ? parseMoney(openMatch[1]) : 0;

  const closeMatch = normalized.match(/Closing balance\s*,?\s*R([\d\s,.]+\.\d{2})/i);
  const closingBalance = closeMatch ? parseMoney(closeMatch[1]) : 0;

  let runningBalance = openingBalance;
  const transactions = [];

  const months = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12"
  };

  // Regex to capture: Date, Description (including middle columns), and Amount 
  const txRegex = /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(20\d{2}),?.*?,(.*?),(-?\s?R[\d\s,.]+\.\d{2})/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(txRegex);

    if (!match) continue;

    const day = match[1].padStart(2, "0");
    const month = months[match[2]];
    const year = match[3];
    const date = `${year}-${month}-${day}`;

    // Clean up description: remove extra commas and whitespace
    let description = match[4].replace(/,/g, " ").trim();
    const amount = parseMoney(match[5]);

    // Check for wrapped description content on the next line
    const nextLine = lines[i + 1];
    if (
      nextLine && 
      !nextLine.match(/^\d{1,2}\s+\w+/) && 
      !nextLine.match(/R\s?\d/) &&
      !nextLine.toLowerCase().includes("closing balance")
    ) {
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

function parseMoney(val) {
  if (!val) return 0;

  // Strip currency symbols, commas, and whitespace, but keep the negative sign
  let clean = val.replace(/[R,\s]/g, "");
  const isNegative = clean.includes("-");
  clean = clean.replace("-", "");

  const parsed = parseFloat(clean);
  if (isNaN(parsed)) return 0;

  return isNegative ? -parsed : parsed;
}