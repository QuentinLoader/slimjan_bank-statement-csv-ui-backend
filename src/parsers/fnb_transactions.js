export const parseFnb = (text) => {
  const transactions = [];

  // 1. METADATA EXTRACTION
  const accountMatch = text.match(/(\d{11})/);
  const account = accountMatch ? accountMatch[1] : "Unknown";

  const statementIdMatch = text.match(/BBST(\d+)/i);
  const statementId = statementIdMatch ? statementIdMatch[1] : "Unknown";

  const clientMatch = text.match(/\*([A-Z\s]+PROPERTIES[A-Z\s]*?)(?:\d|$)/);
  const clientName = clientMatch ? clientMatch[1].trim() : "Unknown";

  let statementYear = 2025;
  const yearMatch = text.match(/(\d{4})\/\d{2}\/\d{2}/);
  if (yearMatch) statementYear = parseInt(yearMatch[1]);

  // 2. FIND TRANSACTION SECTION
  const transStartMatch = text.match(/Transactions in RAND.*?(?:Date.*?Description.*?Amount.*?Balance|$)/is);
  if (!transStartMatch) {
    return transactions;
  }

  let transSection = text.substring(transStartMatch.index + transStartMatch[0].length);
  
  const closingMatch = transSection.match(/Closing Balance/i);
  if (closingMatch) {
    transSection = transSection.substring(0, closingMatch.index);
  }

  // 3. SPLIT BY DATES THEN PARSE EACH BLOCK
  const dateSplitRegex = /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))/gi;
  const parts = transSection.split(dateSplitRegex);
  
  const matches = [];
  
  // Process date-data pairs
  for (let i = 1; i < parts.length; i += 2) {
    const dateStr = parts[i];
    const dataBlock = parts[i + 1] || "";
    
    if (dataBlock.length < 5) continue;
    
    // Skip headers
    if (dataBlock.toLowerCase().includes('opening balance') ||
        dataBlock.toLowerCase().includes('description')) {
      continue;
    }
    
    // Find all currency amounts in this block
    const amountRegex = /([\d,]+\.\d{2})(Cr)?/g;
    const amounts = [...dataBlock.matchAll(amountRegex)];
    
    // Filter valid amounts (not reference numbers)
    const validAmounts = amounts.filter(amt => {
      const num = parseFloat(amt[1].replace(/,/g, ''));
      // Reject if > 100 million OR if large number without commas
      if (num > 100000000) return false;
      if (num >= 1000 && !amt[1].includes(',')) return false;
      return true;
    });
    
    if (validAmounts.length < 2) continue;
    
    // FNB FORMAT: Description Amount(Cr?) Balance(Cr?) [BankCharges?]
    // Strategy:
    // - If we have 2 amounts: amount, balance
    // - If we have 3 amounts: amount, balance, bank_charges
    // - If we have 4+ amounts: likely has amounts in description, take last 2-3
    
    let amountMatch, balanceMatch, bankChargesMatch;
    
    if (validAmounts.length === 2) {
      amountMatch = validAmounts[0];
      balanceMatch = validAmounts[1];
    } else if (validAmounts.length === 3) {
      // Check if last amount is small (< 50) and has no Cr marker = likely bank charges
      const lastAmount = validAmounts[2];
      const lastValue = parseFloat(lastAmount[1].replace(/,/g, ''));
      
      if (lastValue < 50 && !lastAmount[2]) {
        // Pattern: amount, balance, bank_charges
        amountMatch = validAmounts[0];
        balanceMatch = validAmounts[1];
        bankChargesMatch = validAmounts[2];
      } else {
        // Pattern: (amount in description), amount, balance
        amountMatch = validAmounts[1];
        balanceMatch = validAmounts[2];
      }
    } else {
      // 4+ amounts: likely has amounts in description
      // Check last amount for bank charges
      const lastAmount = validAmounts[validAmounts.length - 1];
      const lastValue = parseFloat(lastAmount[1].replace(/,/g, ''));
      
      if (lastValue < 50 && !lastAmount[2]) {
        // Has bank charges: take 3rd-to-last as amount, 2nd-to-last as balance
        amountMatch = validAmounts[validAmounts.length - 3];
        balanceMatch = validAmounts[validAmounts.length - 2];
        bankChargesMatch = validAmounts[validAmounts.length - 1];
      } else {
        // No bank charges: take last 2
        amountMatch = validAmounts[validAmounts.length - 2];
        balanceMatch = validAmounts[validAmounts.length - 1];
      }
    }
    
    // Extract description (everything before the amount)
    const descEnd = dataBlock.indexOf(amountMatch[0]);
    let description = dataBlock.substring(0, descEnd).trim();
    
    matches.push({
      dateStr,
      description,
      amountStr: amountMatch[1],
      amountCr: amountMatch[2],
      balanceStr: balanceMatch[1],
      balanceCr: balanceMatch[2]
    });
  }
  
  // 4. PROCESS MATCHES
  for (const match of matches) {
    const { dateStr, amountStr, amountCr, balanceStr, balanceCr } = match;
    let { description } = match;

    // Clean description
    description = description.trim();
    description = description.replace(/[\d\s,\.]+(?:Cr)?$/i, '').trim();
    description = description.replace(/\s+/g, ' ').trim();
    description = description.replace(/^[\d\s,\.;:]+/, '').trim();

    if (description.length < 3) continue;

    // Parse amount
    let amount = parseFloat(amountStr.replace(/,/g, ''));
    
    if (amount > 1000000000) continue;
    
    if (amountCr === 'Cr') {
      amount = Math.abs(amount);
    } else {
      amount = -Math.abs(amount);
    }

    // Parse balance
    const balance = parseFloat(balanceStr.replace(/,/g, ''));
    
    if (balance > 1000000000) continue;

    // Format date
    const [day, monthName] = dateStr.split(/\s+/);
    const monthMap = {
      jan: "01", feb: "02", mar: "03", apr: "04",
      may: "05", jun: "06", jul: "07", aug: "08",
      sep: "09", oct: "10", nov: "11", dec: "12"
    };
    const month = monthMap[monthName.toLowerCase().substring(0, 3)] || "01";
    const formattedDate = `${day.padStart(2, '0')}/${month}/${statementYear}`;

    transactions.push({
      date: formattedDate,
      description: description,
      amount: amount,
      balance: balance,
      account: account,
      clientName: clientName,
      uniqueDocNo: statementId,
      bankName: "FNB"
    });
  }

  return transactions;
};