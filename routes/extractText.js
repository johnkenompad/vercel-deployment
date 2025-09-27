import express from 'express';
import multer from 'multer';
import axios from 'axios';

const router = express.Router();
const upload = multer(); // Use in-memory storage

router.post('/', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  const ext = file.originalname.split('.').pop().toLowerCase();
  if (!['jpg', 'jpeg', 'png'].includes(ext)) {
    return res.status(400).json({ error: 'Only .jpg, .jpeg, or .png images are supported for OCR' });
  }

  try {
    // ✅ Corrected: Only use endpoint once (no double path)
    const endpoint = `${process.env.AZURE_OCR_ENDPOINT}/formrecognizer/documentModels/prebuilt-read:analyze?api-version=2023-07-31`;
    const key = process.env.AZURE_OCR_KEY;

    // ✅ Step 1: Send image buffer to Azure
    const response = await axios.post(endpoint, file.buffer, {
      headers: {
        'Content-Type': file.mimetype,
        'Ocp-Apim-Subscription-Key': key
      },
      maxBodyLength: Infinity
    });

    const operationLocation = response.headers['operation-location'];
    if (!operationLocation) {
      return res.status(500).json({ error: 'Azure did not return operation-location' });
    }

    // ✅ Step 2: Poll the result until it's ready
    let result;
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // wait 1s
      const poll = await axios.get(operationLocation, {
        headers: {
          'Ocp-Apim-Subscription-Key': key
        }
      });

      if (poll.data.status === 'succeeded') {
        result = poll.data;
        break;
      } else if (poll.data.status === 'failed') {
        return res.status(500).json({ error: 'Azure OCR failed' });
      }
    }

    if (!result) {
      return res.status(504).json({ error: 'Timed out waiting for Azure OCR result' });
    }

    // ✅ Step 3: Extract and return the text
    const lines = [];
    for (const page of result.analyzeResult.pages) {
      for (const line of page.lines) {
        lines.push(line.content);
      }
    }

    const extractedText = lines.join('\n');
    return res.json({ text: extractedText });

  } catch (error) {
    console.error('OCR error:', error);
    res.status(500).json({
      error: 'OCR processing failed',
      details: error.response?.data || error.message
    });
  }
});

export default router;
