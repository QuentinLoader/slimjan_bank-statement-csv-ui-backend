import pool from "../config/db.js";

export const checkPlanAccess = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT id,
              plan_code,
              credits_remaining,
              lifetime_parses_used,
              subscription_status,
              renewal_date,
              billing_cycle_end,
              is_verified
       FROM users
       WHERE id = $1`,
      [userId]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({
        code: "USER_NOT_FOUND",
        message: "User not found"
      });
    }

    if (!user.is_verified) {
      return res.status(403).json({
        code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email before using YouScan."
      });
    }

    const now = new Date();

    /* =============================
       PRO YEAR UNLIMITED
    ============================= */
    if (user.plan_code === "PRO_YEAR_UNLIMITED") {
      if (
        user.subscription_status === "active" &&
        user.renewal_date &&
        new Date(user.renewal_date) > now
      ) {
        req.userRecord = user;
        return next();
      }

      return res.status(403).json({
        code: "SUBSCRIPTION_EXPIRED",
        message: "Your Pro subscription has expired."
      });
    }

    /* =============================
       MONTHLY_25
    ============================= */
    if (user.plan_code === "MONTHLY_25") {
      if (user.credits_remaining > 0) {
        req.userRecord = user;
        return next();
      }

      return res.status(403).json({
        code: "CREDITS_EXHAUSTED",
        message: "Monthly credits exhausted."
      });
    }

    /* =============================
       PAYG_10
    ============================= */
    if (user.plan_code === "PAYG_10") {
      if (user.credits_remaining > 0) {
        req.userRecord = user;
        return next();
      }

      return res.status(403).json({
        code: "NO_CREDITS",
        message: "No credits remaining."
      });
    }

    /* =============================
       FREE
    ============================= */
    if (user.plan_code === "FREE") {
      if (user.lifetime_parses_used < 15) {
        req.userRecord = user;
        return next();
      }

      return res.status(403).json({
        code: "FREE_LIMIT_REACHED",
        message: "Free lifetime limit reached."
      });
    }

    return res.status(403).json({
      code: "INVALID_PLAN",
      message: "Invalid plan configuration."
    });

  } catch (err) {
    console.error("PLAN CHECK ERROR:", err);
    return res.status(500).json({
      code: "PLAN_CHECK_FAILED",
      message: "Plan validation failed."
    });
  }
};