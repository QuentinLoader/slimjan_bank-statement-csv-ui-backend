export const parseFnb = (text) => {
  const transactions = [];

  // 1. NORMALIZE TEXT - PDF extraction often removes spacing
  let cleanText = text.replace(/\s+/g, ' ');
  
  // 2. METADATA EXTRACTION
  const accountMatch = cleanText.match(/(\d{11})/);
  const account = accountMatch ? accountMatch[1] : "Unknown";

  const statementIdMatch = cleanText.match(/(?:Tax Invoice\/Statement Number|Statement Number|BBST)\s*:?\s*(\d+)/i);
  const statementId = statementIdMatch ? statementIdMatch[1] : "Unknown";

  const clientMatch = cleanText.match(/\*([A-Z\s&]+(?:PROPERTIES|PTY|LTD|CC)?)\s*\d+/);
  const clientName = clientMatch ? clientMatch[1].trim() : "Unknown";

  // Extract year from statement
  let statementYear = 2025;
  const yearMatch = cleanText.match(/(\d{4})\/\d{2}\/\d{2}/);
  if (yearMatch) statementYear = parseInt(yearMatch[1]);

  // 3. FIND TRANSACTION SECTION - More flexible matching
  const transStartPattern = /(?:Transactions in RAND|Date\s*Description\s*Amount\s*Balance)/i;
  const transStartMatch = cleanText.match(transStartPattern);
  
  if (!transStartMatch) {
    console.warn("Transaction section not found");
    return transactions;
  }

  let transSection = cleanText.substring(transStartMatch.index + transStartMatch[0].length);
  
  // Stop at Closing Balance or Turnover
  const endPattern = /(?:Closing Balance|Turnover for Statement Period|Please contact us)/i;
  const closingMatch = transSection.match(endPattern);
  if (closingMatch) {
    transSection = transSection.substring(0, closingMatch.index);
  }

  // 4. PARSE TRANSACTIONS
  // Look for patterns: "DD Mon Description Amount(Cr?) Balance(Cr?)"
  // More flexible regex that handles various spacing issues
  
  const transPattern = /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))\s+(.+?)\s+([\d,]+\.\d{2})\s*(Cr)?\s+([\d,]+\.\d{2})\s*(Cr)?/gi;
  
  const matches = [...transSection.matchAll(transPattern)];
  
  for (const match of matches) {
    const dateStr = match[1];
    let description = match[2];
    const amountStr = match[3];
    const amountCr = match[4];
    const balanceStr = match[5];
    const balanceCr = match[6];
    
    // Skip header-like content
    const descLower = description.toLowerCase();
    if (descLower.includes('opening balance') ||
        descLower.includes('description') ||
        descLower.includes('accrued') ||
        description.length < 3) {
      continue;
    }
    
    // Clean description
    description = description.trim().replace(/\s{2,}/g, ' ');
    
    // Remove any trailing reference numbers that might have been included
    description = description.replace(/\s+\d{10,}\s*$/, '');
    
    // Parse amount: Credits have "Cr" suffix (positive), debits don't (negative)
    let amount = parseFloat(amountStr.replace(/,/g, ''));
    if (amountCr === 'Cr') {
      amount = Math.abs(amount);
    } else {
      amount = -Math.abs(amount);
    }
    
    // Parse balance
    const balance = parseFloat(balanceStr.replace(/,/g, ''));
    
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