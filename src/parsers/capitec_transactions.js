export const parseCapitec = (text) => {
  const transactions = [];
  // Split the text into individual lines for cleaner processing
  const lines = text.split('\n');

  // Regex to match South African dates (DD/MM/YYYY or DD/MM/202X)
  const dateRegex = /^(\d{2}\/\d{2}\/20\d{2})/;

  lines.forEach(line => {
    const trimmedLine = line.trim();
    
    // Check if the line starts with a date
    if (dateRegex.test(trimmedLine)) {
      // Split the line by multiple spaces to separate columns
      const parts = trimmedLine.split(/\s{2,}/); 
      
      if (parts.length >= 3) {
        const date = parts[0];
        const description = parts[1];
        
        // Capitec often puts Money Out in one column and Money In in another
        // We need to find the value that looks like a currency amount
        const amountStr = parts.find(p => /^-?\d+\.\d{2}$/.test(p.replace(',', '')));
        
        if (amountStr) {
          // Convert "1,250.00" or "-450.00" to a clean number
          const amount = parseFloat(amountStr.replace(',', ''));
          
          transactions.push({
            date,
            description,
            amount,
            approved: true // Default to selected for YouScan
          });
        }
      }
    }
  });

  console.log(`🔍 Capitec Parser found ${transactions.length} rows.`);
  return transactions;
};