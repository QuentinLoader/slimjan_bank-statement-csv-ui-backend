import xlsx from "xlsx";

export function parseExcel(buffer) {
  const workbook = xlsx.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const json = xlsx.utils.sheet_to_json(sheet);

  return json.map(row => ({
    date: row.Date || row["Transaction Date"],
    description: row.Description,
    debit: row.Debit || "",
    credit: row.Credit || "",
    balance: row.Balance || ""
  }));
}
