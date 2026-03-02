import pool from "../config/db.js";

export default async function billingMiddleware(req, res, next) {
  try {
    const userId = req.user.userId;

    const { rows } = await pool.query(
      `SELECT 
         id,
         plan_code,
         is_verified,
         subscription_status,
         renewal_date,
         billing_cycle_end
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "USER_NOT_FOUND" });
    }

    const user = rows[0];

    if (!user.is_verified) {
      return res.status(403).json({ error: "EMAIL_NOT_VERIFIED" });
    }

    const now = new Date();

    /* =============================
       PRO YEAR UNLIMITED
    ============================= */
    if (user.plan_code === "PRO_YEAR_UNLIMITED") {
      if (
        user.subscription_status !== "active" ||
        !user.renewal_date ||
        new Date(user.renewal_date) < now
      ) {
        return res.status(402).json({
          error: "SUBSCRIPTION_EXPIRED",
          upgrade_options: ["MONTHLY_25"]
        });
      }

      req.billingUser = user;
      return next();
    }

    /* =============================
       MONTHLY 25
       (Only validate cycle — no credit deduction here)
    ============================= */
    if (user.plan_code === "MONTHLY_25") {
      if (!user.billing_cycle_end || new Date(user.billing_cycle_end) < now) {
        return res.status(402).json({
          error: "SUBSCRIPTION_EXPIRED",
          upgrade_options: ["PRO_YEAR_UNLIMITED"]
        });
      }

      req.billingUser = user;
      return next();
    }

    /* =============================
       FREE + PAYG_10
       (Credit enforcement happens in deductUserCredit())
    ============================= */
    if (user.plan_code === "FREE" || user.plan_code === "PAYG_10") {
      req.billingUser = user;
      return next();
    }

    return res.status(400).json({ error: "INVALID_PLAN" });

  } catch (err) {
    console.error("Billing middleware error:", err);
    return res.status(500).json({ error: "BILLING_CHECK_FAILED" });
  }
}