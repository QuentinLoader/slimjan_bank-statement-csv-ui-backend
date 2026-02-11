/**
 * FNB "Flattened Stream" Parser
 * * Strategy:
 * 1. Flattens ALL whitespace/newlines to single spaces. This fixes "No Description" issues.
 * 2. Uses a robust regex that can handle mashed text ("20JanRef") and spaced text ("20 Jan Ref").
 * 3. Extracts Amount and Balance as the anchors.
 */

export const parseFnb = (text) => {
  const transactions = [];

  // ===========================================================================
  // 1. METADATA EXTRACTION (Pre-Flattening)
  // ===========================================================================
  // We extract these before flattening just in case, but usually loose regex works fine.
  
  const accountMatch = text.match(/Account\D*?(\d{11})/i) || text.match(/(\d{11})/);
  const account = accountMatch ? accountMatch[1] : "Unknown";

  const statementIdMatch = text.match(/BBST(\d+)/i);
  const uniqueDocNo = statementIdMatch ? statementIdMatch[1] : "Unknown";

  // Client Name: Matches "PROPERTIES", "LIVING BRANCH", "LTD", "PTY" etc.
  const clientMatch = text.match(/\*?([A-Z\s\.]+(?:PROPERTIES|LIVING|TRADING|LTD|PTY)[A-Z\s\.]*)/i);
  const clientName = clientMatch ? clientMatch[1].trim() : "Unknown";

  // Year Detection
  let currentYear = new Date().getFullYear();
  const dateHeader = text.match(/(20\d{2})\/\d{2}\/\d{2}/);
  if (dateHeader) currentYear = parseInt(dateHeader[1]);

  // ===========================================================================
  // 2. TEXT FLATTENING (The Critical Fix)
  // ===========================================================================
  // Collapse all newlines, tabs, and multiple spaces into a SINGLE space.
  // This converts the "vertical" log output into a "horizontal" stream.
  let cleanText = text
    .replace(/\s+/g, ' ')  // <--- THIS IS THE KEY FIX
    .replace(/Page \d+ of \d+/gi, ' ') 
    .replace(/Transactions in RAND/i, ' ');

  // ===========================================================================
  // 3. PARSING LOGIC
  // ===========================================================================
  // Pattern: 
  // [Date] ... [Description] ... [Amount] ... [Balance]
  
  // Regex Breakdown:
  // 1. Date: (\d{1,2})\s*(Jan|Feb...) 
  // 2. Description: (.*?) -> Non-greedy match until the Amount matches
  // 3. Amount: ([0-9\s,]+\.[0-9]{2}) -> Allows spaces in numbers (e.g. "1 000.00")
  // 4. Balance: ([0-9\s,]+\.[0-9]{2})
  
  const flatRegex = /(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*(.*?)\s*([0-9\s,]+\.[0-9]{2})\s*(Cr|Dr)?\s*([0-9\s,]+\.[0-9]{2})\s*(Cr|Dr)?/gi;

  let match;
  while ((match = flatRegex.exec(cleanText)) !== null) {
    const day = match[1].padStart(2, '0');
    const monthRaw = match[2];
    let description = match[3].trim();
    const amountRaw = match[4];
    const amountSign = match[5]; // Cr or Dr
    const balanceRaw = match[6];
    
    // --- Validation ---
    if (description.toLowerCase().includes('opening balance')) continue;
    if (description.toLowerCase().includes('brought forward')) continue;
    
    // Check for false positives (Description too long = missed previous stop?)
    // But since text is flattened, we rely on the Amount match to stop the description.
    if (description.length > 150) continue; 
    if (description.length < 2) continue; // Skip empty descriptions

    // --- Date Formatting ---
    const months = { Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06', Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12' };
    const month = months[monthRaw] || months[monthRaw.substring(0,3)]; 
    
    let txYear = currentYear;
    // Handle Year Rollover (Dec transaction in Jan statement)
    if (month === '12' && new Date().getMonth() < 3) txYear = currentYear - 1;
    
    const dateStr = `${day}/${month}/${txYear}`;

    // --- Amount Formatting ---
    // Remove spaces/commas to parse float (e.g. "1 000.00" -> "1000.00")
    let amount = parseFloat(amountRaw.replace(/[\s,]/g, ''));
    let balance = parseFloat(balanceRaw.replace(/[\s,]/g, ''));

    // FNB Logic: Cr = Income (+), No Sign/Dr = Expense (-)
    if (amountSign === 'Cr') {
      amount = Math.abs(amount);
    } else {
      amount = -Math.abs(amount);
    }
    
    // --- Description Cleanup ---
    // Remove loose numbers/dates at start of description
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

  // --- FALLBACK: YYYY/MM/DD Format ---
  // Some FNB statements use 2025/01/20 instead of 20 Jan.
  // We run this ONLY if the first pass found few items.
  if (transactions.length < 2) {
      const isoRegex = /(\d{4})\/(\d{2})\/(\d{2})\s*(.*?)\s*([0-9\s,]+\.[0-9]{2})\s*(Cr|Dr)?\s*([0-9\s,]+\.[0-9]{2})\s*(Cr|Dr)?/gi;
      while ((match = isoRegex.exec(cleanText)) !== null) {
          let description = match[4].trim();
          if (description.toLowerCase().includes('opening balance')) continue;
          
          let amount = parseFloat(match[5].replace(/[\s,]/g, ''));
          let balance = parseFloat(match[7].replace(/[\s,]/g, ''));
          if (match[6] !== 'Cr') amount = -Math.abs(amount);

          const dateStr = `${match[3]}/${match[2]}/${match[1]}`; // DD/MM/YYYY

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
  }

  return transactions;
};