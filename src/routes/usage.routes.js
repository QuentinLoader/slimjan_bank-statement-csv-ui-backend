import express from "express";

const router = express.Router();

// Temporary placeholder
router.get("/", (req, res) => {
  res.json({ message: "Usage route active" });
});

export default router;