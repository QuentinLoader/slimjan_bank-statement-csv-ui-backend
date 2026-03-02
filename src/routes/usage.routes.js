import express from "express";
import { recordExport } from "../controllers/usage.controller.js";
import { authenticateUser } from "../middleware/auth.middleware.js";


const router = express.Router();

router.post(
  "/record-export",
  authenticateUser,
  billingMiddleware,
  recordExport
);

export default router;