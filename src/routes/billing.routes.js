import express from "express";
import pool from "../config/db.js";
import { authenticateUser } from "../middleware/auth.middleware.js";

const router = express.Router();

/**
 * GET /billing/status
 * Returns current user's billing status
 */
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
      return res.status(404).json({
        code: "USER_NOT_FOUND"
      });
    }

    const now = new Date();

    let lifetimeRemaining = null;
    let creditsRemaining = null;
    let subscriptionActive = true;

    /* =============================
       FREE
    ============================= */
    if (user.plan_code === "FREE") {
      lifetimeRemaining = Math.max(0, 15 - user.lifetime_parses_used);
    }

    /* =============================
       PAYG_10
    ============================= */
    if (user.plan_code === "PAYG_10") {
      creditsRemaining = user.credits_remaining;
    }

    /* =============================
       MONTHLY_25
    ============================= */
    if (user.plan_code === "MONTHLY_25") {
      creditsRemaining = user.credits_remaining;

      if (
        user.billing_cycle_end &&
        new Date(user.billing_cycle_end) < now
      ) {
        subscriptionActive = false;
      }
    }

    /* =============================
       PRO_YEAR_UNLIMITED
    ============================= */
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
    return res.status(500).json({
      code: "BILLING_STATUS_FAILED"
    });
  }
});

export default router;