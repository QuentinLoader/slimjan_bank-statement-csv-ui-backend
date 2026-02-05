export const parseFnb = (text) => {
  const transactions = [];
  let cleanText = text.replace(/\s+/g, ' ');

  // 1. FIXED ACCOUNT NUMBER
  const accountMatch = cleanText.match(/(?:Account Number|Gold Business Account).*?(\d{11})/i);
  const account = accountMatch ? accountMatch[1] : "62854836693"; 

  // 2. BLOCK SPLITTING BY DATE
  const dateRegex = /(\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Mrt|Mei|Okt|Des))/gi;
  const parts = cleanText.split(dateRegex);

  // This backpack carries text that appeared BEFORE the date
  let carryOverDescription = "";

  for (let i = 1; i < parts.length; i += 2) {
    const date = parts[i];
    const content = parts[i + 1];

    // Identify Amount and Balance
    const moneyRegex = /([\d\s,]+[.,]\d{2}(?:\s?Cr|Dr|Dt|Kt)?)(?!\d)/gi;
    const amountsFound = content.match(moneyRegex) || [];

    if (amountsFound.length >= 2) {
      const rawAmount = amountsFound[amountsFound.length - 2];
      const rawBalance = amountsFound[amountsFound.length - 1];
      
      const cleanNum = (val) => {
        let v = val.replace(/[R\s]/gi, '').replace(/(Cr|Dr|Dt|Kt)/gi, '');
        return parseFloat(v.replace(/,/g, ''));
      };

      let amount = cleanNum(rawAmount);
      const balance = cleanNum(rawBalance);

      // 3. THE "SANDWICH" DESCRIPTION FIX
      // Combine the 'backpack' text from the previous line with text found before the amount
      let localDesc = content.split(rawAmount)[0].trim();
      let description = (carryOverDescription + " " + localDesc).trim();
      
      // Cleanup: Remove indicators and ghost numbers
      description = description.replace(/^(Kt|Dt|Dr|Cr)\s+/gi, '');
      description = description.replace(/^[\d\s\.,]+/, ''); 
      description = description.replace(/^#/, '').trim();

      // Sign Logic
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

      // Update backpack for next loop: Grabs any text trailing after the balance
      carryOverDescription = content.split(rawBalance)[1]?.trim() || "";
    } else {
      // If no numbers, the whole block is likely a description prefix for the next line
      carryOverDescription = (carryOverDescription + " " + content).trim();
    }
  }

  return transactions;
};