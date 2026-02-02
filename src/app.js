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
app.use(express.json());

// FIXED: Changed origin to "*" to prevent Vercel blocking
app.use(cors({ 
  origin: "*", 
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
app.use((req, res) => {
  res.status(404).json({
    error: "NOT_FOUND",
    message: `The endpoint ${req.originalUrl} does not exist on this server.`
  });
});

app.use((err, req, res, next) => {
  console.error("Global Error:", err.stack);
  res.status(500).json({
    error: "INTERNAL_SERVER_ERROR",
    message: "Something went wrong on our end."
  });
});

export default app;