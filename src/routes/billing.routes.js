import express from "express";
import pool from "../config/db.js";
import { authenticateUser } from "../middleware/auth.middleware.js";

const router = express.Router();

/* ============================
   GET BILLING STATUS
============================ */
router.get("/status", authenticateUser, async (req, res) => {
  try {
    const userId = req.user.userId;

    const { rows } = await pool.query(
      `SELECT 
          plan_code,
          credits_remaining,
          lifetime_parses_used,
          subscription_status,
          renewal_date,
          billing_cycle_end
       FROM users
       WHERE id = $1`,
      [userId]
    );

    const user = rows[0];

    if (!user) {
      return res.status(404).json({ code: "USER_NOT_FOUND" });
    }

    const now = new Date();

    let lifetimeRemaining = null;
    let creditsRemaining = null;
    let subscriptionActive = true;

    if (user.plan_code === "FREE") {
      lifetimeRemaining = Math.max(0, 15 - user.lifetime_parses_used);
    }

    if (user.plan_code === "PAYG_10") {
      creditsRemaining = user.credits_remaining;
    }

    if (user.plan_code === "MONTHLY_25") {
      creditsRemaining = user.credits_remaining;

      if (
        user.billing_cycle_end &&
        new Date(user.billing_cycle_end) < now
      ) {
        subscriptionActive = false;
      }
    }

    if (user.plan_code === "PRO_YEAR_UNLIMITED") {
      if (
        !user.renewal_date ||
        new Date(user.renewal_date) < now ||
        user.subscription_status !== "active"
      ) {
        subscriptionActive = false;
      }
    }

    return res.json({
      plan_code: user.plan_code,
      credits_remaining: creditsRemaining,
      lifetime_remaining: lifetimeRemaining,
      subscription_status: subscriptionActive ? "active" : "expired",
      renewal_date: user.renewal_date,
      billing_cycle_end: user.billing_cycle_end
    });

  } catch (err) {
    console.error("Billing status error:", err);
    return res.status(500).json({ code: "BILLING_STATUS_FAILED" });
  }
});

/* ============================
   OZOW WEBHOOK (IDEMPOTENT)
============================ */
router.post("/webhook", async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      TransactionReference,
      Status,
      Amount,
      CustomField1 // assume this is userId
    } = req.body;

    if (!TransactionReference || !CustomField1) {
      return res.status(400).send("Invalid webhook");
    }

    // Only process successful payments
    if (Status !== "Complete") {
      return res.status(200).send("Ignored");
    }

    await client.query("BEGIN");

    // Idempotency check
    const existing = await client.query(
      `SELECT id FROM payments WHERE reference = $1`,
      [TransactionReference]
    );

    if (existing.rowCount > 0) {
      await client.query("ROLLBACK");
      return res.status(200).send("Already processed");
    }

    const userId = CustomField1;

    // Example: Activate PAYG_10
    await client.query(
      `
      UPDATE users
      SET plan_code = 'PAYG_10',
          credits_remaining = 10
      WHERE id = $1
      `,
      [userId]
    );

    await client.query(
      `
      INSERT INTO payments
      (user_id, reference, plan_code, amount, status)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [userId, TransactionReference, "PAYG_10", Amount, "Complete"]
    );

    await client.query("COMMIT");

    return res.status(200).send("OK");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("WEBHOOK ERROR:", err);
    return res.status(500).send("Webhook failed");
  } finally {
    client.release();
  }
});

export default router;