import express from "express";
import crypto from "crypto";
// import pool from "../config/db.js"; // later when updating DB

const router = express.Router();

function normalizeAmount(amount) {
  return parseFloat(amount).toFixed(2);
}

function generateOzowWebhookHash(data, privateKey) {
  const parts = [
    data.SiteCode,
    data.TransactionId,
    data.TransactionReference,
    normalizeAmount(data.Amount),
    data.Status,
    data.Optional1 ?? "",
    data.Optional2 ?? "",
    data.Optional3 ?? "",
    data.Optional4 ?? "",
    data.Optional5 ?? "",
    data.CurrencyCode,
    data.IsTest,
    privateKey
  ];

  const rawString = parts
    .map(v => (v === undefined || v === null ? "" : String(v)))
    .join("");

  const hashString = rawString.toLowerCase();

  console.log("WEBHOOK RAW STRING:", JSON.stringify(rawString));
  console.log("WEBHOOK HASH STRING:", JSON.stringify(hashString));

  return crypto
    .createHash("sha512")
    .update(hashString, "utf-8")
    .digest("hex")
    .toLowerCase();
}

router.post(
  "/webhook",
  express.urlencoded({ extended: true }),
  async (req, res) => {
    try {
      console.log("=== OZOW WEBHOOK RECEIVED ===");
      console.log("BODY:", req.body);

      const payload = req.body;
      const privateKey = process.env.OZOW_PRIVATE_KEY;

      if (!privateKey) {
        console.error("Missing OZOW_PRIVATE_KEY");
        return res.status(500).send("CONFIG_ERROR");
      }

      const expectedHash = generateOzowWebhookHash(payload, privateKey);
      const receivedHash = String(payload.Hash || "").toLowerCase();

      console.log("EXPECTED HASH:", expectedHash);
      console.log("RECEIVED HASH:", receivedHash);

      if (expectedHash !== receivedHash) {
        console.error("Invalid webhook hash");
        return res.status(400).send("INVALID_HASH");
      }

      if (payload.Status !== "Complete") {
        console.log("Webhook received but payment not complete:", payload.Status);
        return res.status(200).send("IGNORED");
      }

      // TODO:
      // 1. parse payload.TransactionReference
      // 2. find user/order
      // 3. apply credits/plan
      // 4. log usage/billing record
      // 5. make idempotent

      return res.status(200).send("OK");
    } catch (err) {
      console.error("OZOW WEBHOOK ERROR:", err);
      return res.status(500).send("ERROR");
    }
  }
);

export default router;