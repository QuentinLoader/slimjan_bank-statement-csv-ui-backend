import { ParseError } from "../errors/ParseError.js";

/**
 * Deterministically validates ledger balance continuity.
 * Returns valid=false if any inconsistencies are found.
 */
export function validateLedger(transactions) {
  const warnings = [];

  // Check if we actually have data to work with
  if (!Array.isArray(transactions) || transactions.length === 0) {
    throw new ParseError("LEDGER_EMPTY", "No transactions to validate");
  }

  // Loop through transactions to check the math between rows
  for (let i = 1; i < transactions.length; i++) {
    const prev = transactions[i - 1];
    const curr = transactions[i];

    // Math: Previous Balance + Money In - Money Out - Fees
    const expected =
      prev.balance +
      (curr.credit || 0) -
      (curr.debit || 0) -
      (curr.fee || 0);

    // Epsilon check (0.01) to ignore tiny rounding errors common in JavaScript
    if (Math.abs(expected - curr.balance) > 0.01) {
      warnings.push(
        `Balance mismatch on ${curr.date}: expected ${expected.toFixed(2)}, got ${curr.balance.toFixed(2)}`
      );
    }
  }

  return {
    valid: warnings.length === 0,
    warnings
  };
}