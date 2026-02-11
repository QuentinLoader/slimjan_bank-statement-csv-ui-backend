/**
 * FNB "Zero-Whitespace" Parser
 * * Designed for "mashed" PDF text where spaces are missing.
 * * Handles: "20JanReference100.00200.00"
 */

export const parseFnb = (text) => {
  const transactions = [];

  // 1. METADATA (Relaxed matching)
  const accountMatch = text.match(/Account\D*?(\d{11})/i) || text.match(/(\d{11})/);
  const account = accountMatch ? accountMatch[1] : "Unknown";

  const statementIdMatch = text.match(/BBST(\d+)/i);
  const uniqueDocNo = statementIdMatch ? statementIdMatch[1] : "Unknown";

  // Client Name: Look for "PROPERTIES" or "LIVING BRANCH"
  const clientMatch = text.match(/\*?([A-Z\s\.]+(?:PROPERTIES|LIVING|TRADING|LTD|PTY)[A-Z\s\.]*)/i);
  const clientName = clientMatch ? clientMatch[1].trim() : "Unknown";

  // Year detection (Look for 202X/XX/XX)
  let currentYear = new Date().getFullYear();
  const dateHeader = text.match(/(20\d{2})\/\d{2}\/\d{2}/);
  if (dateHeader) currentYear = parseInt(dateHeader[1]);

  // 2. TEXT CLEANUP
  // Remove clutter but keep the stream intact
  let cleanText = text
    .replace(/Page \d+ of \d+/gi, '')
    .replace(/Transactions in RAND/i, '');

  // 3. AGGRESSIVE PARSING (The "Mashed" Regex)
  // Pattern: 
  // [Date: 1-2 digits + 3 letters] (e.g. 20Jan)
  // [Desc: Anything until a number] (Non-greedy)
  // [Amount: Number.Number]
  // [Balance: Number.Number]
  
  // Note: \s* means "zero or more spaces"
  const mashedRegex = /(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*(.*?)\s*([0-9,]+\.[0-9]{2})(Cr|Dr)?\s*([0-9,]+\.[0-9]{2})(Cr|Dr)?/gi;

  let match;
  while ((match = mashedRegex.exec(cleanText)) !== null) {
    const day = match[1].padStart(2, '0');
    const monthRaw = match[2];
    let description = match[3].trim();
    const amountRaw = match[4];
    const amountSign = match[5]; // Cr or Dr
    const balanceRaw = match[6];
    
    // --- Validation ---
    // If description contains "Opening Balance", skip
    if (description.toLowerCase().includes('opening balance')) continue;
    
    // If description is unreasonably long (>150 chars), it's a false positive
    if (description.length > 150) continue;

    // --- Date Formatting ---
    const months = { Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06', Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12' };
    const month = months[monthRaw] || months[monthRaw.substring(0,3)]; // Handle case sensitivity if needed
    
    let txYear = currentYear;
    // Year rollover logic (Dec trans in Jan statement)
    if (month === '12' && new Date().getMonth() < 3) txYear = currentYear - 1;
    
    const dateStr = `${day}/${month}/${txYear}`;

    // --- Amount Formatting ---
    let amount = parseFloat(amountRaw.replace(/,/g, ''));
    let balance = parseFloat(balanceRaw.replace(/,/g, ''));

    // FNB Logic: Cr = Income, No Sign = Expense
    if (amountSign === 'Cr') {
      amount = Math.abs(amount);
    } else {
      amount = -Math.abs(amount);
    }
    
    // Cleanup Description (remove loose dates/numbers at start)
    description = description.replace(/^[\d\-\.\s]+/, '');

    transactions.push({
      date: dateStr,
      description: description,
      amount: amount,
      balance: balance,
      account: account,
      bankName: "FNB",
      clientName: clientName,
      uniqueDocNo: uniqueDocNo
    });
  }

  return transactions;
};