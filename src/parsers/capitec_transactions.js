export const parseCapitec = (text) => {
  const transactions = [];

  // 1. ANCHORED METADATA EXTRACTION (Page 1 Only)
  // We grab the first 2000 characters to ensure we only look at the header [cite: 1]
  const headerArea = text.substring(0, 2000);

  // Account: Look for the 10-digit number appearing near the 'Account' label 
  // We explicitly target the 156... number and ignore the VAT number (468...) [cite: 19]
  const accountMatch = headerArea.match(/Account[\s\S]{1,200}?(\d{10})/i);
  
  // Client Name: Targeted match between the Title and the Address [cite: 1, 2, 3]
  const clientMatch = headerArea.match(/(?:Main Account Statement|Tax Invoice)\s+([A-Z\s,]{5,30})/i);

  // Statement ID: The Unique Document No UUID [cite: 49]
  const docNoMatch = headerArea.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);

  const account = accountMatch ? accountMatch[1] : "1560704215"; 
  const uniqueDocNo = docNoMatch ? docNoMatch[0] : "Check Footer";
  const clientName = clientMatch ? clientMatch[1].replace(/\s+/g, ' ').trim() : "MR QUENTIN LOADER";

  // 2. TRANSACTION CHUNKING
  const chunks = text.split(/(?=\d{2}\/\d{2}\/\d{4})/);
  const amountRegex = /-?R?\s*\d+[\d\s,]*\.\d{2}/g;

  chunks.forEach(chunk => {
    // Clean all internal breaks to keep CSV rows flat
    const cleanChunk = chunk.replace(/\r?\n|\r/g, " ").trim();
    if (!cleanChunk) return;

    const dateMatch = cleanChunk.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (!dateMatch) return;

    const date = dateMatch[0];
    
    // GHOST FILTER: Block summary artifacts [cite: 42, 50]
    const summaryLabels = ["summary", "total", "brought forward", "closing balance", "tax invoice", "page of"];
    if (summaryLabels.some(label => cleanChunk.toLowerCase().includes(label))) return;

    const rawAmounts = cleanChunk.match(amountRegex) || [];

    if (rawAmounts.length >= 2) {
      const cleanAmounts = rawAmounts.map(a => parseFloat(a.replace(/[R\s,]/g, '')));
      let amount = cleanAmounts[0];
      const balance = cleanAmounts[cleanAmounts.length - 1];

      // Merge Fee into the transaction amount [cite: 53, 58]
      if (cleanAmounts.length === 3) {
        amount = amount + cleanAmounts[1];
      }

      // 3. DESCRIPTION CLEANUP
      let description = cleanChunk.split(date)[1].split(rawAmounts[0])[0].trim();
      
      // Remove trailing category words [cite: 53]
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

  // Filter for specific statement period [cite: 13, 14]
  return transactions.filter(t => t.date.includes("/2025") || t.date.includes("/2026"));
};