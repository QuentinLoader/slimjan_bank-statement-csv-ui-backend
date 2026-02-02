import express from 'express';
import multer from 'multer';
import { parseStatement } from '../services/parseStatement.js';

export const router = express.Router();

// Memory storage keeps the PDF out of the file system (safer for Railway)
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Call our service logic
    const result = await parseStatement(req.file.buffer);
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Parse Route Error:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Internal Server Error',
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
});