export const parseCapitec = (text) => {
  const transactions = [];

  // 1. ANCHORED METADATA EXTRACTION
  // Account: Finds "Account" and takes the very next 10 digits (ignoring the VAT number further right)
  const accountMatch = text.match(/Account\s+(\d{10})/i);
  
  // Client Name: Capitec usually puts the Name right above the "Statement Information" block.
  // We look for a line of uppercase text that isn't a header.
  const clientMatch = text.match(/([A-Z\s,]{10,})\n\s*Statement Information/i);

  // Statement ID: The UUID pattern
  const docNoMatch = text.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);

  const account = accountMatch ? accountMatch[1] : "Check Header";
  const uniqueDocNo = docNoMatch ? docNoMatch[0] : "Check Footer";
  const clientName = clientMatch ? clientMatch[1].trim() : "Name Not Found";

  // 2. TRANSACTION CHUNKING
  const chunks = text.split(/(?=\d{2}\/\d{2}\/\d{4})/);
  const amountRegex = /-?R?\s*\d+[\d\s,]*\.\d{2}/g;

  chunks.forEach(chunk => {
    const lines = chunk.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length === 0) return;

    const dateMatch = lines[0].match(/(\d{2}\/\d{2}\/\d{4})/);
    if (!dateMatch) return;

    const date = dateMatch[0];
    let fullContent = lines.join(' ');
    
    // THE GHOST FILTER: Ignore summary lines
    const summaryLabels = ["summary", "total", "brought forward", "closing balance", "page of"];
    if (summaryLabels.some(label => fullContent.toLowerCase().includes(label))) return;

    const rawAmounts = fullContent.match(amountRegex) || [];

    // Valid transactions need an Amount and a Balance column
    if (rawAmounts.length >= 2) {
      const cleanAmounts = rawAmounts.map(a => parseFloat(a.replace(/[R\s,]/g, '')));
      
      let amount = cleanAmounts[0];
      const balance = cleanAmounts[cleanAmounts.length - 1];

      // Add Fees into the amount if 3 values exist
      if (cleanAmounts.length === 3) {
        amount = amount + cleanAmounts[1];
      }

      // 3. CLEAN DESCRIPTION (Stripping Category Labels)
      let description = fullContent.split(date)[1].split(rawAmounts[0])[0].trim();
      
      const categories = ["Fees", "Transfer", "Other Income", "Internet", "Groceries", "Digital Payments", "Digital Subscriptions", "Online Store"];
      categories.forEach(cat => {
        if (description.endsWith(cat)) {
          description = description.slice(0, -cat.length).trim();
        }
      });

      if (description.length > 1) {
        transactions.push({
          date,
          description,
          amount,
          balance,
          account,
          clientName,
          uniqueDocNo,
          approved: true
        });
      }
    }
  });

  return transactions.filter(t => t.date.includes("/2025") || t.date.includes("/2026"));
};