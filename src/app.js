import express from "express";
import cors from "cors";

import healthRoute from "./routes/health.js";
import parseRoute from "./routes/parse.js";
import exportRoute from "./routes/export.js";
import { parseRateLimiter } from "./middleware/rateLimit.js";

const app = express();

/**
 * Global middleware
 * -----------------
 * CORS only (do NOT add express.json globally – file uploads rely on multer)
 */
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
  })
);

/**
 * Health check (no rate limiting)
 */
app.use("/health", healthRoute);

/**
 * Core API routes (rate limited)
 * ------------------------------
 * Applies to /parse and /export only
 */
app.use("/parse", parseRateLimiter, parseRoute);
app.use("/export", parseRateLimiter, exportRoute);

/**
 * Unknown route hard stop
 */
app.use((req, res) => {
  res.status(404).json({
    error: "NOT_FOUND",
    message: "Endpoint does not exist"
  });
});

/**
 * Global error handler (last resort)
 */
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  res.status(500).json({
    error: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred"
  });
});

export default app;
