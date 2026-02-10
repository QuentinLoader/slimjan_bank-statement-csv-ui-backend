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

  // 2. SPLIT BY TRANSACTION DATES
  const dateSplitRegex = /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))/g;
  const parts = text.split(dateSplitRegex);

  // Process parts: odd indices are dates, even indices are the transaction data
  for (let i = 1; i < parts.length; i += 2) {
    const dateStr = parts[i].trim();
    const dataBlock = parts[i + 1] || "";
    
    if (dataBlock.length < 10) continue;

    // Skip header sections
    if (dataBlock.toLowerCase().includes('opening balance') ||
        dataBlock.toLowerCase().includes('description amount balance')) {
      continue;
    }

    // 3. EXTRACT AMOUNTS - WITH FILTERING
    // Look for currency amounts with proper formatting
    const amountPattern = /([\d,]+\.\d{2})(Cr)?/g;
    const allAmounts = [...dataBlock.matchAll(amountPattern)];

    // FILTER: Remove amounts that are likely reference numbers
    const validAmounts = allAmounts.filter(match => {
      const numStr = match[1].replace(/,/g, '');
      const num = parseFloat(numStr);
      
      // Filter out invalid amounts:
      // 1. Too large (> 1 billion = likely a reference number)
      // 2. Has more than 2 digits before first comma/decimal in original (no proper formatting)
      
      if (num > 1000000000) return false; // Too large
      
      // Check if properly formatted (has commas for thousands)
      // Valid: "9,500.00" or "350.00" (under 1000)
      // Invalid: "27839489137350.00" (no commas in large number)
      if (num >= 1000 && !match[1].includes(',')) return false;
      
      return true;
    });

    // Need at least 2 valid amounts (transaction amount and balance)
    if (validAmounts.length < 2) continue;

    // Last valid amount is the balance, second-to-last is the transaction amount
    const balanceMatch = validAmounts[validAmounts.length - 1];
    const amountMatch = validAmounts[validAmounts.length - 2];

    // 4. EXTRACT DESCRIPTION
    const amountIndex = amountMatch.index;
    let description = dataBlock.substring(0, amountIndex).trim();
    
    // Clean description
    description = description.replace(/\s+/g, ' ').trim();
    description = description.replace(/^[\d\s\.,;:]+/, '').trim();
    
    // Remove any trailing long numbers (likely reference numbers that slipped through)
    description = description.replace(/\s*\d{10,}\s*$/, '').trim();
    
    // Skip invalid descriptions
    if (description.length < 3 || 
        description.toLowerCase().includes('accrued') ||
        description.toLowerCase().includes('charges')) {
      continue;
    }

    // 5. PARSE NUMBERS
    let amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    const balance = parseFloat(balanceMatch[1].replace(/,/g, ''));
    
    // Credit transactions have "Cr" suffix (positive), debits don't (negative)
    if (amountMatch[2] === 'Cr') {
      amount = Math.abs(amount);
    } else {
      amount = -Math.abs(amount);
    }

    // 6. FORMAT DATE
    const [day, monthName] = dateStr.split(/\s+/);
    const monthMap = {
      jan: "01", feb: "02", mar: "03", apr: "04",
      may: "05", jun: "06", jul: "07", aug: "08",
      sep: "09", oct: "10", nov: "11", dec: "12"
    };
    const month = monthMap[monthName.toLowerCase().substring(0, 3)] || "01";
    const formattedDate = `${day.padStart(2, '0')}/${month}/${statementYear}`;

    // 7. ADD TRANSACTION
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