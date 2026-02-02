import { ParseError } from "../errors/ParseError.js";

/**
 * Capitec rows look like:
 * Date | Description | Category | Money In | Money Out | Fee | Balance
 */
export function parseCapitec(textOrLines) {
  // Ensure we are working with an array of lines
  const lines = Array.isArray(textOrLines) ? textOrLines : textOrLines.split('\n');
  const rows = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines or header repeats
    if (!trimmedLine || /^Date\s+Description/i.test(trimmedLine)) continue;

    // Normalize spacing (turns multiple spaces into one)
    const clean = trimmedLine.replace(/\s+/g, " ");

    /**
     * Regex breakdown:
     * 1. (\d{2}\/\d{2}\/\d{4}) -> Date (DD/MM/YYYY)
     * 2. (.*?) -> Description (lazy match)
     * 3. The following groups handle the columns for Money In/Out/Fee/Balance
     */
    const match = clean.match(
      /^(\d{2}\/\d{2}\/\d{4})\s+(.*?)\s+(-?\d[\d\s,.]*)?\s*(-?\d[\d\s,.]*)?\s*(-?\d[\d\s,.]*)?\s+(-?\d[\d\s,.]*)$/
    );

    if (!match) {
      // Instead of crashing the whole app, we log the skipped line
      console.warn(`Skipping line (no match): ${trimmedLine}`);
      continue; 
    }

    const [
      ,
      date,
      description,
      val1,
      val2,
      val3,
      balanceRaw
    ] = match;

    // Capitec columns vary; we parse what we find
    const amount1 = parseAmount(val1);
    const amount2 = parseAmount(val2);
    const amount3 = parseAmount(val3);
    const balance = parseAmount(balanceRaw);

    // Basic logic to assign credit/debit based on common Capitec layouts
    // Usually: Money In is positive, Money Out is negative
    rows.push({
      date: toISO(date),
      description: description.trim(),
      amount: amount1 !== 0 ? amount1 : amount2, // Simplified for the UI table
      balance: balance
    });
  }

  if (rows.length === 0) {
    throw new ParseError("CAPITEC_NO_TRANSACTIONS", "No Capitec transactions parsed. Check PDF format.");
  }

  return rows;
}

/* --- Helpers --- */

export function toISO(date) {
  if (!date.includes('/')) return date;
  const [dd, mm, yyyy] = date.split("/");
  return `${yyyy}-${mm}-${dd}`;
}

export function parseAmount(val) {
  if (!val || val.trim() === "") return 0;
  // Remove spaces (Capitec uses them as thousands separators) and non-numeric chars
  const sanitized = val.replace(/\s/g, "").replace(/[^-0.9.]/g, "");
  return parseFloat(sanitized) || 0;
}