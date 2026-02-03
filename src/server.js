import express from "express";
import cors from "cors";
import multer from "multer";
import { parseStatement } from "./services/parseStatement.js";

const app = express();

/**
 * 1. DYNAMIC CORS SETUP
 * Allows YouScan to communicate from Localhost, Vercel, or Lovable.
 */
const allowedOriginPatterns = [
  /^http:\/\/localhost:\d+$/,          // Local development
  /\.vercel\.app$/,                    // All Vercel deployments
  /\.lovable\.app$/                    // All Lovable previews and apps
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // Check if origin matches any of our trusted patterns
    const isAllowed = allowedOriginPatterns.some(pattern => 
      typeof pattern === 'string' ? pattern === origin : pattern.test(origin)
    );

    if (isAllowed) {
      return callback(null, true);
    } else {
      console.log("⚠️ CORS Blocked Origin:", origin);
      return callback(new Error("CORS Not Allowed by YouScan Policy"), false);
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Handle Preflight (The browser's "handshake" request)
app.options('*', cors()); 
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

/**
 * 2. HEALTH CHECKS & BRANDING
 */
app.get("/", (req, res) => res.send("YouScan Backend Engine is Online"));
app.get("/health", (req, res) => res.json({ status: "UP", service: "YouScan" }));

/**
 * 3. MAIN PARSING ROUTE
 */
app.post("/parse", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    
    console.log(`✅ YouScan Processing: ${req.file.originalname}`);
    const transactions = await parseStatement(req.file.buffer);

    // Ensure we always return an array to prevent frontend crashes
    const safeTransactions = Array.isArray(transactions) ? transactions : [];
    
    console.log(`🚀 YouScan sending ${safeTransactions.length} transactions to frontend`);
    res.json(safeTransactions);
  } catch (error) {
    console.error("❌ YouScan Parser Error:", error.message);
    // Return empty array with 500 status so UI can handle the "No Data" state gracefully
    res.status(500).json([]); 
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 YouScan Engine started on port ${PORT}`);
});

export default app;