import { ParseError } from "../errors/ParseError.js";

/**
 * FNB rows usually look like:
 * Date | Description | Amount | Balance
 * Example: 22 Des POS Purchase Lovable 436.11 623.48
 */
export function parseFnb(textOrLines) {
  // Standardize input to an array of lines
  const lines = Array.isArray(textOrLines) ? textOrLines : textOrLines.split('\n');
  const rows = [];
  let previousBalance = null;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip headers (Datum = Date, Beskrywing = Description in Afrikaans)
    if (!trimmedLine || /^Datum\s+Beskrywing/i.test(trimmedLine) || /^Date\s+Description/i.test(trimmedLine)) continue;

    // Normalize spacing
    const clean = trimmedLine.replace(/\s+/g, " ");

    /**
     * Regex breakdown:
     * 1. (\d{1,2}\s+\w+) -> Date (e.g., 22 Des or 22 Dec)
     * 2. (.*?) -> Description
     * 3. (-?\d[\d\s,.]*) -> Amount
     * 4. (-?\d[\d\s,.]*) -> Balance
     * 5. (?:Kt|Dt)? -> Optional Credit/Debit markers
     */
    const match = clean.match(
      /^(\d{1,2}\s+\w+)\s+(.*?)\s+(-?\d[\d\s,.]*)\s+(-?\d[\d\s,.]*)(?:\s*[KD]t)?$/i
    );

    if (!match) {
      // Log skipped lines for debugging without crashing the whole process
      if (trimmedLine.length > 5) console.warn(`Skipping FNB line: ${trimmedLine}`);
      continue;
    }

    const [, dateRaw, description, amountRaw, balanceRaw] = match;

    // Clean numeric strings: remove spaces/commas before converting to Number
    const amount = parseFnbAmount(amountRaw);
    const balance = parseFnbAmount(balanceRaw);

    let debit = 0;
    let credit = 0;
    let fee = null;

    // FNB logic: Calculate movement based on balance shifts if needed
    if (previousBalance !== null) {
      const delta = Number((balance - previousBalance).toFixed(2));

      if (delta < 0) debit = Math.abs(delta);
      if (delta > 0) credit = delta;

      // Identify fees based on description keywords
      if (/fee|fooi|bankkoste|comm/i.test(description)) {
        fee = Math.abs(delta);
        debit = 0; 
      }
    } else {
      // First row fallback: use the amount column directly
      if (amount < 0) debit = Math.abs(amount);
      else credit = amount;
    }

    rows.push({
      date: parseFnbDate(dateRaw),
      description: description.trim(),
      amount: credit > 0 ? credit : -debit, // Standardized for the UI table
      balance: balance
    });

    previousBalance = balance;
  }

  if (rows.length === 0) {
    throw new ParseError("FNB_NO_TRANSACTIONS", "No FNB transactions could be parsed from this file.");
  }

  return rows;
}

/* --- Helpers --- */

export function parseFnbAmount(val) {
  if (!val) return 0;
  // Remove spaces and commas, keep dots and minus signs
  const sanitized = val.replace(/\s/g, "").replace(/,/g, "");
  return parseFloat(sanitized) || 0;
}

export function parseFnbDate(value) {
  try {
    const [day, month] = value.split(/\s+/);
    const months = {
      Jan: "01", Feb: "02", Mar: "03", Apr: "04",
      May: "05", Jun: "06", Jul: "07", Aug: "08",
      Sep: "09", Oct: "10", Nov: "11", Dec: "12",
      Des: "12" // Support Afrikaans statements
    };
    
    const monthNum = months[month.substring(0, 3).charAt(0).toUpperCase() + month.substring(1, 3).toLowerCase()];
    return `2026-${monthNum || '01'}-${day.padStart(2, "0")}`;
  } catch (e) {
    return value; // Fallback to raw string if parsing fails
  }
}