export function rowsToCsv(statement, transactions) {
  const lines = [];

  // Metadata header (human readable)
  lines.push(`Account Holder,${statement.account_holder.full_name}`);
  lines.push(`Bank,${statement.bank}`);
  lines.push(`Account Number,${statement.account_number || ""}`);
  lines.push(
    `Period,${statement.statement_period.from} to ${statement.statement_period.to}`
  );
  lines.push(`Currency,${statement.currency}`);
  lines.push(""); // spacer row

  // Table header
  lines.push("Date,Description,Debit,Credit,Fee,Balance");

  for (const tx of transactions) {
    lines.push(
      [
        tx.date,
        `"${tx.description.replace(/"/g, '""')}"`,
        tx.debit || "",
        tx.credit || "",
        tx.fee || "",
        tx.balance
      ].join(",")
    );
  }

  return lines.join("\n");
}
