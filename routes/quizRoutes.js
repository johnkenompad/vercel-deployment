// routes/quizRoutes.js  — fully ES-Module compatible & tidy
//-----------------------------------------------------------
import express from 'express';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import multer from 'multer';
import PDFDocument from 'pdfkit';
import stream from 'stream';

dotenv.config();

const router  = express.Router();
const openai  = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const upload  = multer({ storage: multer.memoryStorage() });

/* ──────────────────────────────────────────────────────────
   1.  Health-check / quick tests
────────────────────────────────────────────────────────── */
router.get('/test', (_req, res) => {
  res.json({ message: '✅ Express Router is working properly!' });
});

router.post('/test', express.json(), (req, res) => {
  console.log('🧪 Received req.body:', req.body);
  res.send('Test successful');
});

/* ──────────────────────────────────────────────────────────
   2.  Core Quiz Generator (Bloom + optional TOS + fallback)
   🔧 FIXED: Added debugging and proper error handling
────────────────────────────────────────────────────────── */
router.post('/generate-quiz', upload.single('file'), async (req, res) => {
  // 🔍 Debug logging
  console.log('📥 /generate-quiz hit!');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('File:', req.file);

  const {
    text,
    quizType,
    mcQuestions = 0,
    tfQuestions = 0,
    difficulty = 'Easy',
    created_by,
    bloomCounts = {},
    contentAreas = [], // optional TOS array
  } = req.body;

  if (!text && !req.file) {
    console.log('❌ Missing text/file');
    return res
      .status(400)
      .json({ error: 'Please provide input text or upload a file.' });
  }

  const types             = Array.isArray(quizType) ? quizType : [quizType];
  const combinedQuestions = [];

  const bloomLabels = {
    bt1: 'Remember',
    bt2: 'Understand',
    bt3: 'Apply',
    bt4: 'Analyze',
    bt5: 'Evaluate',
    bt6: 'Create',
  };

  try {
    /* ── MODE A: Advanced Table-of-Specifications ───────── */
    if (Array.isArray(contentAreas) && contentAreas.length > 0) {
      console.log('📊 Using TOS mode');
      for (const area of contentAreas) {
        const { topic, bloom = {}, itemTypes = {} } = area;

        for (const [btKey, label] of Object.entries(bloomLabels)) {
          const perBloomCount = Number(bloom?.[btKey] || 0);
          if (perBloomCount <= 0) continue;

          for (const type of types) {
            const perTypeCnt = Number(itemTypes?.[type] || 0);
            if (perTypeCnt <= 0) continue;

            const prompt = buildAreaBloomPrompt(
              type,
              topic || text,
              perTypeCnt,
              difficulty,
              label,
            );

            const resp = await openai.chat.completions.create({
              model: 'gpt-3.5-turbo',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.7,
            });

            let raw = resp.choices[0].message.content.trim();
            raw = cleanJson(raw);

            let parsed;
            try {
              parsed = JSON.parse(raw);
            } catch {
              console.error('❌ JSON parse failed – raw:\n', raw);
              return res.status(500).json({ error: 'Invalid JSON from OpenAI.' });
            }

            parsed.forEach((q) =>
              combinedQuestions.push(
                reshapeQuestion(q, type, label, topic),
              ),
            );
          }
        }
      }
    } else {
      /* ── MODE B: Simple Bloom distribution ─────────────── */
      console.log('🎯 Using Bloom mode');
      for (const [btKey, label] of Object.entries(bloomLabels)) {
        const count = Number(bloomCounts?.[btKey] || 0);
        if (count <= 0) continue;

        for (const type of types) {
          const prompt = buildBloomPrompt(type, text, count, difficulty, label);

          const resp = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
          });

          let raw = resp.choices[0].message.content.trim();
          raw = cleanJson(raw);

          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch {
            console.error('❌ JSON parse failed – raw:\n', raw);
            return res.status(500).json({ error: 'Invalid JSON from OpenAI.' });
          }

          parsed.forEach((q) =>
            combinedQuestions.push(reshapeQuestion(q, type, label)),
          );
        }
      }
    }

    /* ── MODE C: Plain fallback for Practice-Quiz requests ─ */
    if (
      combinedQuestions.length === 0 &&
      (Number(mcQuestions) > 0 || Number(tfQuestions) > 0)
    ) {
      console.log('🔄 Using fallback mode');
      for (const type of types) {
        const count = type === 'mc' ? Number(mcQuestions) : Number(tfQuestions);
        if (count <= 0) continue;

        const prompt = buildPrompt(type, text, count, difficulty);

        const resp = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        });

        let raw = resp.choices[0].message.content.trim();
        raw = cleanJson(raw);

        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          console.error('❌ JSON parse failed – raw:\n', raw);
          return res.status(500).json({ error: 'Invalid JSON from OpenAI.' });
        }

        parsed.forEach((q) => combinedQuestions.push(reshapeQuestion(q, type)));
      }
    }

    /* ── Final slicing / shuffling ───────────────────────── */
    const totalRequested =
      Number(mcQuestions || 0) + Number(tfQuestions || 0);
    const output =
      totalRequested > 0
        ? shuffleArray(combinedQuestions).slice(0, totalRequested)
        : shuffleArray(combinedQuestions);

    console.log('✅ Quiz generated successfully:', output.length, 'questions');
    res.json({ questions: output, created_by });
  } catch (err) {
    console.error('❌ Error generating quiz:', err);
    res.status(500).json({ error: 'Quiz generation failed.', details: err.message });
  }
});

