import express from 'express';
import multer from 'multer';
import { parseStatement } from '../services/parseStatement.js';

export const router = express.Router();

// Use memory storage for Railway efficiency
const upload = multer({ storage: multer.memoryStorage() });

// This handles the POST request to /parse
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Call the parser service
    const result = await parseStatement(req.file.buffer);
    
    // Send back the transactions
    res.status(200).json(result);
  } catch (error) {
    console.error('Parse Route Error:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Internal Server Error',
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
});