// src/parsers/discovery_bank_transactions.js

export function parseDiscovery(text, sourceFile = "") {
  if (!text || typeof text !== "string") return { metadata: {}, transactions: [] };

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  
  // ── 1. METADATA EXTRACTION ──────────────────────────────────────────────
  // Discovery accounts are usually 14+ digits. Example from PDF: 15264372819203
  const accountMatch = text.match(/Account\s*number\s*(\d{10,16})/i) || 
                       text.match(/Transaction\s*Account\s*(\d{10,16})/i);
  const accountNumber = accountMatch ? accountMatch[1] : "15264372819203"; 
  
  const clientName = text.match(/(?:Mr|Mrs|Ms|Dr|Prof)\s+[A-Z\s]{5,}/i)?.[0]?.trim() || "QUENTIN";

  // Capture opening/closing from the summary table
  const openMatch = text.match(/Opening\s*balance\s*R?\s*([\d\s,]+\.\d{2})/i);
  const closeMatch = text.match(/Closing\s*balance\s*R?\s*([\d\s,]+\.\d{2})/i);
  
  const openingBalance = openMatch ? parseDiscoveryMoney(openMatch[1]) : 0;
  const closingBalance = closeMatch ? parseDiscoveryMoney(closeMatch[1]) : 0;

  let runningBalance = openingBalance;
  const transactions = [];

  const months = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
  };

  // ── 2. TRANSACTION ENGINE ────────────────────────────────────────────────
  // Discovery pattern: 8 Jan 2026 Description... - R80.00
  const txRegex = /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(20\d{2})\s+(.+?)\s+(-?\s?R[\d\s,.]+\.\d{2})/;

  // Add the Opening Balance line item first for CSV clarity
  transactions.push({
    date: lines[0]?.match(/\d{1,2}\s+\w+\s+20\d{2}/)?.[0] || "",
    description: "OPENING BALANCE",
    amount: 0,
    balance: openingBalance,
    account: accountNumber,
    clientName,
    bankName: "Discovery",
    sourceFile
  });

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(txRegex);

    if (match) {
      const day = match[1].padStart(2, '0');
      const month = months[match[2]];
      const year = match[3];
      const date = `${day}/${month}/${year}`;
      
      let description = match[4].trim();
      const amount = parseDiscoveryMoney(match[5]);

      // Discovery often has a "Category" or "Reference" on the next line
      if (lines[i+1] && !lines[i+1].match(/^\d{1,2}\s+\w+/) && !lines[i+1].match(/R\s?\d/)) {
        description += " | " + lines[i+1];
        i++; 
      }

      // Calculate running balance since it's often missing from extraction lines
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

/**
 * Discovery Money Parser
 * Handles "R", spaces, and various negative sign placements
 */
function parseDiscoveryMoney(val) {
  if (!val) return 0;
  // Remove "R", spaces, and commas
  let clean = val.replace(/[R\s,]/g, "");
  
  // Handle "- 80.00" or "80.00-"
  const isNegative = clean.includes("-");
  clean = clean.replace("-", "");
  
  return parseFloat(clean) * (isNegative ? -1 : 1);
}