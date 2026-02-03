export const parseCapitec = (text) => {
  const transactions = [];
  
  // 1. Remove ONLY the global header (Page 1) but don't set a hard end boundary
  const startMarker = "Transaction History";
  let workingText = text;
  if (text.includes(startMarker)) {
    workingText = text.split(startMarker)[1];
  }

  const lines = workingText.split(/\r?\n/);
  const dateRegex = /^(\d{2}\/\d{2}\/\d{4})/; 
  const amountRegex = /(-?\d+[\d\s,]*\.\d{2})/;

  // Phrases that appear in headers/footers that we want to skip
  const blacklist = [
    "Unique Document No",
    "Capitec Bank is an authorised",
    "ClientCare@capitecbank",
    "Date Description Category",
    "Page of",
    "24hr Client Care Centre"
  ];

  let pendingTx = null;

  for (let line of lines) {
    const trimmed = line.trim();
    
    // SKIP empty lines or any line containing blacklisted "Junk" text
    if (!trimmed || blacklist.some(phrase => trimmed.includes(phrase))) continue;

    const dateMatch = trimmed.match(dateRegex);

    if (dateMatch) {
      if (pendingTx && pendingTx.amount !== null) transactions.push(pendingTx);

      const date = dateMatch[0];
      let content = trimmed.replace(date, '').trim();
      
      const amountMatch = content.match(amountRegex);
      let amount = null;
      let description = content;

      if (amountMatch) {
        amount = parseFloat(amountMatch[0].replace(/\s|,/g, ''));
        description = content.split(amountMatch[0])[0].trim();
      }

      pendingTx = { date, description, amount, approved: true };

    } else if (pendingTx) {
      // Logic to append overflow descriptions from the next line
      const amountMatch = trimmed.match(amountRegex);
      if (amountMatch && pendingTx.amount === null) {
        pendingTx.amount = parseFloat(amountMatch[0].replace(/\s|,/g, ''));
        pendingTx.description += ` ${trimmed.split(amountMatch[0])[0].trim()}`;
      } else if (!amountMatch) {
        // Just extra description text, clean of merged columns
        const cleanPart = trimmed.split(/\s{2,}/)[0];
        if (cleanPart.length > 1) pendingTx.description += ` ${cleanPart}`;
      }
    }
  }

  if (pendingTx && pendingTx.amount !== null) transactions.push(pendingTx);

  // Final Filter: Only keep rows with valid transaction years
  return transactions.filter(t => 
    (t.date.includes("/2025") || t.date.includes("/2026")) &&
    !t.description.toLowerCase().includes('balance')
  );
};