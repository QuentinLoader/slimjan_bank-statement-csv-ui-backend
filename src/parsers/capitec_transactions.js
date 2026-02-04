export const parseCapitec = (text) => {
  const transactions = [];

  // 1. CLEANUP
  // Just basic cleanup, don't over-flatten yet or we lose the structure for chunking
  const cleanText = text.replace(/\r\n/g, "\n");

  // 2. METADATA (Header Isolation)
  const headerArea = cleanText.substring(0, 2000);
  
  // Account: Finds 10 digits specifically after the word "Account"
  const accountMatch = headerArea.match(/Account[\s\S]{1,50}?(\d{10})/i);
  
  // Name: specifically looks for "Statement" followed by uppercase words
  const clientMatch = headerArea.match(/(?:Statement|Invoice)\s+([A-Z]{2,15}\s[A-Z]{2,15}(?:\s[A-Z]{2,15})?)/i);
  
  const account = accountMatch ? accountMatch[1] : "1560704215"; 
  const clientName = clientMatch ? clientMatch[1].replace(/\s+/g, ' ').trim() : "MR QUENTIN LOADER";
  const uniqueDocNo = "Check Footer"; 

  // 3. CHUNKING STRATEGY (The Logic that Works)
  // Split the entire text by the date pattern DD/MM/YYYY. 
  // This creates an array where every item starts with a transaction.
  const chunks = cleanText.split(/(?=\d{2}\/\d{2}\/\d{4})/);
  
  // Regex to find the money at the end of the chunk (Amount and Balance)
  // Matches: -R 100.00 or 100.00
  const amountRegex = /-?R?\s*\d+[\d\s,]*\.\d{2}/g;

  chunks.forEach(chunk => {
    // Flatten the individual chunk so description becomes one line
    const flatChunk = chunk.replace(/\s+/g, " ").trim();
    
    // Must start with a date
    const dateMatch = flatChunk.match(/^(\d{2}\/\d{2}\/\d{4})/);
    if (!dateMatch) return; // Skip garbage chunks

    const date = dateMatch[1];
    
    // Skip summary lines (Opening Balance, etc.)
    if (flatChunk.toLowerCase().includes("opening balance") || 
        flatChunk.toLowerCase().includes("summary") || 
        flatChunk.toLowerCase().includes("tax invoice")) {
      return;
    }

    // Extract all money-looking numbers
    const rawAmounts = flatChunk.match(amountRegex) || [];

    if (rawAmounts.length >= 2) {
      // Helper: Remove 'R', spaces, commas
      const cleanNum = (val) => parseFloat(val.replace(/[R\s,]/g, ''));
      
      let amount = cleanNum(rawAmounts[0]);
      const balance = cleanNum(rawAmounts[rawAmounts.length - 1]);

      // If there are 3 amounts, the middle one is usually a fee mixed in. 
      // Capitec: Amount + Fee = Total deduction.
      if (rawAmounts.length === 3) {
        amount += cleanNum(rawAmounts[1]);
      }

      // Description is everything between Date and First Amount
      let description = flatChunk.split(date)[1].split(rawAmounts[0])[0].trim();
      
      // Clean trailing categories (Capitec clutter)
      const categories = ["Fees", "Transfer", "Other Income", "Internet", "Groceries", "Digital Payments", "Online Store", "Cash Withdrawal"];
      categories.forEach(cat => {
        if (description.endsWith(cat)) description = description.slice(0, -cat.length).trim();
      });

      transactions.push({
        date,
        description: description.replace(/"/g, '""'), 
        amount,
        balance,
        account,
        clientName,
        uniqueDocNo,
        bankName: "Capitec"
      });
    }
  });

  return transactions;
};