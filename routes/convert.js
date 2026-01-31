import express from "express";
import multer from "multer";
import { parsePdf } from "../utils/parsePdf.js";
import { parseExcel } from "../utils/parseExcel.js";
import { toCsv } from "../utils/toCsv.js";

const router = express.Router();

// Memory storage (NO FILES SAVED)
const upload = multer({ storage: multer.memoryStorage() });

router.post("/convert", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { originalname, buffer } = req.file;

    let rows = [];

    if (originalname.endsWith(".pdf")) {
      rows = await parsePdf(buffer);
    } else if (
      originalname.endsWith(".xls") ||
      originalname.endsWith(".xlsx")
    ) {
      rows = await parseExcel(buffer);
    } else {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    if (!rows.length) {
      return res.status(400).json({ error: "No transactions found" });
    }

    const csv = await toCsv(rows);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=bank-statement.csv"
    );

    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Conversion failed" });
  }
});

export default router;
