import express from "express";
import cors from "cors";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check (REQUIRED)
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Railway PORT (CRITICAL)
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
