import { ParseError } from '../errors/ParseError.js';

/**
 * Merges broken lines into single transaction rows based on date markers.
 * @param {string[]} section - Array of raw text lines
 * @returns {string[]} - Array of merged transaction strings
 */
export const extractTransactionSection = (section) => {
  const merged = [];
  let buffer = "";

  for (const line of section) {
    // 1. Skip repeated headers
    if (/^Date\s+Description/i.test(line)) continue;

    // 2. If line starts with a date (e.g., "01 Jan" or "2024/01/01") → new row
    // This regex looks for a digit at the start of the line
    if (/^\d{1,2}[\/\s\-]/.test(line.trim())) {
      if (buffer) merged.push(buffer.trim());
      buffer = line;
    } else {
      // 3. Continuation line (description wrap or overflow)
      buffer += " " + line;
    }
  }

  // 4. Push the final buffer
  if (buffer) merged.push(buffer.trim());

  // 5. Fail Loudly if nothing was found
  if (!merged.length) {
    throw new ParseError("TRANSACTION_SECTION_EMPTY", "No usable transaction rows found in the section");
  }

  return merged;
};