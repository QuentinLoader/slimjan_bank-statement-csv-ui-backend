import express from "express";
import { authenticateUser } from "../middleware/auth.middleware.js";
import { PRICING } from "../config/pricing.js";
import { generateOzowHash } from "../utils/ozowHash.js";

const router = express.Router();

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

      // ✅ Amount MUST be string with 2 decimals
      const amount = (plan.price_cents / 100).toFixed(2);

      const transactionReference = `${user.userId}_${planCode}_${Date.now()}`;

      // ✅ FIXED: always < 20 chars
      const bankReference = `YS-${Date.now().toString().slice(-10)}`;
      console.log("BankReference:", bankReference, "Length:", bankReference.length);

      const successUrl = "https://youscan.addvision.co.za/payment-return";
      const cancelUrl = "https://youscan.addvision.co.za/payment-cancelled";
      const errorUrl = "https://youscan.addvision.co.za/payment-error";
      const notifyUrl =
        "https://youscan-statement-csv-ui-backend-production.up.railway.app/ozow/webhook";

      const siteCode = process.env.OZOW_SITE_CODE;
      const privateKey = process.env.OZOW_PRIVATE_KEY;

      // 🔴 MUST be string
      const isTest = "true";

      if (!siteCode || !privateKey) {
        return res.status(500).json({ error: "Payment configuration error" });
      }

      // ✅ FORCE ALL VALUES TO STRING (critical for Ozow hash consistency)
      const payload = {
        SiteCode: String(siteCode).trim(),
        CountryCode: "ZA",
        CurrencyCode: String(PRICING.currency).trim(),
        Amount: String(amount).trim(),
        TransactionReference: String(transactionReference).trim(),
        BankReference: String(bankReference).trim(),
        CancelURL: String(cancelUrl).trim(),
        ErrorURL: String(errorUrl).trim(),
        SuccessURL: String(successUrl).trim(),
        NotifyURL: String(notifyUrl).trim(),
        IsTest: String(isTest).trim(),
      };

      // 🔍 DEBUG — EXACT values used
      console.log("FORM VALUES:");
      console.log(JSON.stringify(payload, null, 2));

      // ✅ Generate hash using SAME payload
      const hashCheck = generateOzowHash(payload, privateKey);

      console.log("OZOW HASH:", hashCheck);

      // ✅ Build auto-submit form using SAME payload
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

      res.send(paymentForm);
    } catch (err) {
      console.error("CREATE OZOW PAYMENT ERROR:", err);
      res.status(500).json({ error: "Failed to create payment" });
    }
  }
);

export default router;