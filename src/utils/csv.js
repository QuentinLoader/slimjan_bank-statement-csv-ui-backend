export function rowsToCsv(statement, transactions) {
  const lines = [];

  // ---- Metadata header (safe access) ----
  lines.push(`Account Holder,${statement.account_holder?.full_name || ""}`);
  lines.push(`Bank,${statement.bank || ""}`);
  lines.push(`Account Number,${statement.account_number || ""}`);
  lines.push(
    `Period,${statement.statement_period?.from || ""} to ${statement.statement_period?.to || ""}`
  );
  lines.push(`Currency,${statement.currency || ""}`);
  lines.push(""); // spacer row

  // ---- Table header ----
  lines.push("Date,Description,Debit,Credit,Fee,Balance");

  for (const tx of transactions) {
    const description = String(tx.description || "").replace(/"/g, '""');

    lines.push(
      [
        tx.date || "",
        `"${description}"`,
        tx.debit ?? "",
        tx.credit ?? "",
        tx.fee ?? "",
        tx.balance ?? ""
      ].join(",")
    );
  }

  return lines.join("\n");
}
