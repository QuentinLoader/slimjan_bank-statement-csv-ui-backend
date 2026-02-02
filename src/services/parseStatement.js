import pdf from 'pdf-parse';
import { parseCapitec } from '../parsers/capitec_transactions.js'; 
import { parseFnb } from '../parsers/fnb_transactions.js'; // Added FNB Import

export const parseStatement = async (fileBuffer) => {
  try {
    const data = await pdf(fileBuffer);
    const text = data.text;

    // Log the start of the text to identify the bank in Railway logs
    console.log("PDF Header Snippet:", text.substring(0, 300));

    let transactions = [];

    // --- Bank Detection Logic ---
    if (text.includes("CAPITEC") || text.includes("Capitec")) {
      console.log("Detected Bank: Capitec");
      transactions = parseCapitec(text);
    } 
    else if (text.includes("FNB") || text.includes("First National Bank") || text.includes("Beskrywing")) {
      console.log("Detected Bank: FNB");
      // FNB parser usually works better with lines
      const lines = text.split('\n');
      transactions = parseFnb(lines);
    } 
    else {
      console.warn("Bank not recognized automatically. Falling back to Capitec parser.");
      transactions = parseCapitec(text);
    }

    // --- Validation ---
    if (!transactions || transactions.length === 0) {
      console.error("Parser returned no results. Layout might have changed.");
      throw new Error("No transactions found in the statement. Please ensure it is a valid PDF.");
    }

    // Return just the array to match your route's expectations
    return transactions;

  } catch (error) {
    console.error("Service Error:", error.message);
    throw error;
  }
};