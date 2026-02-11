import pool from "../config/db.js";

export default async function (req, res, next) {
  const userId = req.user.userId;

  const { rows } = await pool.query(
    "SELECT * FROM users WHERE id = $1",
    [userId]
  );

  const user = rows[0];

  if (!user.email_verified)
    return res.status(403).json({ reason: "not_verified" });

  if (user.plan_type === "free") {
    const usage = await pool.query(
      "SELECT COUNT(*) FROM usage_logs WHERE user_id = $1",
      [userId]
    );

    if (parseInt(usage.rows[0].count) >= 15)
      return res.status(403).json({ reason: "limit_reached" });
  }

  if (user.plan_type === "payg" && user.credits_remaining <= 0)
    return res.status(403).json({ reason: "no_credits" });

  if (
    user.plan_type === "basic" &&
    user.current_period_end &&
    new Date(user.current_period_end) < new Date()
  )
    return res.status(403).json({ reason: "subscription_expired" });

  req.billingUser = user;
  next();
}
