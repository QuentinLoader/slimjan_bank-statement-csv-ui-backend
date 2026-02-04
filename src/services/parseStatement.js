import pdf from 'pdf-parse';
import { parseCapitec } from '../parsers/capitec_transactions.js'; 
import { parseFnb } from '../parsers/fnb_transactions.js'; 

export const parseStatement = async (fileBuffer) => {
  try {
    const data = await pdf(fileBuffer);
    const text = data.text;
    const lowerText = text.toLowerCase();

    // 🔍 DEBUG: Log the header so you can see exactly what the server sees
    console.log("📄 PDF Header Snippet:", text.substring(0, 300).replace(/\n/g, ' '));

    // 1. CAPITEC CHECK (Priority)
    // If it has these keywords, it is definitely Capitec.
    if (lowerText.includes("capitec") || lowerText.includes("unique document no")) {
      console.log("🏦 Detected Bank: Capitec");
      const transactions = parseCapitec(text);
      console.log(`📊 Extracted ${transactions.length} items from Capitec`);
      return {
        transactions,
        bankName: "Capitec",
        bankLogo: "capitec"
      };
    } 
    
    // 2. FNB CHECK
    if (lowerText.includes("fnb") || lowerText.includes("first national bank") || lowerText.includes("bbst")) {
      console.log("🏦 Detected Bank: FNB");
      const transactions = parseFnb(text);
      console.log(`📊 Extracted ${transactions.length} items from FNB`);
      return {
        transactions,
        bankName: "FNB",
        bankLogo: "fnb"
      };
    } 

    // 3. FALLBACK
    console.warn("⚠️ Bank signature not found. Defaulting to Capitec.");
    return {
      transactions: parseCapitec(text),
      bankName: "Capitec",
      bankLogo: "capitec"
    };

  } catch (error) {
    console.error("❌ Critical Parsing Error:", error.message);
    return { transactions: [], bankName: "Error", bankLogo: "error" };
  }
};