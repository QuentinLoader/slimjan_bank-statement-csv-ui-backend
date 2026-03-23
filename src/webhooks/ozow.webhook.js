import express from "express";
import crypto from "crypto";

const router = express.Router();

const getPrice = (planCode) => {
  const prices = {
    PAYG_10: 5.0,
    MONTHLY_25: 25.0,
    PRO_YEAR_UNLIMITED: 250.0,
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

    const siteCode = process.env.OZOW_SITE_CODE?.trim();
    const privateKey = process.env.OZOW_PRIVATE_KEY?.trim();

    if (!siteCode || !privateKey) {
      return res.status(500).json({ error: "OZOW_CONFIG_MISSING" });
    }

    const timestamp = Math.floor(Date.now() / 1000).toString().slice(-6);
    const bankReference = `YZ${String(userId)}X${timestamp}`.substring(0, 20);

    const baseUrl = "https://youscan.addvision.co.za";
    const notifyBase =
      "https://youscan-statement-csv-ui-backend-production.up.railway.app";

    const payload = {
      SiteCode: siteCode,
      CountryCode: "ZA",
      CurrencyCode: "ZAR",
      Amount: Number(amount).toFixed(2),
      TransactionReference: bankReference,
      BankReference: bankReference,

      Optional1: "",
      Optional2: "",
      Optional3: "",
      Optional4: "",
      Optional5: "",
      Customer: "",

      CancelUrl: `${baseUrl}/payment-cancelled`.trim(),
      ErrorUrl: `${baseUrl}/payment-error`.trim(),
      SuccessUrl: `${baseUrl}/payment-return`.trim(),
      NotifyUrl: `${notifyBase}/ozow`.trim(),

      IsTest: false,
    };

    const hashString = (
      payload.SiteCode +
      payload.CountryCode +
      payload.CurrencyCode +
      payload.Amount +
      payload.TransactionReference +
      payload.BankReference +
      payload.Optional1 +
      payload.Optional2 +
      payload.Optional3 +
      payload.Optional4 +
      payload.Optional5 +
      payload.Customer +
      payload.CancelUrl +
      payload.ErrorUrl +
      payload.SuccessUrl +
      payload.NotifyUrl +
      String(payload.IsTest) +
      privateKey
    ).toLowerCase();

    const hash = crypto.createHash("sha512").update(hashString).digest("hex");

    console.log("=== OZOW CREATE PAYMENT DEBUG ===");
    console.log("bankReference:", bankReference);
    console.log("IsTest:", payload.IsTest);
    console.log("hashString:", hashString);
    console.log("hash:", hash);

    res.status(200).json({
      ...payload,
      HashCheck: hash, // verify frontend form field name against current Ozow expectation
    });
  } catch (error) {
    console.error("❌ Ozow Error:", error);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
  }
});

export default router;