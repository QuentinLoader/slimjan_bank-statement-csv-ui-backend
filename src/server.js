import express from "express";
import cors from "cors"; // <--- Added for Fire 1
import multer from "multer";
import { parseStatement } from "./services/parseStatement.js";

const app = express();

// 1. Fix CORS: Allow your Vercel frontend to talk to this Railway backend
app.use(cors()); 

app.use(express.json());

// Set up Multer for memory storage (file uploads)
const upload = multer({ storage: multer.memoryStorage() });

/**
 * The /parse route your frontend is looking for.
 * Image 1 showed a 404, so we must ensure this path is exactly '/parse'
 */
app.post("/parse", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log(`Received file: ${req.file.originalname}`);
    
    // Call the service that chooses between Capitec and FNB parsers
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

// Root route for health check
app.get("/", (req, res) => {
  res.send("SlimJan Backend is Online");
});

export default app;