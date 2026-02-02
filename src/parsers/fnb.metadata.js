import { ParseError } from "../errors/ParseError.js";

export function extractFnbMetadata(text) {
  // Name
  const nameMatch = text.match(/MR\s+([A-Z]+)\s+([A-Z]+)/);
  if (!nameMatch) {
    throw new ParseError("METADATA_NAME_NOT_FOUND", "FNB account holder name not found");
  }

  const fullName = `${nameMatch[1]} ${nameMatch[2]}`;

  // Account number
  const accountMatch = text.match(/Account\s*:\s*(\d{6,})|(\d{6,})\s+FNB/i);
  if (!accountMatch) {
    throw new ParseError("METADATA_ACCOUNT_NOT_FOUND", "FNB account number not found");
  }

  const accountNumber = accountMatch[1] || accountMatch[2];

  // Statement period
  const periodMatch = text.match(
    /Staat Periode\s*:\s*(\d{1,2}\s+\w+\s+\d{4})\s+tot\s+(\d{1,2}\s+\w+\s+\d{4})/i
  );

  if (!periodMatch) {
    throw new ParseError("METADATA_PERIOD_NOT_FOUND", "FNB statement period not found");
  }

  return {
    bank: "fnb",
    account_holder: {
      full_name: fullName
    },
    account_number: accountNumber,
    statement_period: {
      from: parseAfrDate(periodMatch[1]),
      to: parseAfrDate(periodMatch[2])
    },
    opening_balance: null,
    closing_balance: null,
    currency: "ZAR"
  };
}

function parseAfrDate(date) {
  const [day, month, year] = date.split(" ");
  const months = {
    Januarie: "01",
    Februarie: "02",
    Maart: "03",
    April: "04",
    Mei: "05",
    Junie: "06",
    Julie: "07",
    Augustus: "08",
    September: "09",
    Oktober: "10",
    November: "11",
    Desember: "12"
  };
  return `${year}-${months[month]}-${day.padStart(2, "0")}`;
}
