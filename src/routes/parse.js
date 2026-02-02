import express from "express";
import multer from "multer";
import { parseStatement } from "../services/parseStatement.js";

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

router.post("/", upload.single("file"), async (req, res) => {
  try {
    const result = await parseStatement(req.file.buffer);
    res.json(result);
  } catch (err) {
    res.status(422).json({
      error: err.code || "PARSE_FAILED",
      message: err.message
    });
  }
});

export default router;
