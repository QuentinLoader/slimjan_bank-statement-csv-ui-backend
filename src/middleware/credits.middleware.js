import pool from "../config/db.js";

export const checkPlanAccess = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT id, email, plan,
              credits_remaining,
              lifetime_parses_used,
              subscription_expires_at,
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

    // =============================
    // EMAIL VERIFICATION ENFORCEMENT
    // =============================
    if (!user.is_verified) {
      return res.status(403).json({
        code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email before using YouScan."
      });
    }

    // Defensive plan validation
    if (!user.plan) {
      return res.status(403).json({
        code: "INVALID_PLAN",
        message: "Invalid account configuration."
      });
    }

    /* =============================
       PRO PLAN
    ============================= */
    if (user.plan === "pro") {

      if (
        user.subscription_expires_at &&
        new Date(user.subscription_expires_at) > new Date()
      ) {
        req.userRecord = user;
        return next();
      }

      return res.status(403).json({
        code: "SUBSCRIPTION_EXPIRED",
        message: "Your Pro subscription has expired. Please renew or purchase credits."
      });
    }

    /* =============================
       PAY-AS-YOU-GO
    ============================= */
    if (user.plan === "pay-as-you-go") {

      if (
        typeof user.credits_remaining !== "number" ||
        user.credits_remaining <= 0
      ) {
        return res.status(403).json({
          code: "NO_CREDITS",
          message: "No credits remaining. Please purchase more."
        });
      }

      req.userRecord = user;
      return next();
    }

    /* =============================
       FREE PLAN (15 LIFETIME)
    ============================= */
    if (user.plan === "free") {

      if (
        typeof user.lifetime_parses_used !== "number" ||
        user.lifetime_parses_used >= 15
      ) {
        return res.status(403).json({
          code: "FREE_LIMIT_REACHED",
          message: "Free lifetime limit reached. Please upgrade."
        });
      }

      req.userRecord = user;
      return next();
    }

    // Unknown plan type
    return res.status(403).json({
      code: "INVALID_PLAN_TYPE",
      message: "Invalid plan type."
    });

  } catch (err) {
    console.error("PLAN CHECK ERROR:", err);
    return res.status(500).json({
      code: "PLAN_CHECK_FAILED",
      message: "Plan validation failed."
    });
  }
};
