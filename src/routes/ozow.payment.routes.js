console.log("🔥🔥🔥 OZOW WEBHOOK: UNIVERSAL SYNC ACTIVE 🔥🔥🔥");

import express from "express";
import crypto from "crypto";
import pool from "../config/db.js";

const router = express.Router();

router.use(
  express.urlencoded({
    extended: true,
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);

function buildOzowNotifyHash(payload, privateKey) {
  const hashKeys = [
    "SiteCode",
    "TransactionId",
    "TransactionReference",
    "Amount",
    "Status",
    "CurrencyCode",
    "IsTest",
    "StatusMessage"
  ];

  let hashString = "";
  hashKeys.forEach(key => {
    const value = payload[key];
    if (value !== undefined && value !== null) {
      hashString += value;
    }
  });

  hashString += privateKey;
  return crypto
    .createHash("sha512")
    .update(hashString.toLowerCase(), "utf-8")
    .digest("hex")
    .toLowerCase();
}

router.post("/", async (req, res) => {
  const client = await pool.connect();

  try {
    console.log("=== OZOW NOTIFY RECEIVED ===");
    const payload = req.body;
    const { Status, TransactionReference, Hash, Amount, TransactionId, CurrencyCode } = payload;

    const generatedHash = buildOzowNotifyHash(payload, process.env.OZOW_PRIVATE_KEY);
    if (generatedHash !== String(Hash).trim().toLowerCase()) {
      console.error("❌ Hash mismatch!");
      return res.status(400).send("Invalid Signature");
    }

    console.log("✅ Hash verified successfully");

    if (Status !== "Complete") {
      console.log(`⏳ Ignoring status: ${Status}`);
      return res.status(200).send("OK");
    }

    const parts = TransactionReference.split("_");
    const userId = parts[0];
    const planCode = parts[1];

    // Idempotency check using your actual column name: external_reference
    const duplicate = await client.query(
      "SELECT id FROM payments WHERE external_reference = $1",
      [TransactionReference]
    );

    if (duplicate.rowCount > 0) {
      console.log("ℹ️ Transaction already processed.");
      return res.status(200).send("OK");
    }

    await client.query("BEGIN");

    let creditsToAdd = 0;
    if (planCode === "PAYG_10") creditsToAdd = 10;
    else if (planCode === "MONTHLY_25") creditsToAdd = 25;
    else if (planCode === "PRO_YEAR_UNLIMITED") creditsToAdd = 999999;

    // Update User
    await client.query(
      `UPDATE users 
       SET credits_remaining = COALESCE(credits_remaining, 0) + $1,
           subscription_status = 'active',
           plan_code = $2
       WHERE id = $3`,
      [creditsToAdd, planCode, userId]
    );

    // Record Payment matching your Railway schema:
    // Columns: user_id, amount, currency, plan, credits_purchased, external_reference
    await client.query(
      `INSERT INTO payments (user_id, amount, currency, plan, credits_purchased, external_reference)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, Amount, CurrencyCode, planCode, creditsToAdd, TransactionReference]
    );

    await client.query("COMMIT");
    console.log(`💰 SUCCESS: Applied ${creditsToAdd} credits to User ${userId}`);

    return res.status(200).send("OK");

  } catch (err) {
    if (client) await client.query("ROLLBACK");
    console.error("🔥 Webhook Crash:", err);
    return res.status(500).send("Server Error");
  } finally {
    client.release();
  }
});

export default router;