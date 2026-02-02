import express from "express";
import { rowsToCsv } from "../utils/csv.js";
import { validateLedger } from "../core/validateLedger.js";

const router = express.Router();

router.post("/", express.json(), (req, res) => {
  const { statement, transactions } = req.body;

  if (!statement || !transactions) {
    return res.status(400).json({ error: "INVALID_EXPORT_PAYLOAD" });
  }

  // Safety: re-validate ledger
  const result = validateLedger(transactions, statement);

  const csv = rowsToCsv(statement, transactions);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="SlimJan_${statement.bank}_${statement.statement_period.from}_${statement.statement_period.to}.csv"`
  );

  res.send(csv);
});

export default router;
