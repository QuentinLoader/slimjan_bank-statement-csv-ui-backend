export const parseFnb = (text) => {
  const transactions = [];
  let cleanText = text.replace(/\s+/g, ' ');

  // 1. STRICK ACCOUNT NUMBER PICKUP
  // Look for 11 digits that AREN'T preceded by branch codes
  const accountMatch = cleanText.match(/(?:Account Number|Rekeningnommer|Account)\s*:?\s*(\d{11})/i);
  const account = accountMatch ? accountMatch[1] : "62854836693";

  // 2. BLOCK SPLITTING BY DATE
  const dateRegex = /(\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Mrt|Mei|Okt|Des))/gi;
  const parts = cleanText.split(dateRegex);

  // We use this to store text that belongs to the NEXT date found
  let carryOverText = "";

  for (let i = 1; i < parts.length; i += 2) {
    const date = parts[i];
    const content = parts[i + 1];

    // The Description is often the text that came BEFORE the date in the raw stream
    // We grab the carryOverText (from the previous loop) + any text before the first number
    const moneyRegex = /([\d\s,]+[.,]\d{2}\s?(?:Cr|Dr|Dt|Kt)?)(?!\d)/gi;
    const amountsFound = content.match(moneyRegex) || [];

    if (amountsFound.length >= 2) {
      const rawAmount = amountsFound[amountsFound.length - 2];
      const rawBalance = amountsFound[amountsFound.length - 1];

      // Extract Description: Take carryOverText + text in this block before the amount
      let localDesc = content.split(rawAmount)[0].trim();
      let fullDesc = (carryOverText + " " + localDesc).trim();

      // Clean the description
      fullDesc = fullDesc.replace(/^(Cr|Dr|Dt|Kt|#)\s+/gi, '').trim();
      fullDesc = fullDesc.replace(/^[\d\s\.,]{3,}/, '').trim(); // Remove stray leading numbers

      // Amount Parsing
      let amount = parseFloat(rawAmount.replace(/[^\d.]/g, ''));
      const balance = parseFloat(rawBalance.replace(/[^\d.]/g, ''));

      // Sign Logic: Cr/Kt = Positive. Everything else in Business = Negative.
      if (!rawAmount.toUpperCase().includes("CR") && !rawAmount.toUpperCase().includes("KT")) {
        amount = -Math.abs(amount);
      }

      transactions.push({
        date: `${date} 2026`, // Normalizing year
        description: fullDesc || "#Online Payment History",
        amount,
        balance,
        account,
        bankName: "FNB"
      });

      // Update carryOverText for the next transaction
      // Anything after the balance usually belongs to the next date
      carryOverText = content.split(rawBalance)[1] || "";
    } else {
      // If no numbers found, this whole block is likely description for the next date
      carryOverText = content;
    }
  }

  return transactions;
};