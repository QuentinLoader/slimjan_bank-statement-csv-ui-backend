import express from 'express';
import multer from 'multer';
import { parseStatement } from '../services/parseStatement.js';

export const router = express.Router();

// Memory storage is best for serverless/container environments like Railway
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

/**
 * Endpoint: POST /parse
 * Note: router.post('/') is correct because the prefix /parse is set in app.js
 */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    // 1. Log arrival for debugging
    console.log(`--- New Parse Request ---`);
    
    if (!req.file) {
      console.error('Error: No file found in request body');
      return res.status(400).json({ error: 'No file uploaded. Ensure field name is "file".' });
    }

    console.log(`File Received: ${req.file.originalname} (${req.file.size} bytes)`);

    // 2. Call the parser service
    const transactions = await parseStatement(req.file.buffer);
    
    // 3. Log success
    console.log(`Successfully parsed ${transactions.length} transactions.`);
    
    // Send back the transactions
    res.status(200).json(transactions);

  } catch (error) {
    // 4. Detailed error logging for Railway console
    console.error('Parse Route Error:', error.message);
    
    res.status(error.statusCode || 500).json({
      error: error.name || 'PARSE_FAILED',
      message: error.message || 'Internal Server Error',
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
});