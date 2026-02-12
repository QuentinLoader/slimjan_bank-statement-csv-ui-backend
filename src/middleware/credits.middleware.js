import pool from "../config/db.js";

export const checkPlanAccess = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT id, email, plan, credits_remaining, 
              subscription_expires_at, is_verified
       FROM users
       WHERE id = $1`,
      [userId]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 🔐 Email verification enforcement
    if (!user.is_verified) {
      return res.status(403).json({ message: "Email not verified" });
    }

    // Defensive: Ensure plan is defined
    if (!user.plan) {
      return res.status(403).json({ message: "Invalid account configuration" });
    }

    req.userRecord = user;

    /* ============================
       PRO PLAN → Unlimited Access
    ============================= */
    if (user.plan === "pro") {

      if (
        user.subscription_expires_at &&
        new Date(user.subscription_expires_at) > new Date()
      ) {
        return next();
      }

      return res.status(403).json({ message: "Subscription expired" });
    }

    /* ============================
       FREE or PAY-AS-YOU-GO
    ============================= */

    if (user.plan === "free" || user.plan === "pay-as-you-go") {

      if (
        typeof user.credits_remaining !== "number" ||
        user.credits_remaining <= 0
      ) {
        return res.status(403).json({ message: "No credits remaining" });
      }

      return next();
    }

    // Unknown plan type
    return res.status(403).json({ message: "Invalid plan type" });

  } catch (err) {
    console.error("PLAN CHECK ERROR");
    return res.status(500).json({ message: "Plan check failed" });
  }
};
