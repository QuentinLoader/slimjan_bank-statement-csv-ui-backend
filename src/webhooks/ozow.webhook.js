console.log("🔥🔥🔥 OZOW WEBHOOK FILE LOADED 🔥🔥🔥");

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

/**
 * ✅ DEFINITIVE FIX: Notify Signature Verification
 * We concatenate the values exactly as they appear in the payload.
 */
function buildNotifyHash(payload, privateKey) {
  // Ensure we use the exact casing Ozow sends for Status and GUIDs
  // before the final global lowercase.
  const parts = [
    payload.SiteCode,
    payload.TransactionId,
    payload.TransactionReference,
    payload.Status,
    payload.Amount,
    payload.IsTest, // This is the likely culprit
    privateKey
  ];

  const hashString = parts
    .map(v => (v === undefined || v === null ? "" : String(v)))
    .join("");

  const lowerCaseHashString = hashString.toLowerCase();
  console.log("VALIDATING HASH STRING:", JSON.stringify(lowerCaseHashString));

  return crypto
    .createHash("sha512")
    .update(lowerCaseHashString, "utf-8")
    .digest("hex")
    .toLowerCase();
}

router.post("/", async (req, res) => {
  const client = await pool.connect();

  try {
    console.log("=== OZOW WEBHOOK RECEIVED ===");
    const payload = req.body;
    const { SiteCode, Status, TransactionReference, Hash, Amount } = payload;

    if (SiteCode !== process.env.OZOW_SITE_CODE) {
      return res.status(400).send("Invalid site");
    }

    const generatedHash = buildNotifyHash(payload, process.env.OZOW_PRIVATE_KEY);
    const ozowHash = String(Hash).trim().toLowerCase();

    if (generatedHash !== ozowHash) {
      console.error("❌ Hash mismatch");
      console.error("Generated:", generatedHash);
      console.error("Expected: ", ozowHash);
      // If this fails, the next step is to try omitting IsTest from the parts array.
      return res.status(400).send("Invalid signature");
    }

    console.log("✅ Hash verified");

    if (Status !== "Complete") {
      return res.status(200).send("OK");
    }

    // Database Logic
    const parts = TransactionReference.split("_");
    const userId = parts[0];
    const planCode = parts[1];

    const existingPayment = await client.query(
      "SELECT id FROM payments WHERE reference = $1",
      [TransactionReference]
    );

    if (existingPayment.rowCount > 0) {
      return res.status(200).send("OK");
    }

    await client.query("BEGIN");

    let creditsToAdd = 0;
    if (planCode === "PAYG_10") creditsToAdd = 10;
    else if (planCode === "MONTHLY_25") creditsToAdd = 25;
    else if (planCode === "PRO_YEAR_UNLIMITED") creditsToAdd = 999999; 
    
    await client.query(
      `UPDATE users 
       SET plan_code = $1, 
           credits_remaining = COALESCE(credits_remaining, 0) + $2,
           subscription_status = 'active'
       WHERE id = $3`,
      [planCode, creditsToAdd, userId]
    );

    await client.query(
      `INSERT INTO payments (user_id, reference, plan_code, amount, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, TransactionReference, planCode, Amount, "Complete"]
    );

    await client.query("COMMIT");
    console.log(`✅ Success: Credits applied to User ${userId}`);

    return res.status(200).send("OK");

  } catch (err) {
    if (client) await client.query("ROLLBACK");
    console.error("🔥 Webhook Error:", err);
    return res.status(500).send("Error");
  } finally {
    client.release();
  }
});

export default router;