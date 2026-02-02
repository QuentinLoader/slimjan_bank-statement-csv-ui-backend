import express from "express";
import cors from "cors";

// Routes
import { router as healthRoute } from "./routes/health.js";
import { router as parseRoute } from "./routes/parse.js";
import { router as exportRoute } from "./routes/export.js";

const app = express();

/**
 * MIDDLEWARE
 */
// Allows the app to read JSON bodies sent from your frontend
app.use(express.json());

// CORS configuration
// origin: true reflects the request origin, but for production, 
// you can replace it with your specific Vercel/Netlify URL.
app.use(cors({ 
  origin: true,
  methods: ["GET", "POST"],
  credentials: true 
}));

/**
 * ROUTES
 */
app.use("/health", healthRoute);
app.use("/parse", parseRoute);
app.use("/export", exportRoute);

/**
 * ERROR HANDLING
 */
// 404 fallback for missing endpoints
app.use((req, res) => {
  res.status(404).json({
    error: "NOT_FOUND",
    message: `The endpoint ${req.originalUrl} does not exist on this server.`
  });
});

// Global Error Handler (prevents server crashes on unhandled logic errors)
app.use((err, req, res, next) => {
  console.error("Global Error:", err.stack);
  res.status(500).json({
    error: "INTERNAL_SERVER_ERROR",
    message: "Something went wrong on our end."
  });
});

export default app;