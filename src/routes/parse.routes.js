import express from "express";
import multer from "multer";
import { parseStatement } from "../services/parseStatement.js";
import authMiddleware from "../middleware/auth.middleware.js";
import billingMiddleware from "../middleware/billing.middleware.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/", authMiddleware, billingMiddleware, upload.any(), async (req, res) => {
  try {
    const files = req.files || [];

    if (files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    let allTransactions = [];

    for (const file of files) {
      try {
        const result = await parseStatement(file.buffer);

        let rawTransactions = [];
        let statementMetadata = {};
        let detectedBankName = "FNB";
        let detectedBankLogo = "fnb";

        if (result.transactions && Array.isArray(result.transactions)) {
          rawTransactions = result.transactions;
          statementMetadata = result.metadata || {};
          if (result.bankName) detectedBankName = result.bankName;
          if (result.bankLogo) detectedBankLogo = result.bankLogo;
        } else if (
          result.transactions &&
          result.transactions.transactions &&
          Array.isArray(result.transactions.transactions)
        ) {
          rawTransactions = result.transactions.transactions;
          statementMetadata = result.transactions.metadata || {};
        } else if (Array.isArray(result)) {
          rawTransactions = result;
        } else {
          continue;
        }

        const standardized = rawTransactions.map(t => ({
          ...t,
          bankName: t.bankName || detectedBankName,
          bankLogo: t.bankLogo || detectedBankLogo,
          sourceFile: file.originalname,
          statementMetadata: {
            openingBalance: statementMetadata.openingBalance || 0,
            closingBalance: statementMetadata.closingBalance || 0,
            statementId: statementMetadata.statementId || "Unknown"
          }
        }));

        allTransactions = [...allTransactions, ...standardized];

      } catch (err) {
        console.error(`Error parsing ${file.originalname}:`, err.message);
      }
    }

    res.json(allTransactions);

  } catch (error) {
    res.status(500).json({ error: "Parsing failed" });
  }
});

export default router;
