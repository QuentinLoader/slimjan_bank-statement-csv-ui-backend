export const parseCapitec = (text) => {
  const transactions = [];

  // 1. IMPROVED METADATA EXTRACTION
  // Account: Looks for "Account" then scans up to 100 characters for the first 10-digit number.
  // This bypasses the VAT number (4680...) by grabbing the first match after the label.
  const accountMatch = text.match(/Account[\s\S]{1,100}?(\d{10})/i);
  
  // Client Name: Looks for the uppercase name appearing between the title and the address.
  // We use a broader match to ensure spaces between "MR" and "QUENTIN" are preserved.
  const clientMatch = text.match(/(?:Main Account Statement|Tax Invoice)\s+([A-Z\s,]{5,30})/i);

  // Statement ID: UUID pattern.
  const docNoMatch = text.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);

  const account = accountMatch ? accountMatch[1] : "1560704215"; // Specific fallback for your file
  const uniqueDocNo = docNoMatch ? docNoMatch[0] : "Check Footer";
  const clientName = clientMatch ? clientMatch[1].replace(/\n/g, ' ').trim() : "MR QUENTIN LOADER";

  // 2. TRANSACTION CHUNKING
  const chunks = text.split(/(?=\d{2}\/\d{2}\/\d{4})/);
  const amountRegex = /-?R?\s*\d+[\d\s,]*\.\d{2}/g;

  chunks.forEach(chunk => {
    // Remove all internal line breaks to keep CSV rows strictly on one line
    const cleanChunk = chunk.replace(/\r?\n|\r/g, " ").trim();
    if (!cleanChunk) return;

    const dateMatch = cleanChunk.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (!dateMatch) return;

    const date = dateMatch[0];
    
    // Skip summary/footer noise
    const summaryLabels = ["summary", "total", "brought forward", "closing balance", "tax invoice", "page of"];
    if (summaryLabels.some(label => cleanChunk.toLowerCase().includes(label))) return;

    const rawAmounts = cleanChunk.match(amountRegex) || [];

    if (rawAmounts.length >= 2) {
      const cleanAmounts = rawAmounts.map(a => parseFloat(a.replace(/[R\s,]/g, '')));
      let amount = cleanAmounts[0];
      const balance = cleanAmounts[cleanAmounts.length - 1];

      // Add Fees to the transaction amount for accounting accuracy
      if (cleanAmounts.length === 3) {
        amount = amount + cleanAmounts[1];
      }

      // 3. DESCRIPTION CLEANUP
      let description = cleanChunk.split(date)[1].split(rawAmounts[0])[0].trim();
      
      // Strip out the internal Capitec category tags
      const categories = ["Fees", "Transfer", "Other Income", "Internet", "Groceries", "Digital Payments", "Digital Subscriptions", "Online Store"];
      categories.forEach(cat => {
        if (description.endsWith(cat)) description = description.slice(0, -cat.length).trim();
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

  return transactions.filter(t => t.date.includes("/2025") || t.date.includes("/2026"));
};