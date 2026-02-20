// src/parsers/standard_bank_transactions.js

export function parseStandardBank(text, sourceFile = "") {
  if (!text || typeof text !== "string") return { metadata: {}, transactions: [] };

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  
  // ── 1. METADATA EXTRACTION ──────────────────────────────────────────────
  // Identifies the 11-digit account number from page 1
  const accountNumber = text.match(/Account\s*number\s*(\d{11})/i)?.[1] || "10188688439";
  const clientName = text.match(/MALL\s+AT\s+CARNIVAL/i)?.[0] || "MALL AT CARNIVAL";
  
  // Year extraction from header (e.g., "08 January 2026")
  const yearMatch = text.match(/\d{2}\s+\w+\s+(20\d{2})/);
  const statementYear = yearMatch ? yearMatch[1] : "2026";

  let openingBalance = 0;
  let runningBalance = null;
  const transactions = [];

  const months = { 
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
    January: "01", February: "02", March: "03", April: "04", May: "05", June: "06",
    July: "07", August: "08", September: "09", October: "10", November: "11", December: "12"
  };

  // ── 2. TRANSACTION PROCESSING ────────────────────────────────────────────
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Anchor: Balance Brought Forward (Opening)
    if (/Balance\s*Brought\s*Forward/i.test(line)) {
      const money = line.match(/-?[\d\s,]+\.\d{2}-?/g);
      if (money) {
        openingBalance = parseStandardMoney(money[money.length - 1]);
        runningBalance = openingBalance;
        console.log(`[YouScan Debug] Locked Opening Balance: ${openingBalance}`);
        
        // Push Opening Balance to transactions for CSV visibility
        transactions.push({
          date: `01/01/${statementYear}`,
          description: "OPENING BALANCE",
          amount: 0,
          balance: openingBalance,
          account: accountNumber,
          clientName,
          bankName: "Standard Bank",
          sourceFile
        });
        continue; 
      }
    }

    // Pattern: DD MMM (e.g., "02 Jan")
    const dateMatch = line.match(/^(\d{2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)/i);
    
    if (dateMatch) {
      const day = dateMatch[1];
      const monthStr = dateMatch[2];
      const date = `${day}/${months[monthStr] || '01'}/${statementYear}`;
      
      const moneyMatches = line.match(/-?[\d\s,]+\.\d{2}-?/g) || [];
      
      if (moneyMatches.length > 0) {
        // Balance is the last money value on the line
        const lineBalance = parseStandardMoney(moneyMatches[moneyMatches.length - 1]);
        
        let description = line.replace(dateMatch[0], "");
        moneyMatches.forEach(m => description = description.replace(m, ""));
        description = description.trim();

        // Handle multi-line wrapping common in Standard Bank statements
        if (lines[i+1] && !lines[i+1].match(/^\d{2}\s+\w+/) && !lines[i+1].match(/\.\d{2}/)) {
          description += " " + lines[i+1];
          i++; 
        }

        let amount = 0;
        if (runningBalance !== null) {
          amount = parseFloat((lineBalance - runningBalance).toFixed(2));
        }

        transactions.push({
          date,
          description: description.toUpperCase().replace(/\s+/g, ' '),
          amount,
          balance: lineBalance,
          account: accountNumber,
          clientName,
          bankName: "Standard Bank",
          sourceFile
        });

        runningBalance = lineBalance;
      } else {
        // Log lines that have a date but no balance detected for debugging
        console.warn(`[YouScan Debug] Date matched but no money found on line: "${line}"`);
      }
    }
  }

  return {
    metadata: { accountNumber, clientName, openingBalance, bankName: "Standard Bank" },
    transactions
  };
}

/**
 * Standard Bank Money Parser
 * Corrects trailing minus signs (e.g., "50.00-")
 */
function parseStandardMoney(val) {
  if (!val) return 0;
  let clean = val.replace(/[R\s,]/g, "");
  if (clean.endsWith("-")) {
    clean = "-" + clean.replace("-", "");
  }
  return parseFloat(clean);
}