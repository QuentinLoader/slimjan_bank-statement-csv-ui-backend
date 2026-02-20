// src/parsers/nedbank_transactions.js

export function parseNedbank(text, sourceFile = "") {
  if (!text || typeof text !== "string") return { metadata: {}, transactions: [] };

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  
  let accountNumber = "";
  let clientName = "";
  let openingBalance = 0;
  let closingBalance = 0;
  const transactions = [];

  // 1. IMPROVED ACCOUNT NUMBER SEARCH (Handles Page 1 format)
  // Look for 10-13 digits following "Account number" label
  const accMatch = text.match(/Account\s*number\s*[\n\s]*(\d{10,13})/i);
  if (accMatch) accountNumber = accMatch[1];

  const nameMatch = text.match(/(?:Mr|Mrs|Ms|Dr|Prof)\s+[A-Z\s]{5,}/i);
  if (nameMatch) clientName = nameMatch[0].trim();

  // 2. REGEX PATTERNS
  const DATE_RE = /^(\d{2}\/\d{2}\/\d{4})/;
  const MONEY_RE = /-?\d{1,3}(?:[,\s]\d{3})*\.\d{2}/g;

  // 3. MULTI-PASS EXTRACTION
  let runningBalance = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dateMatch = line.match(DATE_RE);

    if (dateMatch) {
      const date = dateMatch[1];
      const moneyInLine = line.match(MONEY_RE) || [];
      const lineBalance = moneyInLine.length > 0 ? parseMoney(moneyInLine[moneyInLine.length - 1]) : null;

      // Extract raw description
      let description = line.replace(DATE_RE, "");
      moneyInLine.forEach(m => description = description.replace(m, ""));
      description = description.replace(/[*R,]/g, "").replace(/^\d{6}/, "").trim();

      // Look-ahead for multi-line description wrap
      if (lines[i+1] && !lines[i+1].match(DATE_RE) && !lines[i+1].match(MONEY_RE)) {
        description += " " + lines[i+1].trim();
        i++; 
      }

      // CHECK FOR OPENING BALANCE ROW
      if (/Opening\s*balance/i.test(description)) {
        openingBalance = lineBalance;
        runningBalance = lineBalance;
        
        // ADD AS LINE ITEM TO CSV
        transactions.push({
          date,
          description: "OPENING BALANCE",
          amount: 0,
          balance: lineBalance,
          account: accountNumber,
          clientName,
          bankName: "Nedbank",
          sourceFile
        });
        continue;
      }

      // PROCESS STANDARD TRANSACTIONS
      if (lineBalance !== null && runningBalance !== null) {
        // Calculate amount from balance delta for 100% accuracy
        const amount = parseFloat((lineBalance - runningBalance).toFixed(2));

        if (!/Closing\s*balance/i.test(description)) {
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
        } else {
          closingBalance = lineBalance;
        }
      }
    }
  }

  return {
    metadata: {
      accountNumber,
      clientName,
      openingBalance,
      closingBalance: closingBalance || runningBalance,
      bankName: "Nedbank",
      sourceFile
    },
    transactions
  };
}

function parseMoney(value) {
  if (!value) return 0;
  return parseFloat(value.replace(/[R\s,]/g, ""));
}