/**
 * Capitec Parser - Final Version  
 * Properly parses Capitec Main Account Statement table format
 * Columns: Date | Description | Category | Money In | Money Out | Fee | Balance
 */

export const parseCapitec = (text) => {
  const transactions = [];

  // Parse Rand amounts
  const parseAmount = (val) => {
    if (!val) return 0;
    let clean = val.trim().replace(/R/g, '').replace(/\s/g, '');
    let isNeg = clean.startsWith('-') || clean.endsWith('-');
    clean = clean.replace(/[^0-9.]/g, '');
    const num = parseFloat(clean) || 0;
    return isNeg ? -Math.abs(num) : num;
  };

  // Extract account number
  const accountMatch = text.match(/Account\s+(\d{10,})/i);
  const account = accountMatch ? accountMatch[1] : "Unknown";

  // Extract client name
  let clientName = "";
  const nameMatch = text.match(/^(MR|MS|MRS|DR)\s+([A-Z\s]+?)(?=\n)/m);
  if (nameMatch) {
    clientName = nameMatch[0].trim();
  }

  // Extract balances
  let openingBalance = 0;
  let closingBalance = 0;
  
  const openMatch = text.match(/Opening Balance:\s*R?([\d\s,.]+)/i);
  if (openMatch) openingBalance = parseAmount(openMatch[1]);
  
  const closeMatch = text.match(/Closing Balance:\s*R?([\d\s,.]+)/i);
  if (closeMatch) closingBalance = parseAmount(closeMatch[1]);

  // Footer detection
  const footerStopWords = [
    "24hr Client Care Centre",
    "Capitec Bank is an authorised",
    "Unique Document No.:",
    "Page ",
    "* Includes VAT"
  ];

  const lines = text.split('\n');
  let inTransactionSection = false;
  let currentDate = null;
  let currentDesc = '';
  let currentCategory = '';
  let currentMoneyIn = 0;
  let currentMoneyOut = 0;
  let currentFee = 0;
  let currentBalance = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Start of transaction table
    if (line.match(/^Date\s+Description\s+Category/i)) {
      inTransactionSection = true;
      continue;
    }
    
    if (!inTransactionSection) continue;
    
    // Check for footer
    let hitFooter = footerStopWords.some(word => line.includes(word));
    if (hitFooter) {
      // Save last transaction before stopping
      if (currentDate) {
        const amount = currentMoneyIn > 0 ? 
          currentMoneyIn : 
          (currentMoneyOut > 0 ? -currentMoneyOut : 0);
        
        transactions.push({
          date: currentDate,
          description: currentDesc.trim(),
          category: currentCategory,
          moneyIn: currentMoneyIn > 0 ? currentMoneyIn : null,
          moneyOut: currentMoneyOut > 0 ? currentMoneyOut : null,
          fee: currentFee !== 0 ? currentFee : null,
          amount: amount + (currentFee || 0),
          balance: currentBalance,
          account: account,
          clientName: clientName,
          bankName: "Capitec"
        });
      }
      break;
    }
    
    // Match date at line start
    const dateMatch = line.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(.+)/);
    
    if (dateMatch) {
      // Save previous transaction
      if (currentDate) {
        const amount = currentMoneyIn > 0 ? 
          currentMoneyIn : 
          (currentMoneyOut > 0 ? -currentMoneyOut : 0);
        
        transactions.push({
          date: currentDate,
          description: currentDesc.trim(),
          category: currentCategory,
          moneyIn: currentMoneyIn > 0 ? currentMoneyIn : null,
          moneyOut: currentMoneyOut > 0 ? currentMoneyOut : null,
          fee: currentFee !== 0 ? currentFee : null,
          amount: amount + (currentFee || 0),
          balance: currentBalance,
          account: account,
          clientName: clientName,
          bankName: "Capitec"
        });
      }
      
      // Start new transaction
      currentDate = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`;
      const restOfLine = dateMatch[4];
      
      // Extract numbers from right to left
      // Balance is always last (may have trailing spaces)
      const balanceMatch = restOfLine.match(/([-]?[\d\s,.]+)\s*$/);
      if (balanceMatch) {
        currentBalance = parseAmount(balanceMatch[1]);
      }
      
      // Remove balance
      let remaining = balanceMatch ? 
        restOfLine.substring(0, restOfLine.lastIndexOf(balanceMatch[1])).trim() : 
        restOfLine;
      
      // Look for fee (small negative number, often with *)
      const feePattern = /([-][\d.]+)\s*$/;
      const feeMatch = remaining.match(feePattern);
      currentFee = 0;
      
      if (feeMatch) {
        const potentialFee = parseAmount(feeMatch[1]);
        // Fee is typically under R20
        if (Math.abs(potentialFee) <= 20) {
          currentFee = potentialFee;
          remaining = remaining.substring(0, remaining.lastIndexOf(feeMatch[1])).trim();
        }
      }
      
      // Look for Money Out (larger negative or just a number)
      const moneyOutPattern = /([-]?[\d\s,.]+)\s*$/;
      const moneyOutMatch = remaining.match(moneyOutPattern);
      currentMoneyOut = 0;
      
      if (moneyOutMatch) {
        const val = parseAmount(moneyOutMatch[1]);
        if (Math.abs(val) > 0) {
          currentMoneyOut = Math.abs(val);
          remaining = remaining.substring(0, remaining.lastIndexOf(moneyOutMatch[1])).trim();
        }
      }
      
      // Look for Money In (positive number)
      const moneyInPattern = /([\d\s,.]+)\s*$/;
      const moneyInMatch = remaining.match(moneyInPattern);
      currentMoneyIn = 0;
      
      if (moneyInMatch) {
        const val = parseAmount(moneyInMatch[1]);
        if (val > 0 && !moneyInMatch[1].includes('-')) {
          currentMoneyIn = val;
          remaining = remaining.substring(0, remaining.lastIndexOf(moneyInMatch[1])).trim();
        }
      }
      
      // Category is typically the last 1-3 capitalized words
      const categoryPattern = /\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})\s*$/;
      const categoryMatch = remaining.match(categoryPattern);
      currentCategory = '';
      
      if (categoryMatch) {
        currentCategory = categoryMatch[1];
        remaining = remaining.substring(0, remaining.lastIndexOf(categoryMatch[1])).trim();
      }
      
      // What's left is the description
      currentDesc = remaining;
      
    } else if (currentDate && line.trim().length > 0) {
      // Continuation line
      const trimmed = line.trim();
      
      // Skip if it's a footer
      if (footerStopWords.some(word => trimmed.includes(word))) continue;
      
      // Skip if it's just numbers or column headers
      if (trimmed.match(/^[0-9R\s,.-]+$/) || 
          trimmed.match(/^(Date|Description|Category|Money|Fee|Balance)/i)) {
        continue;
      }
      
      // Add to description
      currentDesc += ' ' + trimmed;
    }
  }
  
  // Add final transaction
  if (currentDate) {
    const amount = currentMoneyIn > 0 ? 
      currentMoneyIn : 
      (currentMoneyOut > 0 ? -currentMoneyOut : 0);
    
    transactions.push({
      date: currentDate,
      description: currentDesc.trim(),
      category: currentCategory,
      moneyIn: currentMoneyIn > 0 ? currentMoneyIn : null,
      moneyOut: currentMoneyOut > 0 ? currentMoneyOut : null,
      fee: currentFee !== 0 ? currentFee : null,
      amount: amount + (currentFee || 0),
      balance: currentBalance,
      account: account,
      clientName: clientName,
      bankName: "Capitec"
    });
  }
  
  // Clean up descriptions
  transactions.forEach(txn => {
    txn.description = txn.description.replace(/\s+/g, ' ').trim();
  });

  return {
    metadata: {
      accountNumber: account,
      clientName: clientName,
      openingBalance,
      closingBalance,
      bankName: "Capitec"
    },
    transactions
  };
};