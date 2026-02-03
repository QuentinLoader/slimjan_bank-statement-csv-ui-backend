export const parseCapitec = (text) => {
  const transactions = [];
  const lines = text.split(/\r?\n/);

  // Regex for Date (DD/MM/YYYY)
  const dateRegex = /^(\d{2}\/\d{2}\/\d{4})/; 
  // Regex for Amount (captures all currency-like numbers in a line)
  const amountRegex = /-?\d+[\d\s,]*\.\d{2}/g;

  // Header/Footer phrases to skip
  const blacklist = [
    "Unique Document No",
    "Capitec Bank is an authorised",
    "ClientCare@capitecbank",
    "Date Description Category",
    "Page of",
    "24hr Client Care Centre",
    "Transaction History"
  ];

  let pendingTx = null;

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed || blacklist.some(phrase => trimmed.includes(phrase))) continue;

    const dateMatch = trimmed.match(dateRegex);

    if (dateMatch) {
      // Save completed transaction before starting next one
      if (pendingTx && pendingTx.amount !== null) transactions.push(pendingTx);

      const date = dateMatch[0];
      let content = trimmed.slice(date.length).trim();
      
      const amounts = content.match(amountRegex);
      let amount = null;
      let balance = null;
      let description = content;

      if (amounts && amounts.length > 0) {
        // First amount is the transaction
        amount = parseFloat(amounts[0].replace(/\s|,/g, ''));
        
        // Last amount in the line is the Balance
        if (amounts.length >= 2) {
          balance = parseFloat(amounts[amounts.length - 1].replace(/\s|,/g, ''));
        }
        
        description = content.split(amounts[0])[0].trim();
      }

      pendingTx = { date, description, amount, balance, approved: true };

    } else if (pendingTx) {
      // Handle overflow descriptions on subsequent lines
      const amounts = trimmed.match(amountRegex);
      
      if (amounts && pendingTx.amount === null) {
        pendingTx.amount = parseFloat(amounts[0].replace(/\s|,/g, ''));
        if (amounts.length >= 2) {
          pendingTx.balance = parseFloat(amounts[amounts.length - 1].replace(/\s|,/g, ''));
        }
        pendingTx.description += ` ${trimmed.split(amounts[0])[0].trim()}`;
      } else if (!amounts) {
        // Just extra text for description
        const cleanPart = trimmed.split(/\s{2,}/)[0];
        if (cleanPart.length > 1) pendingTx.description += ` ${cleanPart}`;
      }
    }
  }

  if (pendingTx && pendingTx.amount !== null) transactions.push(pendingTx);

  // Final filter for valid years only
  return transactions.filter(t => 
    (t.date.includes("/2025") || t.date.includes("/2026")) &&
    !t.description.toLowerCase().includes('balance')
  );
};