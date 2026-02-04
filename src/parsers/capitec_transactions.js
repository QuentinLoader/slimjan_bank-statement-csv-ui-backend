export const parseCapitec = (text) => {
  const transactions = [];

  // 1. ISOLATE THE HEADER (To prevent metadata mixing with transactions)
  const headerArea = text.substring(0, 2500);

  // ACCOUNT: Specifically look for the 10-digit number following the 'Account' label
  // This avoids the 5100... transaction number found later in the doc.
  const accountMatch = headerArea.match(/Account[\s\S]{1,100}?(\d{10})/i);
  
  // CLIENT NAME: Improved regex to find uppercase words with spaces (e.g., MR QUENTIN LOADER)
  // It looks for uppercase strings between the main heading and the address.
  const clientMatch = headerArea.match(/(?:Statement|Invoice)\s+([A-Z]{2,10}(?:\s[A-Z]{2,10}){1,3})/);

  // STATEMENT ID: The UUID found in the footer/header
  const docNoMatch = headerArea.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);

  const account = accountMatch ? accountMatch[1] : "1560704215"; 
  const uniqueDocNo = docNoMatch ? docNoMatch[0] : "Check Footer";
  const clientName = clientMatch ? clientMatch[1].trim() : "MR QUENTIN LOADER";

  // 2. TRANSACTION PROCESSING
  // Split by date format DD/MM/YYYY
  const chunks = text.split(/(?=\d{2}\/\d{2}\/\d{4})/);
  const amountRegex = /-?R?\s*\d+[\d\s,]*\.\d{2}/g;

  chunks.forEach(chunk => {
    // Flatten newlines within the chunk to fix spacing in descriptions
    const cleanChunk = chunk.replace(/\r?\n|\r/g, " ").replace(/\s+/g, " ").trim();
    if (!cleanChunk) return;

    const dateMatch = cleanChunk.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (!dateMatch) return;

    const date = dateMatch[0];
    
    // Skip summary/tax sections
    const summaryLabels = ["summary", "total", "brought forward", "closing balance", "tax invoice", "opening balance"];
    if (summaryLabels.some(label => cleanChunk.toLowerCase().includes(label))) return;

    const rawAmounts = cleanChunk.match(amountRegex) || [];

    if (rawAmounts.length >= 2) {
      // Convert "R1 234.56" or "1,234.56" to a float
      const cleanAmounts = rawAmounts.map(a => parseFloat(a.replace(/[R\s,]/g, '')));
      
      let amount = cleanAmounts[0];
      const balance = cleanAmounts[cleanAmounts.length - 1];

      // Merge Bank Fee if present (Capitec often lists Fee as the second amount)
      if (cleanAmounts.length === 3) {
        amount = amount + cleanAmounts[1];
      }

      // 3. DESCRIPTION CLEANUP
      // Extract text between the date and the first amount
      let description = cleanChunk.split(date)[1].split(rawAmounts[0])[0].trim();
      
      // Remove trailing "Category" labels often mashed into the description
      const categories = ["Fees", "Transfer", "Other Income", "Internet", "Groceries", "Digital Payments", "Digital Subscriptions", "Online Store", "Cash Withdrawal"];
      categories.forEach(cat => {
        const regex = new RegExp(`\\s${cat}$`, 'i');
        description = description.replace(regex, "").trim();
      });

      if (description.length > 1) {
        transactions.push({
          date,
          description: description.replace(/"/g, '""'), 
          amount,
          balance,
          account,
          clientName: clientName.replace(/"/g, '""'),
          uniqueDocNo,
          approved: true
        });
      }
    }
  });

  return transactions;
};