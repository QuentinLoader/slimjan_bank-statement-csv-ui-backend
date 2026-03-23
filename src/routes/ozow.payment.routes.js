import express from "express";
import crypto from "crypto";

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
    
    // 🔥 FIX 1: Super-safe Reference (15 chars)
    // Some gateways trigger a 302 if the reference looks like a URL or has special chars.
    const timestamp = Math.floor(Date.now() / 1000).toString().slice(-6);
    const bankReference = `YZ${userId}X${timestamp}`.substring(0, 15);
    
    // 🔥 FIX 2: Explicitly trim URLs to prevent hidden whitespace in Hash
    const baseUrl = "https://youscan.addvision.co.za";
    const notifyBase = "https://youscan-statement-csv-ui-backend-production.up.railway.app";

    const payload = {
      SiteCode: siteCode.trim(),
      CountryCode: "ZA",
      CurrencyCode: "ZAR",
      Amount: parseFloat(amount).toFixed(2),
      TransactionReference: bankReference,
      BankReference: bankReference,
      CancelUrl: `${baseUrl}/payment-cancelled`.trim(),
      ErrorUrl: `${baseUrl}/payment-error`.trim(),
      SuccessUrl: `${baseUrl}/payment-return`.trim(),
      NotifyUrl: `${notifyBase}/ozow`.trim(),
      IsTest: true // Set to true ONLY if using an Ozow Sandbox SiteCode
    };

    // Construct Hash String
    // Note: IsTest must be stringified exactly as Ozow expects ('true' or 'false')
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
      privateKey.trim()
    ).toLowerCase();

    const hash = crypto.createHash("sha512").update(hashString).digest("hex");

    console.log(`✅ Gateway Request Initialized: ${bankReference}`);

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