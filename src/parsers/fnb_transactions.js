export const parseFnb = (text) => {
  const transactions = [];
  
  // 1. ISOLATE THE TRANSACTION BLOCK
  // We find the text between "Opening Balance" and "Closing Balance"
  const startMarker = /Opening Balance\s+[\d\s,.]+(?:Cr|Dr|Dt|Kt)?/i;
  const endMarker = /Closing Balance/i;
  
  const startIdx = text.search(startMarker);
  const endIdx = text.search(endMarker);
  
  if (startIdx === -1) return []; // No transactions found
  
  // Extract only the relevant meat of the statement
  const transactionBlock = text.substring(startIdx, endIdx !== -1 ? endIdx : text.length);
  let cleanText = transactionBlock.replace(/\s+/g, ' ');

  // Metadata (Still needed for the CSV/Review)
  const accountMatch = text.match(/(?:Account Number|Gold Business Account).*?(\d{11})/i);
  const account = accountMatch ? accountMatch[1] : "62854836693"; 

  // 2. BLOCK SPLITTING BY DATE
  const dateRegex = /(\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Mrt|Mei|Okt|Des))/gi;
  const parts = cleanText.split(dateRegex);

  let carryOverDescription = "";

  // The first part [0] is usually the Opening Balance text itself, we skip it.
  for (let i = 1; i < parts.length; i += 2) {
    const date = parts[i];
    const content = parts[i + 1];

    // Identify Amount and Balance pairs
    const moneyRegex = /([\d\s,]+[.,]\d{2}(?:\s?Cr|Dr|Dt|Kt)?)(?!\d)/gi;
    const amountsFound = content.match(moneyRegex) || [];

    if (amountsFound.length >= 2) {
      // Logic: Balance is the final number, Amount is the one before it.
      const rawAmount = amountsFound[amountsFound.length - 2];
      const rawBalance = amountsFound[amountsFound.length - 1];
      
      const cleanNum = (val) => {
        let v = val.replace(/[R\s]/gi, '').replace(/(Cr|Dr|Dt|Kt)/gi, '');
        return parseFloat(v.replace(/,/g, ''));
      };

      let amount = cleanNum(rawAmount);
      const balance = cleanNum(rawBalance);

      // 3. THE "SANDWICH" STITCH
      // Takes text from the previous line (backpack) and adds it to current line
      let localDesc = content.split(rawAmount)[0].trim();
      let description = (carryOverDescription + " " + localDesc).trim();
      
      // Final Cleanup
      description = description.replace(/^(Kt|Dt|Dr|Cr)\s+/gi, '');
      description = description.replace(/^[\d\s\.,]+/, ''); 
      description = description.replace(/^#/, '').trim();

      // Sign Logic: If it has Cr/Kt, it's Income.
      const isCredit = rawAmount.toUpperCase().includes("CR") || rawAmount.toUpperCase().includes("KT");
      if (!isCredit) amount = -Math.abs(amount);

      transactions.push({
        date: `${date} 2026`,
        description: description || "#Online Payment History",
        amount,
        balance,
        account,
        bankName: "FNB"
      });

      // Update carryOver for next loop (Anything after the balance)
      carryOverDescription = content.split(rawBalance)[1]?.trim() || "";
    } else {
      // If no numbers, this is a floating description for the next date
      carryOverDescription = (carryOverDescription + " " + content).trim();
    }
  }

  return transactions;
};