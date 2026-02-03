export const parseCapitec = (text) => {
  const transactions = [];
  const lines = text.split('\n');

  // Matches DD/MM/YYYY
  const dateRegex = /^(\d{2}\/\d{2}\/\d{4})/;
  // Matches currency amounts (e.g., -150.00, 2,500.00, 45.10)
  const amountRegex = /-?\d+[\d\s,]*\.\d{2}/;

  lines.forEach(line => {
    const trimmed = line.trim();
    const dateMatch = trimmed.match(dateRegex);

    if (dateMatch) {
      const date = dateMatch[0];
      // Get the text following the date
      let content = trimmed.slice(date.length).trim();

      // Find all numbers that look like valid currency amounts
      const amountMatches = content.match(amountRegex);

      if (amountMatches && amountMatches.length > 0) {
        // In Capitec extraction, the transaction amount is typically 
        // the first valid currency string found after the date.
        const rawAmount = amountMatches[0];
        const cleanAmount = parseFloat(rawAmount.replace(/\s|,/g, ''));

        // Description is everything between the date and the amount
        let description = content.split(rawAmount)[0].trim();
        
        // Remove common column headers if they got merged into the description
        const noiseKeywords = ["Transfer", "Fees", "Other Income", "Internet", "Groceries", "Digital"];
        noiseKeywords.forEach(keyword => {
          if (description.endsWith(keyword)) {
            description = description.slice(0, -keyword.length).trim();
          }
        });

        // Filter out balance-only or empty lines
        if (description && !description.toLowerCase().includes('balance')) {
          transactions.push({
            date,
            description: description || "Bank Transaction",
            amount: cleanAmount,
            approved: true
          });
        }
      }
    }
  });

  console.log(`✅ YouScan Engine found ${transactions.length} Capitec transactions.`);
  return transactions;
};