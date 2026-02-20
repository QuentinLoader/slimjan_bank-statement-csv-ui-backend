// src/parsers/standard_bank_transactions.js

export function parseStandardBank(text, sourceFile = "") {
  if (!text || typeof text !== "string") return { metadata: {}, transactions: [] };

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  
  // ── 1. METADATA & ACCOUNT NUMBER ──────────────────────────────────────
  // On Standard Bank statements, the account number is usually 9-11 digits.
  const accountNumber = text.match(/Account\s*number\s*(\d{9,11})/i)?.[1] || "NOT_FOUND";
  const clientName = text.match(/^[A-Z\s]{5,}/m)?.[0]?.trim() || "";
  
  // Year is crucial as it's not on every transaction line
  const yearMatch = text.match(/Statement\s*Period.*\b(20\d{2})\b/i);
  const statementYear = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();

  let openingBalance = 0;
  let closingBalance = 0;
  let runningBalance = null;
  const transactions = [];

  // ── 2. TRANSACTION PATTERNS ─────────────────────────────────────────────
  // Standard Bank Date format: DD MMM (e.g., 01 Jul)
  const DATE_RE = /^(\d{2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i;
  // Money regex: Handles commas and negative signs at the end (SB quirk: 1,234.00-)
  const MONEY_RE = /-?[\d\s,]+\.\d{2}-?/g;

  // Month mapping
  const months = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
                   Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Capture Opening Balance from text summary
    if (/Balance\s*Brought\s*Forward/i.test(line)) {
      const money = line.match(MONEY_RE);
      if (money) {
        openingBalance = parseStandardMoney(money[money.length - 1]);
        runningBalance = openingBalance;
        
        // Add Opening Balance as a Line Item for the CSV
        transactions.push({
          date: `01/${months[line.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i)?.[0]] || '01'}/${statementYear}`,
          description: "OPENING BALANCE",
          amount: 0,
          balance: openingBalance,
          account: accountNumber,
          clientName,
          bankName: "Standard Bank",
          sourceFile
        });
      }
      continue;
    }

    const dateMatch = line.match(DATE_RE);
    if (dateMatch) {
      const day = dateMatch[1];
      const monthStr = dateMatch[2];
      const date = `${day}/${months[monthStr]}/${statementYear}`;
      
      const moneyMatches = line.match(MONEY_RE) || [];
      
      if (moneyMatches.length > 0) {
        // The balance is the last money value on the line
        const lineBalance = parseStandardMoney(moneyMatches[moneyMatches.length - 1]);
        
        // Extract Description: everything between the date and the first money value
        let description = line.replace(DATE_RE, "");
        moneyMatches.forEach(m => description = description.replace(m, ""));
        description = description.trim();

        // Standard Bank multi-line description logic
        if (lines[i+1] && !lines[i+1].match(DATE_RE) && !lines[i+1].match(MONEY_RE) && lines[i+1].length > 3) {
          description += " " + lines[i+1];
          i++; 
        }

        // Calculate Amount via Delta
        let amount = 0;
        if (runningBalance !== null) {
          amount = parseFloat((lineBalance - runningBalance).toFixed(2));
        }

        transactions.push({
          date,
          description: description.toUpperCase(),
          amount,
          balance: lineBalance,
          account: accountNumber,
          clientName,
          bankName: "Standard Bank",
          sourceFile
        });

        runningBalance = lineBalance;
      }
    }
  }

  return {
    metadata: {
      accountNumber,
      clientName,
      openingBalance,
      closingBalance: runningBalance || 0,
      bankName: "Standard Bank",
      sourceFile
    },
    transactions
  };
}

/**
 * Standard Bank specific money parser 
 * Handles trailing negatives (e.g. "1,250.00-")
 */
function parseStandardMoney(val) {
  if (!val) return 0;
  let clean = val.replace(/[\s,R]/g, "");
  if (clean.endsWith("-")) {
    clean = "-" + clean.replace("-", "");
  }
  return parseFloat(clean);
}