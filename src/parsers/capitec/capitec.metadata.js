import { ParseError } from "../../errors/ParseError.js";

export function extractCapitecMetadata(text) {
  // Account holder name
  const nameMatch = text.match(/MR\s+([A-Z]+)\s+([A-Z]+)/);
  if (!nameMatch) {
    throw new ParseError("METADATA_NAME_NOT_FOUND", "Capitec account holder name not found");
  }

  const fullName = `${nameMatch[1]} ${nameMatch[2]}`;

  // Account number
  const accountMatch = text.match(/Account\s+(\d{6,})/);
  if (!accountMatch) {
    throw new ParseError("METADATA_ACCOUNT_NOT_FOUND", "Capitec account number not found");
  }

  // Statement period
  const fromMatch = text.match(/From Date:\s+(\d{2}\/\d{2}\/\d{4})/);
  const toMatch = text.match(/To Date:\s+(\d{2}\/\d{2}\/\d{4})/);

  if (!fromMatch || !toMatch) {
    throw new ParseError("METADATA_PERIOD_NOT_FOUND", "Capitec statement period not found");
  }

  // Opening / closing balance
  const openingMatch = text.match(/Opening Balance:\s+R([\d,.]+)/);
  const closingMatch = text.match(/Closing Balance:\s+R([\d,.]+)/);

  return {
    bank: "capitec",
    account_holder: {
      full_name: fullName
    },
    account_number: accountMatch[1],
    statement_period: {
      from: toISO(fromMatch[1]),
      to: toISO(toMatch[1])
    },
    opening_balance: openingMatch ? parseMoney(openingMatch[1]) : null,
    closing_balance: closingMatch ? parseMoney(closingMatch[1]) : null,
    currency: "ZAR"
  };
}

function toISO(date) {
  const [dd, mm, yyyy] = date.split("/");
  return `${yyyy}-${mm}-${dd}`;
}

function parseMoney(value) {
  return Number(value.replace(/,/g, ""));
}
