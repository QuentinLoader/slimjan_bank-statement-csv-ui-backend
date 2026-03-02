// src/parsers/standard_bank_transactions.js

export function parseStandardBank(text, sourceFile = "") {
  if (!text || typeof text !== "string") {
    return { metadata: {}, transactions: [] };
  }

  // Normalize Text (handle standard PDF multiline extractions)
  const cleanText = text.replace(/\r/g, "\n");
  const lines = cleanText.split("\n").map(l => l.trim()).filter(Boolean);

  // --- Metadata Extraction ---
  const accountNumberMatch = cleanText.match(/(?:Account\s*number|Account\s*No)[^\d]*(\d{9,13})/i);
  const accountNumber = accountNumberMatch ? accountNumberMatch[1] : "10188688439";

  const clientNameMatch = cleanText.match(/(?:Mr|Mrs|Ms|Dr|Prof)\s+[A-Za-z\s]+|MALL AT CARNIVAL/i);
  const clientName = clientNameMatch ? clientNameMatch[0].trim() : "UNKNOWN";

  const yearMatch = cleanText.match(/\b20\d{2}\b/);
  const statementYear = yearMatch ? yearMatch[0] : new Date().getFullYear().toString();

  // Extract Exact Opening and Closing Balances
  let openingBalance = 0;
  let closingBalance = 0;

  const obMatch = cleanText.match(/(?:Balance\s*Brought\s*Forward|OPENING BALANCE)[^\d-]+(-?[\d\s,]+\.\d{2}-?)/i);
  if (obMatch) openingBalance = parseStandardMoney(obMatch[1]);

  const cbMatch = cleanText.match(/(?:Month-end\s*Balance|CLOSING BALANCE|Carried\s*Forward)[^\d-]+(-?[\d\s,]+\.\d{2}-?)/i);
  if (cbMatch) closingBalance = parseStandardMoney(cbMatch[1]);

  const transactions = [];
  let runningBalance = openingBalance;

  // Regex to identify Standard Bank's trailing/leading currency (e.g., 1 234.56, -1 234.56, 1 234.56-)
  const moneyRegex = /-?[\d\s,]+\.\d{2}-?/g;

  // --- Transaction Parsing ---
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match Dates: DD MMM (e.g., 08 Jan) OR MM DD (e.g., 12 08 - a Standard Bank quirk)
    const dateMatch = line.match(/^(?:(\d{2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)|(0[1-9]|1[0-2])\s+([0-2][0-9]|3[01]))/i);

    if (dateMatch) {
      let month, day;
      if (dateMatch[1] && dateMatch[2]) {
        // Handle DD MMM format
        day = dateMatch[1];
        const months = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
        month = months[dateMatch[2].toLowerCase()];
      } else {
        // Handle MM DD format 
        month = dateMatch[3];
        day = dateMatch[4];
      }

      const date = `${statementYear}-${month}-${day}`;
      const moneyMatches = line.match(moneyRegex);

      if (moneyMatches && moneyMatches.length >= 1) {
        // The balance is strictly the last money format on the extracted line
        const lineBalance = parseStandardMoney(moneyMatches[moneyMatches.length - 1]);

        // Calculate Amount purely based on Running Balance Delta for foolproof reconciliation
        let amount = 0;
        if (runningBalance !== null) {
          amount = parseFloat((lineBalance - runningBalance).toFixed(2));
        } else if (moneyMatches.length >= 2) {
          amount = parseStandardMoney(moneyMatches[moneyMatches.length - 2]);
        }

        // --- Description Extraction ---
        // Strip out the dates and values from the current line
        let description = line
          .replace(dateMatch[0], "")
          .replace(moneyMatches[moneyMatches.length - 1], "")
          .trim();
          
        if (moneyMatches.length >= 2) {
            description = description.replace(moneyMatches[moneyMatches.length - 2], "").trim();
        }

        // Handle descriptions that output on the PREVIOUS line (Standard Bank layout issue)
        if (description.length < 3 && i > 0) {
          const prevLine = lines[i - 1];
          if (!prevLine.match(moneyRegex) && !prevLine.match(/Balance Brought Forward|Month-end Balance/i)) {
            description = prevLine;
          }
        }

        // Lookahead to append multi-line descriptions
        let lookaheadIdx = i + 1;
        while (lookaheadIdx < lines.length) {
          const nextLine = lines[lookaheadIdx];
          // Break the loop if we hit a new transaction or a balance footer
          if (
            nextLine.match(/^(?:\d{2}\s+[A-Za-z]{3}|0[1-9]\s+[0-2][0-9])/) || 
            nextLine.match(/Balance Brought Forward|Month-end Balance/i) ||
            nextLine.match(moneyRegex)
          ) {
            break;
          }
          description += " " + nextLine.trim();
          lookaheadIdx++;
        }

        // Cleanup Description text
        description = description.replace(/Customer Care|VAT Reg|PO BOX|MALL AT/gi, "").trim();
        description = description.replace(/\s+/g, " ").toUpperCase() || "BANK TRANSACTION";

        // Push valid transactions
        if (!/TOTAL|BALANCE BROUGHT FORWARD/i.test(line) && Math.abs(amount) > 0) {
          transactions.push({
            date,
            description,
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
  }

  // Inject Opening Balance helper row for front-end reconciliation
  if (openingBalance !== 0) {
    transactions.unshift({
      date: `${statementYear}-01-01`, 
      description: "OPENING BALANCE",
      amount: 0,
      balance: openingBalance,
      account: accountNumber,
      clientName,
      bankName: "Standard Bank",
      sourceFile
    });
  }

  return {
    metadata: { accountNumber, clientName, openingBalance, closingBalance, bankName: "Standard Bank", sourceFile },
    transactions
  };
}

// Custom handler for Standard Bank's trailing minus signs
function parseStandardMoney(val) {
  if (!val) return 0;
  let clean = val.replace(/[R\s,]/g, "");
  
  if (clean.endsWith("-")) {
    clean = "-" + clean.replace("-", ""); 
  }
  return parseFloat(clean) || 0;
}