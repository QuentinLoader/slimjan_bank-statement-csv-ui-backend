export const parseCapitec = (text) => {
  const transactions = [];
  // Split by any line break or carriage return
  const lines = text.split(/\r?\n/);

  const dateRegex = /(\d{2}\/\d{2}\/\d{4})/;
  const amountRegex = /(-?\d+[\d\s,]*\.\d{2})/;

  let pendingTx = null;

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const dateMatch = trimmed.match(dateRegex);

    if (dateMatch) {
      // 1. SAVE the previous transaction if we were building one
      if (pendingTx && pendingTx.amount !== null) {
        transactions.push(pendingTx);
      }

      // 2. START a new transaction
      const date = dateMatch[0];
      let content = trimmed.replace(date, '').trim();
      
      const amountMatch = content.match(amountRegex);
      let amount = null;
      let description = content;

      if (amountMatch) {
        amount = parseFloat(amountMatch[0].replace(/\s|,/g, ''));
        description = content.split(amountMatch[0])[0].trim();
      }

      pendingTx = { date, description, amount, approved: true };

    } else if (pendingTx) {
      // 3. CONTINUATION: This line doesn't have a date, it's an overflow
      const amountMatch = trimmed.match(amountRegex);

      if (amountMatch && pendingTx.amount === null) {
        // If we didn't have an amount yet, grab it from this line
        pendingTx.amount = parseFloat(amountMatch[0].replace(/\s|,/g, ''));
        const extraDesc = trimmed.split(amountMatch[0])[0].trim();
        if (extraDesc) pendingTx.description += ` ${extraDesc}`;
      } else if (!amountMatch) {
        // Just extra text for the description
        // Avoid adding 'Balance' column junk
        const cleanText = trimmed.split(/\s{2,}/)[0];
        if (cleanText.length > 1) pendingTx.description += ` ${cleanText}`;
      }
    }
  }

  // Push the very last one
  if (pendingTx && pendingTx.amount !== null) transactions.push(pendingTx);

  // Final Cleanup: Filter out summary rows
  return transactions.filter(t => 
    !t.description.toLowerCase().includes('balance') &&
    !t.description.toLowerCase().includes('brought forward')
  );
};