import express from 'express';
import { OpenAI } from 'openai'; // ✅ Correct import

const router = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.get('/generate-crossword-clues', async (req, res) => {
  try {
    const prompt = `
Create a 10x10 crossword puzzle on the theme of astronomy or space.

Instructions:
- Return ONLY a JSON object with two fields: "grid" and "clues"
- "grid" must be a 2D array of 10x10.
  - Use "" (empty string) for white squares where input is allowed.
  - Use "B" for black squares.
- "clues" must be an array of 10 clue objects. Each clue should include:
  {
    "number": 1,
    "hint": "The red planet",
    "answer": "MARS",
    "direction": "down" or "across",
    "start": 12,
    "color": "text-red-600"
  }

Rules:
- Clues must not overlap unless intentionally intersecting by letter.
- Avoid invalid overlaps or exceeding grid bounds.
- All answers must be between 3–8 uppercase letters.

Return ONLY JSON — no explanation, no formatting:
{
  "grid": [
    ["", "", "B", "", "", "", "", "", "B", ""],
    ...
  ],
  "clues": [ ... ]
}
`.trim();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const raw = completion.choices[0].message.content.trim();
    console.log('🧠 RAW GPT:', raw);

    const jsonStart = raw.indexOf('{');
    if (jsonStart === -1) throw new Error('No JSON object found in GPT response');

    const cleaned = raw.slice(jsonStart).replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    // 🛡️ Fallback in case GPT misses "grid"
    if (!parsed.grid) {
      console.warn('⚠️ Missing "grid" in response, using blank 10x10.');
      parsed.grid = Array(10).fill().map(() => Array(10).fill(""));
    }

    res.json(parsed);
  } catch (err) {
    console.error('❌ Error generating crossword:', err.message);
    res.status(500).json({ error: 'Failed to generate crossword.' });
  }
});

export default router;
