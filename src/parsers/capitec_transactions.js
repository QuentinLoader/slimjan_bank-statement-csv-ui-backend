export const parseCapitec = (text) => {
  const transactions = [];
  
  // 1. Split by lines AND handle potential weird spacing
  const lines = text.split('\n');

  // 2. Updated Regex: Matches South African Date Formats (DD/MM/YYYY or DD MMM YYYY)
  // Capitec often uses 06/01/2026 or 06 Jan 2026
  const dateRegex = /(\d{2}[\/\s][A-Za-z0-9]{2,3}[\/\s]\d{4})/;

  // 3. Amount Regex: Matches numbers like 450.00, -1,000.00, or 334.10
  const amountRegex = /-?\d+[\d\s,]*\.\d{2}/;

  lines.forEach(line => {
    const trimmed = line.trim();
    
    // Check if the line contains a date
    const dateMatch = trimmed.match(dateRegex);
    
    if (dateMatch) {
      const date = dateMatch[0];
      
      // Remove the date from the line to find the description and amount
      let remainingText = trimmed.replace(date, '').trim();
      
      // Find all numbers that look like amounts in this line
      const amountMatches = remainingText.match(new RegExp(amountRegex, 'g'));
      
      if (amountMatches && amountMatches.length > 0) {
        // In Capitec, the transaction amount is usually the first or second amount found
        // depending on if there's a 'Balance' column. 
        // We'll take the one that isn't the final 'Balance'.
        const amountStr = amountMatches[0].replace(/\s|,/g, '');
        const amount = parseFloat(amountStr);

        // The description is whatever is left between the date and the amounts
        const description = remainingText.split(amountMatches[0])[0].trim() || "Transaction";

        // Filter out "Balance" lines or "Total" lines
        if (!description.toLowerCase().includes('balance') && !description.toLowerCase().includes('opening')) {
          transactions.push({
            date,
            description,
            amount,
            approved: true
          });
        }
      }
    }
  });

  return transactions;
};