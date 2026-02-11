/**
 * FNB PDF Statement Parser (Robust "Anchor & Slice" Version)
 * * Strategy:
 * 1. Anchors on the financial columns (Balance & Fee) at the end of lines.
 * 2. Handled "Merged Text" (e.g. "Ref1234500.00") by slicing numbers off the description string.
 * 3. Extracts Date from the remaining text block, regardless of position.
 */

export const parseFnb = (text) => {
  const transactions = [];

  // ===========================================================================
  // 1. METADATA EXTRACTION
  // ===========================================================================
  const accountMatch = text.match(/Account Number\s*[:\.]?\s*(\d{11})/i) || text.match(/(\d{11})/);
  const account = accountMatch ? accountMatch[1] : "Unknown";

  const statementIdMatch = text.match(/Statement Number\s*[:\.]?\s*(\d+)/i) || text.match(/BBST(\d+)/i);
  const uniqueDocNo = statementIdMatch ? statementIdMatch[1] : "Unknown";

  // Determine Year from Statement Period
  let currentYear = new Date().getFullYear();
  const periodMatch = text.match(/Statement Period.*?\d{1,2}\s+[A-Za-z]+\s+(\d{4})/i);
  if (periodMatch) {
    currentYear = parseInt(periodMatch[1], 10);
  }

  const clientMatch = text.match(/\*([A-Z\s]+PROPERTIES)/);
  const clientName = clientMatch ? clientMatch[1].trim() : "Unknown";

  // ===========================================================================
  // 2. TEXT CLEANUP
  // ===========================================================================
  // Remove headers/footers that interrupt transaction flows
  let cleanText = text
    .replace(/Page \d+ of \d+/gi, '')
    .replace(/Delivery Method.*?$/gim, '')
    .replace(/Branch Number.*?Account Number/is, '') 
    .replace(/Transactions in RAND/i, 'START_TRANSACTIONS');

  const startMarker = cleanText.indexOf('START_TRANSACTIONS');
  if (startMarker !== -1) cleanText = cleanText.substring(startMarker);

  // Remove Closing Balance section to avoid false positives
  const closingMarker = cleanText.match(/Closing Balance\s+[\d,]+\.\d{2}/i);
  if (closingMarker) cleanText = cleanText.substring(0, closingMarker.index);

  // ===========================================================================
  // 3. ROW PARSING (The "Anchor" Strategy)
  // ===========================================================================
  // We split by detecting the financial block at the end of a line.
  // Pattern: Amount (space) Balance (space Fee? optional)
  
  // 1. Split text into lines, but re-join wrapped lines. 
  // Actually, simpler: regex match the whole block ending in numbers.
  
  // Regex: 
  // Group 1: Description (greedy)
  // Group 2: Amount (digits, commas, dot, 2 digits, optional Cr/Dr)
  // Group 3: Balance (same format)
  // Group 4: Optional Fee (same format, optional)
  // Note: We use [\s\S]*? for description to match across wrapped lines if needed, 
  // but usually FNB PDF text extraction is linear.
  
  // We filter for lines that end with at least TWO numbers (Amount + Balance).
  // "Fee" is the optional 3rd number.
  
  const linePattern = /(.*?)\s+([0-9,]+\.[0-9]{2})(Cr|Dr)?\s+([0-9,]+\.[0-9]{2})(Cr|Dr)?(?:\s+([0-9,]+\.[0-9]{2})(Cr|Dr)?)?$/gm;
  
  let match;
  while ((match = linePattern.exec(cleanText)) !== null) {
    let rawDesc = match[1].trim();
    
    // --- FINANCIALS ---
    // Standard FNB Order: Amount -> Balance -> [Fee]
    let amountStr = match[2];
    let amountSign = match[3]; // Cr or Dr or undefined
    let balanceStr = match[4];
    
    // Check if there is a 3rd number (Fee)
    // If match[6] exists, it's the Fee. Balance is match[4]. Amount is match[2].
    // Sometimes text merges happen. We need to be careful.
    
    // --- HANDLING MERGED AMOUNTS ---
    // If the Amount (match[2]) was stripped correctly, `rawDesc` is clean.
    // BUT, if the text was "Ref100500.00", the regex might capture "500.00" as match[2]
    // leaving "Ref100" in rawDesc. This is actually correct behavior!
    // The issue in your previous code was splitting by space. Regex avoids this.
    
    // Parse Values
    let amount = parseFloat(amountStr.replace(/,/g, ''));
    let balance = parseFloat(balanceStr.replace(/,/g, ''));
    
    // Sign Logic: FNB "Cr" = Money In (+), No Sign/Dr = Money Out (-)
    if (amountSign === 'Cr') {
        amount = Math.abs(amount);
    } else {
        amount = -Math.abs(amount);
    }

    // --- DESCRIPTION & DATE ---
    // Clean up the description
    // FNB Dates: "DD Mon" (20 Jan) or "YYYY/MM/DD"
    // Usually at the start or end of the text block.
    
    let dateStr = "";
    let cleanDesc = rawDesc;
    
    // Date Regex: "17 Jan" or "3 Feb"
    const dateRegex = /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i;
    const dateMatch = rawDesc.match(dateRegex);
    
    if (dateMatch) {
        // Construct Date
        const day = dateMatch[1].padStart(2, '0');
        const monthStr = dateMatch[2].toLowerCase();
        const months = { jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06', jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12' };
        
        // Year logic (Handle Dec/Jan crossover)
        let txYear = currentYear;
        if (monthStr === 'dec' && new Date().getMonth() < 3) txYear -= 1;
        
        dateStr = `${day}/${months[monthStr]}/${txYear}`;
        
        // Remove date from description
        cleanDesc = cleanDesc.replace(dateMatch[0], '').trim();
    } else {
        // Fallback or explicit YYYY/MM/DD
        dateStr = `01/01/${currentYear}`;
    }

    // Final Cleanup of Description
    cleanDesc = cleanDesc
        .replace(/^\s*[\d\.,]+\s*/, '') // Remove loose numbers at start
        .replace(/\s+/g, ' ');          // Fix spaces

    // Filter out "Opening Balance" lines
    if (cleanDesc.toLowerCase().includes('opening balance')) continue;

    transactions.push({
      date: dateStr,
      description: cleanDesc,
      amount: amount,
      balance: balance,
      account: account,
      bankName: "FNB",
      bankLogo: "fnb",
      clientName: clientName,
      uniqueDocNo: uniqueDocNo
    });
  }

  return transactions;
};