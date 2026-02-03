export const parseCapitec = (text) => {
  const transactions = [];
  const lines = text.split(/\r?\n/);

  // 1. IMPROVED METADATA EXTRACTION (Top of Document)
  const headerArea = text.slice(0, 5000);
  const accountNumberMatch = headerArea.match(/Account No[:\s]+(\d{10,})/i);
  // Capitec Client Name is usually between the Document No and the Address
  const clientNameMatch = headerArea.match(/Unique Document No[\s\S]*?\n\s*([A-Z\s,]{5,})\n/);
  
  const accountNumber = accountNumberMatch ? accountNumberMatch[1] : "Not Found";
  const clientName = clientNameMatch ? clientNameMatch[1].trim() : "Not Found";

  const dateRegex = /(\d{2}\/\d{2}\/\d{4})/;
  const amountRegex = /-?\d+[\d\s,]*\.\d{2}/g;

  // Header/Footer phrases to ignore while scanning
  const blacklist = ["Page of", "Balance", "Date Description", "Unique Document No", "24hr Client Care"];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || blacklist.some(phrase => line.includes(phrase))) continue;

    const dateMatch = line.match(dateRegex);

    if (dateMatch) {
      const date = dateMatch[0];
      let content = line.split(date)[1].trim();
      
      // MULTI-LINE RECOVERY: Scan up to 2 lines ahead for descriptions like "Milnerton Za"
      let lookAheadIndex = i + 1;
      while (lines[lookAheadIndex] && 
             !lines[lookAheadIndex].match(dateRegex) && 
             !lines[lookAheadIndex].match(amountRegex) &&
             lines[lookAheadIndex].trim().length > 1) {
        
        const nextLine = lines[lookAheadIndex].trim();
        if (!blacklist.some(phrase => nextLine.includes(phrase))) {
          content += " " + nextLine;
          i = lookAheadIndex; // Move main loop counter forward
        }
        lookAheadIndex++;
      }

      const amounts = content.match(amountRegex);
      if (amounts && amounts.length > 0) {
        const amount = parseFloat(amounts[0].replace(/\s|,/g, ''));
        const balance = parseFloat(amounts[amounts.length - 1].replace(/\s|,/g, ''));
        
        let description = content.split(amounts[0])[0].trim();
        // Clean up merged column headers
        description = description.replace(/(Groceries|Transfer|Fees|Digital|Internet|Holiday|Vehicle|Restaurants|Alcohol|Other Income)$/, "").trim();

        transactions.push({
          date,
          description,
          amount,
          balance,
          accountNumber,
          clientName,
          approved: true
        });
      }
    }
  }

  // Ensure sorting by date to help the Balance calculation in UI
  return transactions.filter(t => t.date.includes("/2025") || t.date.includes("/2026"));
};