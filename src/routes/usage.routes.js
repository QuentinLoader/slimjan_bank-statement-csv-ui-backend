import express from 'express';
import { recordExport } from '../controllers/usage.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/record-export', authenticate, recordExport);

export default router;
