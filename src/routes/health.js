import express from 'express';
export const router = express.Router();

router.get('/', (req, res) => {
  res.json({ status: 'UP', timestamp: new Date().toISOString() });
});