export const parseCapitec = (text) => {
  const transactions = [];
  
  // 1. IMPROVED METADATA EXTRACTION
  // Look for Account Number and Client Name in the first 2000 characters
  const headerArea = text.slice(0, 2000);
  const accountNumberMatch = headerArea.match(/Account No[:\s]+(\d{10,})/i);
  const accountNumber = accountNumberMatch ? accountNumberMatch[1] : "Not Found";
  
  // 2. DEFINE BOUNDARIES
  const startMarker = "Transaction History";
  const stopMarkers = ["Spending Summary", "Card Subscriptions", "Notes", "Unique Document No"];
  
  let validSection = text;
  if (text.includes(startMarker)) {
    validSection = text.split(startMarker)[1];
  }
  
  for (const marker of stopMarkers) {
    if (validSection.includes(marker)) {
      validSection = validSection.split(marker)[0];
      break; 
    }
  }

  const lines = validSection.split(/\r?\n/);
  const dateRegex = /(\d{2}\/\d{2}\/\d{4})/; // Removed the ^ to find dates anywhere
  const amountRegex = /-?\d+[\d\s,]*\.\d{2}/g;

  let pendingTx = null;

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.includes("Page of")) continue;

    const dateMatch = trimmed.match(dateRegex);

    if (dateMatch) {
      // Save the previous one before starting a new one
      if (pendingTx && pendingTx.amount !== null) transactions.push(pendingTx);

      const date = dateMatch[0];
      // Keep everything after the date
      let content = trimmed.split(date)[1].trim();
      const amounts = content.match(amountRegex);
      
      let amount = null;
      let balance = null;
      let description = content;

      if (amounts && amounts.length > 0) {
        amount = parseFloat(amounts[0].replace(/\s|,/g, ''));
        balance = parseFloat(amounts[amounts.length - 1].replace(/\s|,/g, ''));
        description = content.split(amounts[0])[0].trim();
      }

      pendingTx = { 
        date, 
        description, 
        amount, 
        balance, 
        accountNumber, // Attached here for CSV
        approved: true 
      };

    } else if (pendingTx) {
      // FIX: Append overflow text if NO NEW DATE is found
      const amountsInLine = trimmed.match(amountRegex);
      if (!amountsInLine) {
        // If it's just text, it's definitely an overflow
        const cleanText = trimmed.split(/\s{2,}/)[0];
        if (cleanText.length > 1) pendingTx.description += ` ${cleanText}`;
      } else if (pendingTx.amount === null) {
        // If we started a TX but the amount was on the second line
        pendingTx.amount = parseFloat(amountsInLine[0].replace(/\s|,/g, ''));
        pendingTx.balance = parseFloat(amountsInLine[amountsInLine.length - 1].replace(/\s|,/g, ''));
        pendingTx.description += ` ${trimmed.split(amountsInLine[0])[0].trim()}`;
      }
    }
  }

  if (pendingTx && pendingTx.amount !== null) transactions.push(pendingTx);

  return transactions.filter(t => 
    (t.date.includes("/2025") || t.date.includes("/2026")) &&
    !t.description.toLowerCase().includes('balance')
  );
};