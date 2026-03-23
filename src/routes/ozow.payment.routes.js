import express from "express";
import crypto from "crypto";
import pool from "../config/db.js";

const router = express.Router();

// Helper to get price based on your pricing config
const getPrice = (planCode) => {
  const prices = {
    'PAYG_10': 5.00,
    'MONTHLY_25': 25.00,
    'PRO_YEAR_UNLIMITED': 250.00
  };
  return prices[planCode] || null;
};

/**
 * ✅ CREATE OZOW PAYMENT
 * Now only requires planCode from frontend.
 */
router.post("/create-ozow-payment", async (req, res) => {
  try {
    // 1. Get data from request
    const { planCode } = req.body;
    
    // 2. Fallback for userId (Try to get it from your auth middleware if available)
    // For now, we will expect it in the body OR you can hardcode a test ID.
    const userId = req.body.userId || req.user?.id; 

    const amount = getPrice(planCode);

    if (!amount || !userId) {
      console.error("❌ Missing Data:", { planCode, amount, userId });
      return res.status(400).json({ 
        error: "MISSING_REQUIRED_FIELDS",
        details: !amount ? "Invalid Plan Code" : "User ID not found" 
      });
    }

    const siteCode = process.env.OZOW_SITE_CODE;
    const privateKey = process.env.OZOW_PRIVATE_KEY;
    const bankReference = `${userId}_${planCode}_${Date.now()}`;
    
    const payload = {
      SiteCode: siteCode,
      CountryCode: "ZA",
      CurrencyCode: "ZAR",
      Amount: parseFloat(amount).toFixed(2),
      TransactionReference: bankReference,
      BankReference: bankReference,
      CancelUrl: `https://youscan.addvision.co.za/payment-cancelled`,
      ErrorUrl: `https://youscan.addvision.co.za/payment-error`,
      SuccessUrl: `https://youscan.addvision.co.za/payment-return`,
      NotifyUrl: `https://youscan-statement-csv-ui-backend-production.up.railway.app/ozow/webhook`,
      IsTest: true 
    };

    const hashString = (
      payload.SiteCode +
      payload.CountryCode +
      payload.CurrencyCode +
      payload.Amount +
      payload.TransactionReference +
      payload.BankReference +
      payload.CancelUrl +
      payload.ErrorUrl +
      payload.SuccessUrl +
      payload.NotifyUrl +
      payload.IsTest +
      privateKey
    ).toLowerCase();

    const hash = crypto.createHash("sha512").update(hashString).digest("hex");

    res.status(200).json({
      ...payload,
      Hash: hash
    });

  } catch (error) {
    console.error("❌ Failed to initiate Ozow payment:", error);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
  }
});

export default router;