import express from "express";
import cors from "cors";
import multer from "multer";
import { parseStatement } from "./services/parseStatement.js";

const app = express();

// 1. NUCLEAR CORS (Allows everything for development)
app.use(cors({
  origin: '*', // This allows Lovable, Vercel, and Localhost instantly
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false // Note: credentials must be false if origin is '*'
}));

app.options('*', cors()); 
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// Health Check
app.get("/", (req, res) => res.send("YouScan Engine: Global Access Active"));

// Main Route
app.post("/parse", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    
    console.log(`✅ YouScan received: ${req.file.originalname}`);
    const transactions = await parseStatement(req.file.buffer);
    res.json(transactions || []);
  } catch (error) {
    console.error("❌ YouScan Error:", error.message);
    res.status(500).json([]);
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 YouScan running on ${PORT}`);
});