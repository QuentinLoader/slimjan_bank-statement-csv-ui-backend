import express from "express";
import cors from "cors";
import multer from "multer";
import { parseStatement } from "./services/parseStatement.js";

const app = express();

// 1. NUCLEAR CORS (Allows everything for development)
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false 
}));

app.options('*', cors()); 
app.use(express.json());

// Using MemoryStorage for fast, temporary processing
const upload = multer({ storage: multer.memoryStorage() });

// Health Check
app.get("/", (req, res) => res.send("YouScan Engine: Global Access Active"));

/**
 * Main Route: Now uses upload.any() to prevent "Unexpected Field" errors
 * Supports single and multiple file uploads automatically.
 */
app.post("/parse", upload.any(), async (req, res) => {
  try {
    // upload.any() populates req.files regardless of the field name used by Lovable
    const files = req.files || [];
    
    if (files.length === 0) {
      console.error("❌ Request received but no files found in req.files");
      return res.status(400).json({ error: "No files uploaded" });
    }
    
    console.log(`📂 Processing ${files.length} file(s)...`);
    let allTransactions = [];

    for (const file of files) {
      console.log(`✅ YouScan processing: ${file.originalname} (Field: ${file.fieldname})`);
      
      const result = await parseStatement(file.buffer);
      
      // Standardize the response with bank metadata for Lovable UI
      const transactionsWithMetadata = (result.transactions || []).map(t => ({
        ...t,
        bankName: result.bankName,
        bankLogo: result.bankLogo,
        sourceFile: file.originalname
      }));

      allTransactions = [...allTransactions, ...transactionsWithMetadata];
      console.log(`📊 Extracted ${result.transactions.length} items from ${result.bankName}`);
    }

    // Return the combined array to the frontend
    res.json(allTransactions);

  } catch (error) {
    console.error("❌ YouScan Error:", error.message);
    res.status(500).json({ error: "Parsing failed", details: error.message });
  }
});

/**
 * Simple Auth Gate: Validation for the '007' access code
 */
app.post("/verify-gate", (req, res) => {
  const { code } = req.body;
  if (code === "007") {
    console.log("🔓 Access Granted: Code 007 matched.");
    res.json({ success: true, token: "youscan-access-granted" });
  } else {
    console.warn("🔒 Access Denied: Incorrect code entered.");
    res.status(401).json({ success: false, message: "Invalid Access Code" });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 YouScan running on port ${PORT}`);
});