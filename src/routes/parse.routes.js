import express from "express";
import multer from "multer";
import { parseStatement } from "../services/parseStatement.js";
import authMiddleware from "../middleware/auth.middleware.js";
import billingMiddleware from "../middleware/billing.middleware.js";
import { deductUserCredit } from "../services/billing.service.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post(
  "/",
  authMiddleware,
  billingMiddleware,
  upload.any(),
  async (req, res) => {
    try {
      const files = req.files || [];

      if (files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      let allTransactions = [];
      let successfulParse = false;

      for (const file of files) {
        try {
          const result = await parseStatement(file.buffer);

          let rawTransactions = [];
          let statementMetadata = {};
          let detectedBankName = "FNB";
          let detectedBankLogo = "fnb";

          if (result?.transactions && Array.isArray(result.transactions)) {
            rawTransactions = result.transactions;
            statementMetadata = result.metadata || {};
            if (result.bankName) detectedBankName = result.bankName;
            if (result.bankLogo) detectedBankLogo = result.bankLogo;
          } else if (
            result?.transactions?.transactions &&
            Array.isArray(result.transactions.transactions)
          ) {
            rawTransactions = result.transactions.transactions;
            statementMetadata = result.transactions.metadata || {};
          } else if (Array.isArray(result)) {
            rawTransactions = result;
          }

          if (rawTransactions.length === 0) {
            continue;
          }

          successfulParse = true;

          const standardized = rawTransactions.map((t) => ({
            ...t,
            bankName: t.bankName || detectedBankName,
            bankLogo: t.bankLogo || detectedBankLogo,
            sourceFile: file.originalname,
            statementMetadata: {
              openingBalance: statementMetadata.openingBalance || 0,
              closingBalance: statementMetadata.closingBalance || 0,
              statementId: statementMetadata.statementId || "Unknown",
            },
          }));

          allTransactions.push(...standardized);
        } catch (err) {
          console.error(`Error parsing ${file.originalname}:`, err.message);
        }
      }

      if (!successfulParse || allTransactions.length === 0) {
        return res.status(422).json({
          error: "Parsing failed or no transactions detected",
        });
      }

      try {
        await deductUserCredit(req.user);
      } catch (billingError) {
        console.error("Credit deduction failed:", billingError);
        return res.status(500).json({ error: "Billing error" });
      }

      return res.json(allTransactions);

    } catch (error) {
      console.error("Parse route error:", error);
      return res.status(500).json({ error: "Parsing failed" });
    }
  }
);

export default router;