/* ──────────────────────────────────────────────────────────
   3.  Generator used by Customize-Quiz page (unchanged)
────────────────────────────────────────────────────────── */
router.post('/generate-custom-quiz', express.json(), async (req, res) => {
  console.log('📥 /generate-custom-quiz hit!');
  const { title, difficulty, mcqCount = 0, tfCount = 0, created_by } = req.body;

  if (!title || !difficulty) {
    return res
      .status(400)
      .json({ error: 'Missing quiz title or difficulty.' });
  }

  try {
    const questions = [];
    const config = [
      { type: 'mc', count: Number(mcqCount || 0) },
      { type: 'tf', count: Number(tfCount || 0) },
    ];

    for (const { type, count } of config) {
      if (count <= 0) continue;

      const prompt = buildPrompt(type, title, count, difficulty);
      const resp = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });

      let raw = resp.choices[0].message.content.trim();
      raw = cleanJson(raw);

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        console.error('❌ JSON parse failed – raw:\n', raw);
        return res.status(500).json({ error: 'Invalid JSON from OpenAI.' });
      }

      parsed.forEach((q) => questions.push(reshapeQuestion(q, type)));
    }

    const total     = Number(mcqCount || 0) + Number(tfCount || 0);
    const shuffled  = shuffleArray(questions).slice(0, total);

    res.json({ title, difficulty, questions: shuffled, created_by });
  } catch (err) {
    console.error('❌ Error in /generate-custom-quiz:', err);
    res.status(500).json({ error: 'Failed to generate custom quiz.' });
  }
});

/* ──────────────────────────────────────────────────────────
   4.  PDF Export route – used by ReportsPage Export button
────────────────────────────────────────────────────────── */
router.post('/export-pdf', express.json(), async (req, res) => {
  try {
    const { rows = [], reportTitle = 'Quiz Results Report' } = req.body;

    /* Build PDF */
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
    const bufStream = new stream.PassThrough();
    doc.pipe(bufStream);

    /* Header */
    doc.fontSize(20).fillColor('#3399FF').text(reportTitle, { align: 'left' });
    doc.moveDown();

    /* Table header */
    doc.fontSize(10).fillColor('#000000');
    const header = ['Student', 'Quiz', 'Score', 'Total', 'Percent', 'Date'];
    const colX   = [30, 180, 350, 420, 490, 560];
    header.forEach((h, i) => {
      doc.text(h, colX[i], doc.y, { continued: i < header.length - 1 });
    });
    doc.moveDown(0.5).moveTo(30, doc.y).lineTo(780, doc.y).stroke('#DDDDDD');

    /* Rows */
    rows.forEach((r) => {
      const vals = [
        r.name,
        r.quizTitle,
        String(r.score),
        String(r.total),
        `${r.percent}%`,
        new Date(r.submittedAt).toLocaleString(),
      ];
      vals.forEach((v, i) => {
        doc.text(v, colX[i], doc.y, { continued: i < vals.length - 1 });
      });
      doc.moveDown(0.2);
    });

    doc.end();

    /* Convert stream to buffer and send */
    const chunks = [];
    bufStream.on('data', (c) => chunks.push(c));
    bufStream.on('end', () => {
      const pdfBuf = Buffer.concat(chunks);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=quiz_results.pdf',
      });
      res.send(pdfBuf);
    });
  } catch (error) {
    console.error('❌ PDF export failed:', error);
    res.status(500).json({ error: 'PDF export failed.' });
  }
});

