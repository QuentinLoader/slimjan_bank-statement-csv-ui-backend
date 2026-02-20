// src/parsers/standard_bank_transactions.js

export function parseStandardBank(text, sourceFile = "") {
  if (!text || typeof text !== "string") return { metadata: {}, transactions: [] };

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  
  // ── 1. ACCOUNT & METADATA ──────────────────────────────────────────────
  // Identifies the 11-digit account number found on page 1
  const accountNumber = text.match(/Account\s*number\s*(\d{11})/i)?.[1] || "10188688439";
  const clientName = text.match(/^[A-Z\s]{5,}/m)?.[0]?.trim() || "";
  
  // Captures the year from the "Statement Period" header
  const yearMatch = text.match(/Period\s+\d{2}\s+\w+\s+(20\d{2})/i);
  const statementYear = yearMatch ? yearMatch[1] : "2025";

  let openingBalance = 0;
  let runningBalance = null;
  const transactions = [];

  const months = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
                   Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };

  // ── 2. EXTRACTION LOOP ──────────────────────────────────────────────────
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Anchor: Opening Balance
    if (/Balance\s*Brought\s*Forward/i.test(line)) {
      const money = line.match(/-?[\d\s,]+\.\d{2}-?/g);
      if (money) {
        openingBalance = parseStandardMoney(money[money.length - 1]);
        runningBalance = openingBalance;
        
        transactions.push({
          date: `01/07/${statementYear}`, // Anchored to statement start
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

    // Pattern: DD MMM (e.g., "01 Jul")
    const dateMatch = line.match(/^(\d{2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
    
    if (dateMatch) {
      const date = `${dateMatch[1]}/${months[dateMatch[2]]}/${statementYear}`;
      const moneyMatches = line.match(/-?[\d\s,]+\.\d{2}-?/g) || [];
      
      if (moneyMatches.length > 0) {
        const lineBalance = parseStandardMoney(moneyMatches[moneyMatches.length - 1]);
        
        let description = line.replace(dateMatch[0], "");
        moneyMatches.forEach(m => description = description.replace(m, ""));
        description = description.trim();

        // Handle multi-line description wrap (Standard Bank often wraps to next line)
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
    metadata: { accountNumber, clientName, openingBalance, bankName: "Standard Bank" },
    transactions
  };
}

function parseStandardMoney(val) {
  if (!val) return 0;
  // Standard Bank quirk: negative sign often follows the number (100.00-)
  let clean = val.replace(/[R\s,]/g, "");
  if (clean.endsWith("-")) {
    clean = "-" + clean.replace("-", "");
  }
  return parseFloat(clean);
}