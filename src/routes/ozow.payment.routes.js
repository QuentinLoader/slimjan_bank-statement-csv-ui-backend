import express from "express";
import crypto from "crypto";
import pool from "../config/db.js";

const router = express.Router();

const getPrice = (planCode) => {
  const prices = {
    'PAYG_10': 5.00,
    'MONTHLY_25': 25.00,
    'PRO_YEAR_UNLIMITED': 250.00
  };
  return prices[planCode] || null;
};

router.post("/create-ozow-payment", async (req, res) => {
  try {
    const { planCode, userId } = req.body;
    const amount = getPrice(planCode);

    if (!amount || !userId) {
      return res.status(400).json({ error: "INVALID_REQUEST_DATA" });
    }

    const siteCode = process.env.OZOW_SITE_CODE;
    const privateKey = process.env.OZOW_PRIVATE_KEY;
    
    // 🔥 FIX 1: Extremely Safe Reference (15 chars max)
    // Some bank gateways are even stricter than 20 chars.
    const bankReference = `${userId}x${planCode}x${Math.floor(Date.now() / 10000)}`.substring(0, 15);
    
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
      // 🔥 FIX 2: Removed trailing slashes and kept the URL as short as humanly possible.
      NotifyUrl: `https://youscan-statement-csv-ui-backend-production.up.railway.app/ozow`,
      // 🔥 FIX 3: Set to FALSE if you are using your real ADD-ADD-011 SiteCode.
      IsTest: false 
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
    console.error("❌ Ozow Error:", error);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
  }
});

export default router;