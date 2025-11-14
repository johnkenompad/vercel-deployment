// routes/dailyTriviaRoutes.js
import express from 'express';
import { OpenAI } from 'openai';
import { db } from '../firebaseAdmin.js'; // ✅ Using Admin SDK Firestore
import { Timestamp } from 'firebase-admin/firestore';

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ───────────────────────────────────────────────
   POST /api/daily-trivia/generate
   Body: { topic: "General Knowledge", difficulty: "Easy" }
─────────────────────────────────────────────── */
router.post('/generate', express.json(), async (req, res) => {
  const { topic = 'General Knowledge', difficulty = 'Easy' } = req.body;

  try {
    const today = new Date().toISOString().split('T')[0]; // e.g., 2025-11-01
    const docRef = db.collection('dailyTrivia').doc(today);
    const existing = await docRef.get();

    // Return existing if already generated
    if (existing.exists) {
      return res.status(200).json({
        message: '✅ Trivia already exists',
        questions: existing.data().questions,
      });
    }

    const prompt = `
Generate 5 multiple-choice trivia questions on "${topic}" at "${difficulty}" difficulty.

Each question must include:
- "question": the actual question text
- "mcqs": an array of 4 answer choices
- "correctAnswer": the index (0-3) of the correct option

Return ONLY a JSON array of 5 such objects. No explanations. No text. Strictly JSON format.
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4', // Change to 'gpt-3.5-turbo' if needed
      messages: [
        { role: 'system', content: 'You are a trivia question generator.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    });

    let raw = completion.choices[0]?.message?.content?.trim();

    // Remove Markdown code block fences if any
    raw = raw.replace(/```json|```/g, '').trim();

    const trivia = JSON.parse(raw);

    await docRef.set({
      topic,
      difficulty,
      questions: trivia,
      generatedAt: Timestamp.now(),
    });

    return res.status(200).json({
      message: '✅ Trivia generated and saved!',
      questions: trivia,
    });

  } catch (err) {
    console.error('❌ Trivia generation error:', err);
    return res.status(500).json({
      error: 'Trivia generation failed',
      details: err.message,
    });
  }
});

export default router;
