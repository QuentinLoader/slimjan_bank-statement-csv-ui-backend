console.log("🔥🔥🔥 OZOW WEBHOOK FILE LOADED 🔥🔥🔥");
import express from "express";
import crypto from "crypto";

const router = express.Router();

router.post(
  "/",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      console.log("=== OZOW WEBHOOK RECEIVED ===");

      const payload = JSON.parse(req.body.toString());
      console.log(payload);

      const {
        SiteCode,
        TransactionId,
        TransactionReference,
        Amount,
        Status,
        HashCheck
      } = payload;

      if (SiteCode !== process.env.OZOW_SITE_CODE) {
        return res.status(400).send("Invalid site");
      }

      const stringToHash =
        SiteCode +
        TransactionId +
        TransactionReference +
        Amount +
        Status +
        process.env.OZOW_PRIVATE_KEY;

      const generatedHash = crypto
        .createHash("sha512")
        .update(stringToHash)
        .digest("hex");

      if (generatedHash !== HashCheck) {
        return res.status(400).send("Invalid signature");
      }

      if (Status !== "Complete") {
        return res.status(200).send("Ignored");
      }

      return res.status(200).send("Webhook received safely");

    } catch (err) {
      console.error("Ozow Webhook Error:", err);
      return res.status(500).send("Server error");
    }
  }
);

export default router;