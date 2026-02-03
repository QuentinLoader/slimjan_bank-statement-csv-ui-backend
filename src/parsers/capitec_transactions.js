export const parseCapitec = (text) => {
  const transactions = [];
  
  // 1. SPLIT BY DATE: This creates a "chunk" for every transaction
  // The Regex looks for DD/MM/YYYY and keeps the date in the result
  const chunks = text.split(/(?=\d{2}\/\d{2}\/\d{4})/);

  // 2. REGEX FOR AMOUNTS: Matches numbers like -150.00, 2,500.00, 45.10
  const amountRegex = /-?\d+[\d\s,]*\.\d{2}/;

  chunks.forEach(chunk => {
    const trimmedChunk = chunk.trim();
    if (!trimmedChunk) return;

    // Check if this chunk starts with a valid date
    const dateMatch = trimmedChunk.match(/^(\d{2}\/\d{2}\/\d{4})/);
    
    if (dateMatch) {
      const date = dateMatch[0];
      // Get everything in the chunk AFTER the date
      let content = trimmedChunk.slice(date.length).trim();

      // Find all numbers that look like valid currency amounts in the WHOLE chunk
      const amountMatches = content.match(amountRegex);

      if (amountMatches && amountMatches.length > 0) {
        // Typically, the first amount after the date is the transaction value
        const rawAmount = amountMatches[0];
        const cleanAmount = parseFloat(rawAmount.replace(/\s|,/g, ''));

        // DESCRIPTION RECOVERY:
        // Take everything before the first amount. 
        // We replace newlines with spaces to fix the "overflow" issue.
        let description = content.split(rawAmount)[0]
          .replace(/\n/g, ' ')  // Convert overflows into a single line
          .replace(/\s{2,}/g, ' ') // Clean up extra spaces
          .trim();
        
        // Remove noise/column headers if they got stuck
        const noise = ["Transfer", "Fees", "Other Income", "Internet", "Groceries"];
        noise.forEach(n => {
          if (description.endsWith(n)) description = description.slice(0, -n.length).trim();
        });

        if (description && !description.toLowerCase().includes('balance')) {
          transactions.push({
            date,
            description,
            amount: cleanAmount,
            approved: true
          });
        }
      }
    }
  });

  return transactions;
};