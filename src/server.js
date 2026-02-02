import express from "express";
import cors from "cors";
import multer from "multer";
import { parseStatement } from "./services/parseStatement.js";

const app = express();

// 1. CORS Setup - Vital for Vercel communication
app.use(cors()); 
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// Health check for Railway to see the app is "Alive"
app.get("/", (req, res) => {
  res.send("SlimJan Backend is Online");
});

app.get("/health", (req, res) => {
  res.json({ status: "UP", timestamp: new Date().toISOString() });
});

// Main parsing route
app.post("/parse", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    console.log(`Received file: ${req.file.originalname}`);
    const transactions = await parseStatement(req.file.buffer);
    res.json(transactions);
  } catch (error) {
    console.error("Parsing Error:", error.message);
    res.status(500).json({ 
      error: "FAILED_TO_PARSE", 
      message: error.message 
    });
  }
});

// --- POINT 2: RAILWAY STARTUP LOGIC ---
// We define the port and tell the app to listen on all network interfaces
const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 SlimJan engine started on port ${PORT}`);
});

export default app;