import express from "express";
import { authenticateUser } from "../middleware/auth.middleware.js";
import { PRICING } from "../config/pricing.js";
import crypto from "crypto";

const router = express.Router();

// ✅ FIXED: Strict Ozow payment request hash with per-field lowercasing
function generateOzowRequestHash(data, privateKey) {
  const parts = [
    data.SiteCode,
    data.CountryCode,
    data.CurrencyCode,
    data.Amount,
    data.TransactionReference,
    data.BankReference,
    data.CancelURL,
    data.ErrorURL,
    data.SuccessURL,
    data.NotifyURL,
    data.IsTest,
    privateKey
  ];

  // Map every part to a string and LOWERCASE IT INDIVIDUALLY before joining
  const hashString = parts
    .map(v => (v === undefined || v === null ? "" : String(v).toLowerCase()))
    .join("");

  console.log("CLEANED REQUEST HASH STRING:", JSON.stringify(hashString));

  return crypto
    .createHash("sha512")
    .update(hashString, "utf-8")
    .digest("hex")
    .toLowerCase();
}

router.post(
  "/create-ozow-payment",
  authenticateUser,
  async (req, res) => {
    try {
      const { planCode } = req.body;

      if (!planCode) {
        return res.status(400).json({ error: "Plan code required" });
      }

      const plan = PRICING.PLANS[planCode];
      if (!plan) {
        return res.status(400).json({ error: "Invalid plan" });
      }

      const user = req.user;
      if (!user || !user.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const siteCode = process.env.OZOW_SITE_CODE;
      const privateKey = process.env.OZOW_PRIVATE_KEY;

      if (!siteCode || !privateKey) {
        return res.status(500).json({ error: "Payment configuration error" });
      }

      const amount = (plan.price_cents / 100).toFixed(2);
      const transactionReference = `${user.userId}_${planCode}_${Date.now()}`;
      const bankReference = `YS-${Date.now().toString().slice(-10)}`;

      const payload = {
        SiteCode: String(siteCode).trim(),
        CountryCode: "ZA",
        CurrencyCode: String(PRICING.currency).trim(),
        Amount: String(amount).trim(),
        TransactionReference: String(transactionReference).trim(),
        BankReference: String(bankReference).trim(),
        CancelURL: "https://youscan.addvision.co.za/payment-cancelled",
        ErrorURL: "https://youscan.addvision.co.za/payment-error",
        SuccessURL: "https://youscan.addvision.co.za/payment-return",
        NotifyURL: "https://youscan-statement-csv-ui-backend-production.up.railway.app/ozow/webhook",
        IsTest: "true", 
      };

      const hashCheck = generateOzowRequestHash(payload, privateKey);

      const paymentForm = `
        <html>
          <body onload="document.forms[0].submit()">
            <form method="post" action="https://pay.ozow.com">
              <input type="hidden" name="SiteCode" value="${payload.SiteCode}" />
              <input type="hidden" name="CountryCode" value="${payload.CountryCode}" />
              <input type="hidden" name="CurrencyCode" value="${payload.CurrencyCode}" />
              <input type="hidden" name="Amount" value="${payload.Amount}" />
              <input type="hidden" name="TransactionReference" value="${payload.TransactionReference}" />
              <input type="hidden" name="BankReference" value="${payload.BankReference}" />
              <input type="hidden" name="CancelURL" value="${payload.CancelURL}" />
              <input type="hidden" name="ErrorURL" value="${payload.ErrorURL}" />
              <input type="hidden" name="SuccessURL" value="${payload.SuccessURL}" />
              <input type="hidden" name="NotifyURL" value="${payload.NotifyURL}" />
              <input type="hidden" name="IsTest" value="${payload.IsTest}" />
              <input type="hidden" name="HashCheck" value="${hashCheck}" />
            </form>
          </body>
        </html>
      `;

      return res.send(paymentForm);

    } catch (err) {
      console.error("CREATE OZOW PAYMENT ERROR:", err);
      return res.status(500).json({ error: "Failed to create payment" });
    }
  }
);

export default router;