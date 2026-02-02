import { ParseError } from "../errors/ParseError.js";

export function parseFnbTransactions(lines) {
  const rows = [];
  let previousBalance = null;

  for (const line of lines) {
    if (/^Datum\s+Beskrywing/i.test(line)) continue;

    const clean = line.replace(/\s+/g, " ").trim();

    /**
     * Example:
     * 22 Des POS Purchase Lovable 436.11 623.48
     */
    const match = clean.match(
      /^(\d{1,2}\s+\w+)\s+(.*?)\s+(-?\d[\d,.]*)\s+(-?\d[\d,.]*)(?:Kt|Dt)?$/i
    );

    if (!match) {
      throw new ParseError(
        "FNB_ROW_PARSE_FAILED",
        `Unparseable FNB transaction row: "${line}"`
      );
    }

    const [, dateRaw, description, amountRaw, balanceRaw] = match;

    const amount = Number(amountRaw.replace(/,/g, ""));
    const balance = Number(balanceRaw.replace(/,/g, ""));

    let debit = 0;
    let credit = 0;
    let fee = null;

    if (previousBalance !== null) {
      const delta = balance - previousBalance;

      if (delta < 0) debit = Math.abs(delta);
      if (delta > 0) credit = delta;

      if (/fee|fooi|bankkoste/i.test(description)) {
        fee = Math.abs(delta);
        debit = 0;
      }
    }

    rows.push({
      date: parseFnbDate(dateRaw),
      description: description.trim(),
      debit,
      credit,
      fee,
      balance
    });

    previousBalance = balance;
  }

  if (rows.length === 0) {
    throw new ParseError("FNB_NO_TRANSACTIONS", "No FNB transactions parsed");
  }

  return rows;
}

function parseFnbDate(value) {
  const [day, month] = value.split(" ");
  const months = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04",
    May: "05", Jun: "06", Jul: "07", Aug: "08",
    Sep: "09", Oct: "10", Nov: "11", Dec: "12",
    Des: "12"
  };
  return `2026-${months[month]}-${day.padStart(2, "0")}`;
}
