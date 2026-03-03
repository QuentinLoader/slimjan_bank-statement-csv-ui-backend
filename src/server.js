// ==========================================
// 🔥 SERVER BUILD
// ==========================================

console.log("🔥 SERVER BUILD ID: 2026-03-03-OZOW-STABLE");

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

// Webhook (must come before JSON middleware)
import ozowWebhook from "./webhooks/ozow.webhook.js";

// Routes
import authRoutes from "./routes/auth.routes.js";
import usageRoutes from "./routes/usage.routes.js";
import billingRoutes from "./routes/billing.routes.js";
import { router as parseRoute } from "./routes/parse.js";
import { PRICING } from "./config/pricing.js";
import ozowPaymentRoutes from "./routes/ozow.payment.routes.js";

const app = express();

app.set("trust proxy", 1);

/* =========================================
   OZOW PAYMENT ROUTES (RAW BODY SAFE)
   ========================================= */
app.use("/billing", ozowPaymentRoutes);


/* =========================================
   OZOW WEBHOOK (RAW BODY SAFE)
   ========================================= */
app.use("/ozow/webhook", ozowWebhook);

/* =========================================
   SECURITY MIDDLEWARE
   ========================================= */
app.use(helmet());

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
});

app.use(globalLimiter);

/* =========================================
   JSON PARSER (AFTER WEBHOOK)
   ========================================= */
app.use(express.json());

/* =========================================
   CORS
   ========================================= */
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://youscan.addvision.co.za"
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith(".lovable.app") ||
        origin.endsWith(".lovableproject.com")
      ) {
        return callback(null, true);
      }

      console.warn("Blocked by CORS:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  })
);

app.options("*", cors({
  origin: allowedOrigins,
  credentials: true
}));

/* =========================================
   HEALTH CHECK
   ========================================= */
app.get("/", (req, res) =>
  res.send("YouScan Engine: Production Billing Active")
);

/* =========================================
   PRICING
   ========================================= */
app.get("/pricing", (req, res) => {
  res.json(PRICING);
});

/* =========================================
   ROUTES
   ========================================= */
app.use("/auth", authRoutes);
app.use("/usage", usageRoutes);
app.use("/billing", billingRoutes);
app.use("/parse", parseRoute);

/* =========================================
   404 HANDLER
   ========================================= */
app.use((req, res) => {
  res.status(404).json({
    error: "NOT_FOUND",
    message: `The endpoint ${req.originalUrl} does not exist.`
  });
});

/* =========================================
   GLOBAL ERROR HANDLER
   ========================================= */
app.use((err, req, res, next) => {
  console.error("Global Error:", err.stack);
  res.status(500).json({
    error: "INTERNAL_SERVER_ERROR",
    message: "Something went wrong."
  });
});

/* =========================================
   START SERVER
   ========================================= */
const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 YouScan running on port ${PORT}`);
});