import express from 'express';
import multer from 'multer';
import { parseStatement } from '../services/parseStatement.js';

export const router = express.Router();

// This handles the file in memory
const upload = multer({ storage: multer.memoryStorage() });

/**
 * This is the missing piece! 
 * Because app.js already uses "/parse", this "/" actually means "/parse"
 */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log("File received in route, passing to service...");

    // Call the service we just updated
    const transactions = await parseStatement(req.file.buffer);
    
    // Return the data to the frontend
    res.status(200).json(transactions);
  } catch (error) {
    console.error('Route Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});