/* ──────────────────────────────────────────────────────────
   Helper functions
────────────────────────────────────────────────────────── */
function reshapeQuestion(q, type, bloomLabel = '', contentArea = '') {
  if (type === 'tf') {
    return {
      question_type: 'tf',
      question     : (q.question || '').trim(),
      options      : ['True', 'False'],
      answer       : /^true$/i.test(q.answer) ? 'True' : 'False',
      bloom_level  : bloomLabel,
      content_area : contentArea || undefined,
    };
  }

  if (type === 'mc') {
    const seen   = new Set();
    const opts   = (q.options || []).map((opt, idx) => {
      const cleaned = opt.replace(/^[A-D]\.\s*/i, '').trim();
      if (seen.has(cleaned.toLowerCase())) return null;
      seen.add(cleaned.toLowerCase());
      return `${String.fromCharCode(65 + idx)}. ${cleaned}`;
    }).filter(Boolean);

    const ans    = opts.find(
      (o) =>
        o.replace(/^[A-D]\.\s*/i, '').trim().toLowerCase() ===
        (q.answer || '')
          .replace(/^[A-D]\.\s*/i, '')
          .trim()
          .toLowerCase(),
    );

    return {
      question_type: 'mc',
      question     : (q.question || '').trim(),
      options      : opts,
      answer       : ans || (q.answer || '').trim(),
      bloom_level  : bloomLabel,
      content_area : contentArea || undefined,
    };
  }
  return {};
}

function buildPrompt(type, text, num, difficulty) {
  if (type === 'tf') {
    return `
Return only valid JSON.
Generate ${num} true/false questions on the topic "${text}" (difficulty: "${difficulty}").
JSON format:
[
  { "question": "...", "answer": "True" }
]`.trim();
  }
  return `
Return only valid JSON.
Generate ${num} multiple-choice questions on the topic "${text}" (difficulty: "${difficulty}").
Each question must have 4 options.
JSON format:
[
  {
    "question": "...",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
    "answer": "A. ..."
  }
]`.trim();
}

function buildBloomPrompt(type, text, num, difficulty, bloomLabel) {
  if (type === 'tf') {
    return `
Return only valid JSON.
Generate ${num} true/false questions on "${text}" at Bloom level "${bloomLabel}" (difficulty: "${difficulty}").
JSON format:
[
  { "question": "...", "answer": "True" }
]`.trim();
  }
  return `
Return only valid JSON.
Generate ${num} multiple-choice questions on "${text}" at Bloom level "${bloomLabel}" (difficulty: "${difficulty}").
Each question must have 4 options.
JSON format:
[
  {
    "question": "...",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
    "answer": "A. ..."
  }
]`.trim();
}

function buildAreaBloomPrompt(type, topic, num, difficulty, bloomLabel) {
  if (type === 'tf') {
    return `
Return only valid JSON.
Generate ${num} true/false questions about "${topic}" at Bloom level "${bloomLabel}" (difficulty: "${difficulty}").
JSON format:
[
  { "question": "...", "answer": "True" }
]`.trim();
  }
  return `
Return only valid JSON.
Generate ${num} multiple-choice questions about "${topic}" at Bloom level "${bloomLabel}" (difficulty: "${difficulty}").
Each question must have 4 options.
JSON format:
[
  {
    "question": "...",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
    "answer": "A. ..."
  }
]`.trim();
}

function cleanJson(raw) {
  return raw
    .replace(/```(json)?/gi, '')
    .replace(/```/g, '')
    .replace(/^\s*\n+/g, '')
    .trim();
}

function shuffleArray(arr) {
  const clone = [...arr];
  for (let i = clone.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

export default router;