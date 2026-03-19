console.log("🔥🔥🔥 OZOW WEBHOOK FILE LOADED 🔥🔥🔥");

import express from "express";
import crypto from "crypto";

const router = express.Router();

// 🔥 CRITICAL FIX: Normalize amount (Ozow removes trailing zeros)
function normalizeAmount(amount) {
  return parseFloat(amount).toString();
}

// ✅ Ozow webhook hash (correct for your setup)
function generateOzowWebhookHash(data, privateKey) {
  const hashString =
    String(data.SiteCode).trim() +
    String(data.TransactionId).trim() +
    String(data.TransactionReference).trim() +
    normalizeAmount(data.Amount) + // 🔥 FIX HERE
    String(data.Status).trim() +
    String(privateKey).trim();

  console.log("WEBHOOK HASH STRING:", JSON.stringify(hashString));

  return crypto
    .createHash("sha512")
    .update(hashString, "utf-8")
    .digest("hex")
    .toLowerCase();
}

router.post(
  "/",
  express.urlencoded({ extended: true }),
  async (req, res) => {
    try {
      console.log("=== OZOW WEBHOOK RECEIVED ===");

      const payload = req.body;
      console.log("WEBHOOK DATA:", payload);

      const {
        SiteCode,
        TransactionId,
        TransactionReference,
        Amount,
        Status,
        Hash
      } = payload;

      // =========================
      // ✅ 1. VALIDATE SITE
      // =========================
      if (SiteCode !== process.env.OZOW_SITE_CODE) {
        console.error("❌ Invalid SiteCode");
        return res.status(400).send("Invalid site");
      }

      if (!Hash) {
        console.error("❌ Missing Hash");
        return res.status(400).send("Missing hash");
      }

      // =========================
      // ✅ 2. VERIFY HASH
      // =========================
      const generatedHash = generateOzowWebhookHash(
        payload,
        process.env.OZOW_PRIVATE_KEY
      );

      const ozowHash = String(Hash).trim().toLowerCase();

      console.log("GENERATED HASH:", generatedHash);
      console.log("OZOW HASH:", ozowHash);

      if (generatedHash !== ozowHash) {
        console.error("❌ Hash mismatch");
        return res.status(400).send("Invalid signature");
      }

      console.log("✅ Hash verified");

      // =========================
      // ✅ 3. ONLY PROCESS SUCCESS
      // =========================
      if (Status !== "Complete") {
        console.log("⏳ Ignoring status:", Status);
        return res.status(200).send("Ignored");
      }

      console.log("💰 Payment successful:", TransactionReference);

      // =========================
      // 🚀 4. BILLING PLACEHOLDER
      // =========================
      // TODO:
      // await applyBilling(TransactionReference, Amount);

      return res.status(200).send("OK");

    } catch (err) {
      console.error("🔥 Ozow Webhook Error:", err);
      return res.status(500).send("Server error");
    }
  }
);

export default router;