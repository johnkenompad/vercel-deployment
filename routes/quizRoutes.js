// routes/quizRoutes.js  — fully ES-Module compatible & tidy
//-----------------------------------------------------------
import express from 'express';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import multer from 'multer';

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
   2.  Core Quiz Generator
────────────────────────────────────────────────────────── */
router.post('/generate-quiz', upload.single('file'), async (req, res) => {
  const {
    text,
    quizType,
    mcQuestions = 0,
    tfQuestions = 0,
    difficulty = 'Easy',
    created_by,
  } = req.body;

  if (!text && !req.file) {
    return res
      .status(400)
      .json({ error: 'Please provide input text or upload a file.' });
  }

  const types             = Array.isArray(quizType) ? quizType : [quizType];
  const combinedQuestions = [];

  try {
    for (const type of types) {
      const count =
        type === 'mc' ? parseInt(mcQuestions || 0) : parseInt(tfQuestions || 0);
      if (count === 0) continue;

      /* Build LLM prompt & call OpenAI */
      const prompt = buildPrompt(type, text, count, difficulty);
      const resp   = await openai.chat.completions.create({
        model       : 'gpt-3.5-turbo',
        messages    : [{ role: 'user', content: prompt }],
        temperature : 0.7,
      });

      /* Clean JSON block */
      let raw = resp.choices[0].message.content.trim();
      raw     = raw.replace(/```(json)?|\s*```/g, '');
      let parsed = JSON.parse(raw);

      /* Post-process into uniform structure */
      if (type === 'tf') {
        parsed = parsed.map((q) => ({
          question_type : 'tf',
          question      : q.question?.trim() || '',
          options       : ['True', 'False'],
          answer        :
            q.answer.trim().toLowerCase() === 'true' ? 'True' : 'False',
        }));
      }

      if (type === 'mc') {
        parsed = parsed.map((q) => {
          const seen = new Set();
          const cleanedOptions = q.options
            .map((opt, i) => {
              const textOpt = opt.replace(/^[A-Da-d]\.?\s*/, '').trim();
              if (seen.has(textOpt.toLowerCase())) return null;
              seen.add(textOpt.toLowerCase());
              return String.fromCharCode(65 + i) + '. ' + textOpt;
            })
            .filter(Boolean);

          const answerClean = cleanedOptions.find((o) => {
            const optText = o.replace(/^[A-Da-d]\.?\s*/, '').trim().toLowerCase();
            const ansText = q.answer
              .replace(/^[A-Da-d]\.?\s*/, '')
              .trim()
              .toLowerCase();
            return optText === ansText;
          });

          return {
            question_type : 'mc',
            question      : q.question?.trim() || '',
            options       : cleanedOptions,
            answer        : answerClean || q.answer,
          };
        });
      }

      combinedQuestions.push(...parsed);
    }

    /* Shuffle & slice to total requested */
    const totalRequested =
      parseInt(mcQuestions || 0) + parseInt(tfQuestions || 0);
    const shuffled = shuffleArray(combinedQuestions).slice(0, totalRequested);

    res.json({ questions: shuffled, created_by });
  } catch (err) {
    console.error('❌ Error generating quiz:', err);
    res.status(500).json({ error: 'Quiz generation failed.' });
  }
});

/* ──────────────────────────────────────────────────────────
   3.  Generator used by Customize-Quiz page
────────────────────────────────────────────────────────── */
router.post('/generate-custom-quiz', express.json(), async (req, res) => {
  const { title, difficulty, mcqCount = 0, tfCount = 0, created_by } = req.body;

  if (!title || !difficulty) {
    return res
      .status(400)
      .json({ error: 'Missing quiz title or difficulty.' });
  }

  try {
    const questions = [];
    const config = [
      { type: 'mc', count: parseInt(mcqCount || 0) },
      { type: 'tf', count: parseInt(tfCount || 0) },
    ];

    for (const { type, count } of config) {
      if (count <= 0) continue;

      const prompt = buildPrompt(type, title, count, difficulty);
      const resp   = await openai.chat.completions.create({
        model       : 'gpt-3.5-turbo',
        messages    : [{ role: 'user', content: prompt }],
        temperature : 0.7,
      });

      let raw = resp.choices[0].message.content.trim();
      raw     = raw.replace(/```(json)?|\s*```/g, '');
      let parsed = JSON.parse(raw);

      /* Re-shape into unified format */
      if (type === 'tf') {
        parsed = parsed.map((q) => ({
          question_type : 'tf',
          question      : q.question?.trim(),
          options       : ['True', 'False'],
          answer        :
            q.answer.trim().toLowerCase() === 'true' ? 'True' : 'False',
        }));
      }

      if (type === 'mc') {
        parsed = parsed.map((q) => {
          const seen = new Set();
          const cleanedOptions = q.options
            .map((opt, i) => {
              const textOpt = opt.replace(/^[A-Da-d]\.?\s*/, '').trim();
              if (seen.has(textOpt.toLowerCase())) return null;
              seen.add(textOpt.toLowerCase());
              return String.fromCharCode(65 + i) + '. ' + textOpt;
            })
            .filter(Boolean);

          const answerClean = cleanedOptions.find((o) => {
            const optText = o.replace(/^[A-Da-d]\.?\s*/, '').trim().toLowerCase();
            const ansText = q.answer
              .replace(/^[A-Da-d]\.?\s*/, '')
              .trim()
              .toLowerCase();
            return optText === ansText;
          });

          return {
            question_type : 'mc',
            question      : q.question?.trim(),
            options       : cleanedOptions,
            answer        : answerClean || q.answer,
          };
        });
      }

      questions.push(...parsed);
    }

    const total = parseInt(mcqCount || 0) + parseInt(tfCount || 0);
    const shuffled = shuffleArray(questions).slice(0, total);

    res.json({ title, difficulty, questions: shuffled, created_by });
  } catch (err) {
    console.error('❌ Error in /generate-custom-quiz:', err);
    res.status(500).json({ error: 'Failed to generate custom quiz.' });
  }
});

/* ──────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────── */
function buildPrompt(type, text, num, difficulty) {
  if (type === 'tf') {
    return `Generate ${num} true/false questions based on "${text}" with difficulty "${difficulty}". Return pure JSON array: [{ "question": "...", "answer": "True" }]`;
  }
  return `Generate ${num} multiple-choice questions based on "${text}" with difficulty "${difficulty}". Return pure JSON array: [{ "question": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "answer": "A. ..."}]`;
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
