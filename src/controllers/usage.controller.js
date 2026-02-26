import pool from "../config/db.js";

export async function recordExport(req, res) {
  if (!req.user || !req.user.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = req.user.userId;
  const ip = req.ip;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      `
      SELECT 
        id,
        plan_code,
        credits_remaining,
        lifetime_parses_used
      FROM users
      WHERE id = $1
      FOR UPDATE
      `,
      [userId]
    );

    if (userResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = userResult.rows[0];

    let creditsDeducted = 0;

    /*
     * =========================================
     * FREE PLAN (15 lifetime exports)
     * =========================================
     */
    if (user.plan_code === "FREE") {
      const FREE_LIMIT = 15;

      const updateResult = await client.query(
        `
        UPDATE users
        SET lifetime_parses_used = lifetime_parses_used + 1
        WHERE id = $1
          AND lifetime_parses_used < $2
        `,
        [userId, FREE_LIMIT]
      );

      if (updateResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(402).json({
          error: "FREE_LIMIT_REACHED",
          upgrade_options: [
            "PAYG_10",
            "MONTHLY_25",
            "PRO_YEAR_UNLIMITED"
          ]
        });
      }

      creditsDeducted = 0;
    }

    /*
     * =========================================
     * PRO YEAR UNLIMITED (R485 yearly)
     * =========================================
     */
    else if (user.plan_code === "PRO_YEAR_UNLIMITED") {
      // Unlimited — no deduction
      creditsDeducted = 0;
    }

    /*
     * =========================================
     * MONTHLY_25 OR PAYG_10
     * =========================================
     */
    else if (
      user.plan_code === "MONTHLY_25" ||
      user.plan_code === "PAYG_10"
    ) {
      const updateResult = await client.query(
        `
        UPDATE users
        SET credits_remaining = credits_remaining - 1
        WHERE id = $1
          AND credits_remaining > 0
        `,
        [userId]
      );

      if (updateResult.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(402).json({
          error: "CREDITS_EXHAUSTED",
          upgrade_options:
            user.plan_code === "PAYG_10"
              ? ["MONTHLY_25", "PRO_YEAR_UNLIMITED"]
              : ["PRO_YEAR_UNLIMITED"]
        });
      }

      creditsDeducted = 1;
    }

    /*
     * =========================================
     * INVALID PLAN
     * =========================================
     */
    else {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "INVALID_PLAN"
      });
    }

    /*
     * =========================================
     * USAGE LOG
     * =========================================
     */
    await client.query(
      `
      INSERT INTO usage_logs
        (user_id, action, ip_address, plan_code, credits_deducted)
      VALUES
        ($1, $2, $3, $4, $5)
      `,
      [
        userId,
        "export_csv",
        ip,
        user.plan_code,
        creditsDeducted
      ]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      credits_deducted: creditsDeducted
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("recordExport error:", err);
    return res.status(500).json({
      error: "Export recording failed"
    });
  } finally {
    client.release();
  }
}