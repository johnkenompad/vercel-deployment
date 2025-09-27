// routes/wordsearchRoutes.js
import express from 'express';
import multer from 'multer';
import { OpenAI } from 'openai';
import path from 'path';
import fs from 'fs';
import mammoth from 'mammoth';

const router = express.Router();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 🔵 Placeholder for Azure OCR logic
async function runAzureOCR(filePath) {
  // TODO: Replace with actual Azure Read OCR logic
  return '[Extracted text from image using Azure OCR]';
}

// 🔵 DOCX to raw text
async function extractTextFromDocx(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

// 🔧 Prompt Builder
function buildWordSearchPrompt(title, textContent) {
  return `
You are an AI assistant generating a Word Search quiz for students.

From the following educational content, extract **15 important terms** and generate an **identification-style clue** for each.

Respond ONLY in JSON with this format:

{
  "title": "${title}",
  "questions": [
    {
      "question": "Who is the ___?",
      "answer": "Keyword"
    },
    ...
  ]
}

Text:
"""${textContent}"""
`;
}

// 🔄 Route: POST /api/wordsearch/generate
router.post('/wordsearch/generate', upload.single('file'), async (req, res) => {
  try {
    const { title } = req.body;
    let rawText = '';

    // 1️⃣ Add typed text
    if (req.body.words && req.body.words.trim()) {
      rawText += req.body.words.trim();
    }

    // 2️⃣ Handle uploaded file
    if (req.file) {
      const fileType = req.file.mimetype;

      if (fileType.includes('image')) {
        const ocrText = await runAzureOCR(req.file.path);
        rawText += '\n' + ocrText;
      } else if (fileType.includes('wordprocessingml')) {
        const docxText = await extractTextFromDocx(req.file.path);
        rawText += '\n' + docxText;
      }

      fs.unlinkSync(req.file.path); // cleanup
    }

    // 3️⃣ Validate input
    if (!rawText) {
      return res.status(400).json({ error: 'No input provided (text or file).' });
    }

    // 4️⃣ Generate Word Search data
    const prompt = buildWordSearchPrompt(title || 'Word Search Quiz', rawText);

    const aiResp = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
    });

    let resultJson;
    try {
      const cleaned = aiResp.choices[0].message.content
        .trim()
        .replace(/```(json)?|```/g, '');
      resultJson = JSON.parse(cleaned);
    } catch (err) {
      console.error('OpenAI parse error:', err);
      return res.status(500).json({ error: 'Failed to parse GPT response.' });
    }

    // 5️⃣ Return response
    return res.json({
      title: resultJson.title || title || 'Word Search Quiz',
      questions: resultJson.questions || [],
    });
  } catch (err) {
    console.error('WordSearch Generation Error:', err);
    return res.status(500).json({
      error: 'Something went wrong during generation.',
    });
  }
});

// ✅ Export as default (ESM required)
export default router;
