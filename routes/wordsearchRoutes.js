// routes/wordsearchRoutes.js
import express from "express";
import multer from "multer";
import { OpenAI } from "openai";
import path from "path";
import fs from "fs";
import mammoth from "mammoth";

const router = express.Router();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ========== Helper Utilities ========== */

// 🔵 Placeholder for Azure OCR logic
async function runAzureOCR(filePath) {
  return "[Extracted text from image using Azure OCR]";
}

// 🔵 DOCX to raw text
async function extractTextFromDocx(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

// 🔧 Prompt Builder for full quiz
function buildWordSearchPrompt(title, textContent) {
  return `
You are an AI assistant generating a Word Search quiz for students.

From the following educational content, extract **15 important terms** and generate an **identification-style clue** for each.

Respond ONLY in JSON with this format:

{
  "title": "${title}",
  "questions": [
    { "question": "Who is the ___?", "answer": "Keyword" }
  ]
}

Text:
"""${textContent}"""
`;
}

// 🔧 Prompt Builder for WORD-LIST ONLY
function buildWordListPrompt({ title, description, numWords }) {
  return `
Generate exactly ${numWords} distinct, single-word terms suitable for a classroom word-search puzzle.

• Theme title: "${title}"
• Description / context: "${description}"
• Words must be 3-15 letters, no spaces, no punctuation.
• Output ONLY valid JSON: { "words": ["TERM1","TERM2", ...] }
`;
}

/* ========== ROUTES ========== */

// ✅ WORD SEARCH GENERATE FULL (with file/text upload)
router.post("/wordsearch/generate", upload.single("file"), async (req, res) => {
  try {
    const { title } = req.body;
    let rawText = "";

    if (req.body.words?.trim()) rawText += req.body.words.trim();

    if (req.file) {
      const fileType = req.file.mimetype;
      if (fileType.includes("image")) {
        const ocrText = await runAzureOCR(req.file.path);
        rawText += "\n" + ocrText;
      } else if (fileType.includes("wordprocessingml")) {
        const docxText = await extractTextFromDocx(req.file.path);
        rawText += "\n" + docxText;
      }
      fs.unlinkSync(req.file.path);
    }

    if (!rawText) {
      return res.status(400).json({ error: "No input provided (text or file)." });
    }

    const prompt = buildWordSearchPrompt(title || "Word Search Quiz", rawText);
    const aiResp = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
    });

    let resultJson;
    try {
      const cleaned = aiResp.choices[0].message.content.trim().replace(/```(json)?|```/g, "");
      resultJson = JSON.parse(cleaned);
    } catch (err) {
      console.error("OpenAI parse error:", err);
      return res.status(500).json({ error: "Failed to parse GPT response." });
    }

    return res.json({
      title: resultJson.title || title || "Word Search Quiz",
      questions: resultJson.questions || [],
    });
  } catch (err) {
    console.error("WordSearch Generation Error:", err);
    return res.status(500).json({
      error: "Something went wrong during generation.",
    });
  }
});

// ✅ WORD LIST GENERATION (used by frontend form)
router.post("/wordsearch/generate-words", async (req, res) => {
  try {
    const { title = "Untitled", description = "", numWords = 15 } = req.body;

    console.log("🟦 Received request to generate words:", req.body);

    if (!description.trim()) {
      return res.status(400).json({ message: "Description is required." });
    }

    const prompt = buildWordListPrompt({ title, description, numWords });

    const aiResp = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    });

    let words = [];
    try {
      const cleaned = aiResp.choices[0].message.content.trim().replace(/```(json)?|```/g, "");
      const parsed = JSON.parse(cleaned);
      words = parsed.words || [];
    } catch (err) {
      console.warn("⚠️ GPT JSON parse failed. Falling back to split:");
      words = aiResp.choices[0].message.content
        .split(/[,;\n]+/)
        .map((w) => w.trim().toUpperCase())
        .filter(Boolean);
    }

    if (!Array.isArray(words) || words.length < numWords) {
      return res.status(500).json({
        message: "AI did not return enough words.",
        words,
      });
    }

    const uniqueWords = [...new Set(words)].slice(0, numWords);
    return res.json({ words: uniqueWords });
  } catch (err) {
    console.error("❌ Word list generation error:", err);
    return res.status(500).json({ message: "Server error during word generation." });
  }
});

export default router;
