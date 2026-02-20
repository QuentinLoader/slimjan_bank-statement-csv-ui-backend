// src/parsers/nedbank_transactions.js

export function parseNedbank(text, sourceFile = "") {
  if (!text || typeof text !== "string") return { metadata: {}, transactions: [] };

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  
  let accountNumber = "";
  let clientName = "";
  let openingBalance = null;
  let closingBalance = null;
  let runningBalance = null;
  const transactions = [];

  // 1. ANCHOR SEARCH: Find metadata first to set the state
  const accMatch = text.match(/Account\s*number\s*\n?\s*(\d{10,})/i);
  if (accMatch) accountNumber = accMatch[1];

  const nameMatch = text.match(/(?:Mr|Mrs|Ms|Dr|Prof)\s+[A-Z\s]{5,}/i);
  if (nameMatch) clientName = nameMatch[0].trim();

  // 2. SEARCH FOR GLOBAL TOTALS (The "Reconciliation Foundation")
  // We look for these globally to ensure they are available even if the line parsing fails.
  const summaryOpening = text.match(/Opening\s*balance\s*R?\s*([\d,\s]+\.\d{2})/i);
  if (summaryOpening) {
    openingBalance = parseMoney(summaryOpening[1]);
    runningBalance = openingBalance;
  }

  const summaryClosing = text.match(/Closing\s*balance\s*R?\s*([\d,\s]+\.\d{2})/i);
  if (summaryClosing) closingBalance = parseMoney(summaryClosing[1]);

  // 3. TRANSACTION ENGINE
  const DATE_RE = /^(\d{2}\/\d{2}\/\d{4})/;
  const MONEY_RE = /-?\d{1,3}(?:[,\s]\d{3})*\.\d{2}/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dateMatch = line.match(DATE_RE);

    if (dateMatch) {
      const date = dateMatch[1];
      const moneyMatches = line.match(MONEY_RE) || [];

      // A: LOCK IN OPENING BALANCE (from the transaction list row)
      if (/Opening\s*balance/i.test(line)) {
        const val = parseMoney(moneyMatches[moneyMatches.length - 1]);
        openingBalance = val;
        runningBalance = val;
        continue; // Do not list opening balance as a spending item
      }

      // B: IDENTIFY THE CLOSING BALANCE ROW
      if (/Closing\s*balance/i.test(line)) {
        closingBalance = parseMoney(moneyMatches[moneyMatches.length - 1]);
        continue;
      }

      // C: PROCESS REAL TRANSACTIONS
      if (moneyMatches.length > 0) {
        const lineBalance = parseMoney(moneyMatches[moneyMatches.length - 1]);
        
        // Extract Description: remove date and all money amounts
        let description = line.replace(DATE_RE, "");
        moneyMatches.forEach(m => description = description.replace(m, ""));
        description = description.replace(/[*R,]/g, "").replace(/^\d{6}/, "").trim();

        // Handle multi-line wrapping (Description check on next line)
        if (lines[i+1] && !lines[i+1].match(DATE_RE) && !lines[i+1].match(MONEY_RE)) {
          description += " " + lines[i+1].trim();
          i++; 
        }

        // DELTA CALCULATION: Ensures repeatability regardless of column alignment
        let amount = 0;
        if (runningBalance !== null) {
          amount = parseFloat((lineBalance - runningBalance).toFixed(2));
        }

        // Only add if it's not a summary/closing row
        if (!/closing\s*balance/i.test(description)) {
          transactions.push({
            date,
            description: description.toUpperCase(),
            amount,
            balance: lineBalance,
            account: accountNumber,
            clientName,
            bankName: "Nedbank",
            sourceFile
          });
          runningBalance = lineBalance;
        }
      }
    }
  }

  // Final validation to ensure openingBalance isn't null for the UI
  return {
    metadata: {
      accountNumber,
      clientName,
      openingBalance: openingBalance || 0,
      closingBalance: closingBalance || runningBalance,
      bankName: "Nedbank",
      sourceFile
    },
    transactions
  };
}

function parseMoney(value) {
  if (!value) return 0;
  // Standardize South African spacing/comma formats
  return parseFloat(value.replace(/[R\s,]/g, ""));
}