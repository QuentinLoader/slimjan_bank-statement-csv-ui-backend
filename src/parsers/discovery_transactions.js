// src/parsers/discovery_bank_transactions.js

export function parseDiscovery(text, sourceFile = "") {
  if (!text || typeof text !== "string") {
    return { metadata: {}, transactions: [] };
  }

  // Normalize: Keep newlines but remove carriage returns
  const cleanText = text.replace(/\r/g, "");

  // --- Metadata Extraction ---
  const accountNumberMatch = cleanText.match(/(?:Discovery Gold Transaction Account)[^\d]+(\d{10,15})/i);
  const accountNumber = accountNumberMatch ? accountNumberMatch[1] : null; 
  
  const clientNameMatch = cleanText.match(/(?:Mr|Mrs|Ms|Dr|Prof)\s+[A-Za-z\s]+/); 
  const clientName = clientNameMatch ? clientNameMatch[0].trim() : null; 

  const openingBalanceMatch = cleanText.match(/"Opening balance"[^\d-]+(-?\s?R[\d\s,.-]+\.\d{2})/i); 
  const openingBalance = openingBalanceMatch ? parseMoney(openingBalanceMatch[1]) : 0; 

  const closingBalanceMatch = cleanText.match(/"Closing balance"[^\d-]+(-?\s?R[\d\s,.-]+\.\d{2})/i); 
  const closingBalance = closingBalanceMatch ? parseMoney(closingBalanceMatch[1]) : 0; 

  const transactions = [];
  let runningBalance = openingBalance;

  const months = { 
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", 
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" 
  };

  // --- Custom CSV Lexer ---
  const rows = [];
  let currentRow = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    if (inQuotes) {
      if (char === '"' && cleanText[i + 1] === '"') {
        currentCell += '"'; i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') inQuotes = true;
      else if (char === ',') { currentRow.push(currentCell); currentCell = ""; }
      else if (char === '\n') { 
        currentRow.push(currentCell); 
        rows.push(currentRow); 
        currentRow = []; currentCell = ""; 
      }
      else currentCell += char;
    }
  }
  if (currentCell || currentRow.length > 0) { currentRow.push(currentCell); rows.push(currentRow); }

  // --- Unzip & Parse Transactions ---
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j];
    if (!row || row.length === 0) continue;

    if (row[0]) {
      const weirdDateMatch = row[0].match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(20\d{2})[\s\n]+(\d{1,2})/);
      if (weirdDateMatch) {
        row[0] = row[0].replace(weirdDateMatch[0], `${weirdDateMatch[3]} ${weirdDateMatch[1]} ${weirdDateMatch[2]}`);
      }
    }

    const splitCells = row.map(cell => cell ? cell.split('\n').map(c => c.trim()) : []);
    const maxLines = Math.max(1, ...splitCells.map(c => c.length));
    
    for (let i = 0; i < maxLines; i++) {
      const newRow = splitCells.map(c => (c[i] !== undefined ? c[i] : ""));
      
      if (newRow.some(cell => cell !== "")) {
        const dateMatch = newRow[0]?.match(/^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(20\d{2})/);
        
        if (dateMatch) {
          const day = dateMatch[1].padStart(2, "0");
          const month = months[dateMatch[2]];
          const year = dateMatch[3];
          const date = `${year}-${month}-${day}`;

          let amountStr = newRow[newRow.length - 1];
          if (!amountStr || !amountStr.match(/R[\d\s,.]+/)) {
            amountStr = newRow[newRow.length - 2]; 
          }

          if (amountStr && amountStr.match(/R[\d\s,.]+/)) {
            const amount = parseMoney(amountStr);
            
            let description = newRow.slice(1, -1)
                .filter(col => col && !col.startsWith("***") && !col.match(/R[\d\s,.]+/))
                .join(" ")
                .trim();

            runningBalance = Number((runningBalance + amount).toFixed(2));

            transactions.push({
              date,
              description: description.toUpperCase() || "UNKNOWN",
              amount,
              balance: runningBalance,
              account: accountNumber,
              clientName,
              bankName: "Discovery",
              sourceFile
            });
          }
        }
      }
    }
  }

  return {
    metadata: { accountNumber, clientName, openingBalance, closingBalance, bankName: "Discovery", sourceFile },
    transactions
  };
}

function parseMoney(val) {
  if (!val) return 0;
  const clean = val.replace(/[R,\s]/g, "");
  return parseFloat(clean) || 0;
}