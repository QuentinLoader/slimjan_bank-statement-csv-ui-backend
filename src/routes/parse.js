import express from "express";
import multer from "multer";
import { parseStatement } from "../services/parseStatement.js";

const router = express.Router();

/**
 * Multer configuration
 * --------------------
 * - Memory only (POPIA-safe)
 * - PDF only
 * - Max size: 5 MB
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("ONLY_PDF_ALLOWED"));
    }
    cb(null, true);
  }
});

/**
 * POST /parse
 * -----------
 * Accepts ONE PDF bank statement
 * Returns parsed JSON for preview
 */
router.post("/", upload.single("file"), async (req, res) => {
  try {
    /**
     * Guard: no file
     */
    if (!req.file) {
      return res.status(400).json({
        error: "NO_FILE",
        message: "No PDF file uploaded"
      });
    }

    /**
     * Guard: multiple files (defensive)
     * multer.single() should prevent this, but we fail loudly anyway
     */
    if (Array.isArray(req.files)) {
      return res.status(400).json({
        error: "MULTIPLE_FILES_NOT_ALLOWED",
        message: "Upload a single PDF bank statement only"
      });
    }

    /**
     * Core parsing
     */
    const result = await parseStatement(req.file.buffer);

    res.json(result);
  } catch (err) {
    /**
     * File type error
     */
    if (err.message === "ONLY_PDF_ALLOWED") {
      return res.status(400).json({
        error: "INVALID_FILE_TYPE",
        message: "Only PDF bank statements are supported"
      });
    }

    /**
     * File size error (multer)
     */
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        error: "FILE_TOO_LARGE",
        message: "PDF exceeds 5 MB size limit"
      });
    }

    /**
     * Known parsing errors (fail loudly)
     */
    return res.status(422).json({
      error: err.code || "PARSE_FAILED",
      message: err.message || "Unable to parse statement"
    });
  }
});

export default router;
