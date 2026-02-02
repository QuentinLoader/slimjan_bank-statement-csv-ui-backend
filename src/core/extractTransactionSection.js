import { ParseError } from "../errors/ParseError.js";

export function extractTransactionSection(rawText, bank) {
  const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);

  const startPatterns = {
    capitec: /^Transaction History/i,
    fnb: /^Transaksies|^Datum\s+Beskrywing/i
  };

  const endPatterns = [
    /^Closing Balance/i,
    /^Afsluitingsaldo/i,
    /^Omset vir Staat Periode/i,
    /^Bladsy\s+\d+/i
  ];

  const startRegex = startPatterns[bank];
  if (!startRegex) {
    throw new ParseError("UNSUPPORTED_BANK", `No section rules for bank: ${bank}`);
  }

  let startIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (startRegex.test(lines[i])) {
      startIndex = i + 1;
      break;
    }
  }

  if (startIndex === -1) {
    throw new ParseError("TRANSACTION_SECTION_NOT_FOUND", "Transaction section header not found");
  }

  const section = [];

  for (let i = startIndex; i < lines.length; i++) {
    if (endPatterns.some(rx => rx.test(lines[i]))) break;
    section.push(lines[i]);
  }

  if (section.length === 0) {
    throw new ParseError("TRANSACTION_SECTION_EMPTY", "Transaction section is empty");
  }

  return section;
}
