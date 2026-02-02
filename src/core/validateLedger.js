import { ParseError } from "../errors/ParseError.js";

export function validateLedger(transactions, metadata) {
  const warnings = [];

  if (!transactions.length) {
    throw new ParseError("LEDGER_EMPTY", "No transactions to validate");
  }

  for (let i = 1; i < transactions.length; i++) {
    const prev = transactions[i - 1];
    const curr = transactions[i];

    const expected =
      prev.balance +
      curr.credit -
      curr.debit -
      (curr.fee || 0);

    if (Math.abs(expected - curr.balance) > 0.01) {
      warnings.push(
        `Balance mismatch on ${curr.date}: expected ${expected.toFixed(
          2
        )}, got ${curr.balance.toFixed(2)}`
      );
    }
  }

  return {
    valid: true,
    warnings
  };
}
