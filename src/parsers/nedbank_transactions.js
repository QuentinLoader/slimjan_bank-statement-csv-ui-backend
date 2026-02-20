// src/parsers/nedbank_transactions.js

export function parseNedbank(text, sourceFile = "") {
  if (!text || typeof text !== "string") {
    return { metadata: {}, transactions: [] };
  }

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  // ── Metadata ─────────────────────────────────────────────────────────────
  let accountNumber = "";
  let clientName = "";
  const bankName = "Nedbank";
  let statementId = "";
  let openingBalance = null;
  let closingBalance = null;

  // Account number - Handles multi-line or "Account number \n 1605..." 
  const accMatch = text.match(/Account\s*number\s*([\d]{10,13})/i) || text.match(/Account\s*number\s*\n\s*([\d]{10,13})/i);
  if (accMatch) accountNumber = accMatch[1];

  // Client name [cite: 3]
  const nameMatch = text.match(/(?:Mr|Mrs|Ms|Dr|Prof)\s+[A-Z\s]+/i);
  if (nameMatch) clientName = nameMatch[0].trim();

  // ── Transaction Parsing ──────────────────────────────────────────────────
  const transactions = [];
  let previousBalance = null;

  // Regex for Date DD/MM/YYYY 
  const DATE_RE = /(\d{2}\/\d{2}\/\d{4})/;
  // Regex for Money (handles R, commas, and trailing asterisks) [cite: 84, 85]
  const MONEY_RE = /R?\s?(-?\d{1,3}(?:[,\s]\d{3})*\.\d{2})\*?/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dateMatch = line.match(DATE_RE);

    if (dateMatch) {
      const date = dateMatch[1];
      
      // Look ahead for description and amounts in this line or the next
      // Nedbank often puts the description on the same line as the date 
      let description = line.replace(DATE_RE, "").replace(/\d{6}/, "").trim(); 
      
      // If description is empty, check the next line
      if (description.length < 2 && lines[i+1] && !lines[i+1].match(DATE_RE)) {
        description = lines[i+1];
      }

      const moneyMatches = line.match(MONEY_RE);
      
      // Handle Opening Balance Row 
      if (/Opening\s*balance/i.test(line) || /Opening\s*balance/i.test(description)) {
        const vals = line.match(MONEY_RE);
        if (vals) {
          openingBalance = parseMoney(vals[vals.length - 1]);
          previousBalance = openingBalance;
        }
        continue;
      }

      // Handle Closing Balance Row 
      if (/Closing\s*balance/i.test(line)) {
        const vals = line.match(MONEY_RE);
        if (vals) closingBalance = parseMoney(vals[vals.length - 1]);
        continue;
      }

      if (moneyMatches) {
        // The last money value on a line is ALWAYS the running balance 
        const balance = parseMoney(moneyMatches[moneyMatches.length - 1]);
        
        // Calculate amount based on balance shift if previousBalance exists
        let amount = 0;
        if (previousBalance !== null) {
          amount = parseFloat((balance - previousBalance).toFixed(2));
        } else if (moneyMatches.length >= 2) {
          // Fallback if it's the first transaction after opening balance
          amount = parseMoney(moneyMatches[0]); 
        }

        transactions.push({
          date,
          description: description.split(/[R0-9]/)[0].trim(), // Clean description
          amount,
          balance,
          account: accountNumber,
          clientName,
          bankName,
          sourceFile
        });

        previousBalance = balance;
      }
    }
  }

  // Final metadata cleanup
  if (closingBalance === null && previousBalance !== null) {
    closingBalance = previousBalance;
  }

  return {
    metadata: { accountNumber, clientName, bankName, openingBalance, closingBalance, sourceFile },
    transactions
  };
}

function parseMoney(value) {
  if (!value) return 0;
  // Remove currency symbol, commas, spaces, and asterisks [cite: 84, 85]
  const clean = value.replace(/[R\s,*\+]/g, "");
  return parseFloat(clean);
}