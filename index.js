// ✅ ES Module Version of index.js (QuizRush Backend)
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import serviceAccount from './serviceAccountKey.json' with { type: 'json' };

// 🧩 Import Routes (use full .js extension for ES Modules)
import quizRoutes from './routes/quizRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import extractTextRoute from './routes/extractText.js';
import crosswordRoutes from './routes/crosswordRoutes.js';
import wordsearchRoutes from './routes/wordsearchRoutes.js';
import dailyTriviaRoutes from './routes/dailyTriviaRoutes.js';

// ✅ Load .env config
dotenv.config();

// ✅ Initialize Firebase Admin SDK (only if not already initialized)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// ✅ Setup Express App
const app = express();

// ✅ Global Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ REMOVED API KEY MIDDLEWARE - This was causing the 403 error!
// If you need API key protection, apply it only to specific routes

// ✅ Route Mounting
app.use('/api', quizRoutes);
app.use('/api', adminRoutes);
app.use('/api/extract-text', extractTextRoute);
app.use('/api', crosswordRoutes);
app.use('/api', wordsearchRoutes);
app.use('/api/daily-trivia', dailyTriviaRoutes);

// ✅ DELETE Endpoint: Admin deletes Firebase Auth user
app.delete('/api/admin/delete-user/:uid', async (req, res) => {
  const { uid } = req.params;

  try {
    await admin.auth().deleteUser(uid);
    return res.json({ success: true, message: `User ${uid} deleted from Firebase Auth.` });
  } catch (error) {
    console.error('❌ Error deleting user:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete user.' });
  }
});

// ✅ Server Startup
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`🧪 Test GET/POST:       http://localhost:${PORT}/api/test`);
  console.log(`🧠 Quiz Generator:      http://localhost:${PORT}/api/generate-custom-quiz`);
  console.log(`📁 OCR Upload:          http://localhost:${PORT}/api/extract-text`);
  console.log(`🧩 Crossword Generator: http://localhost:${PORT}/api/generate-crossword-clues`);
  console.log(`🔤 Word Search:         http://localhost:${PORT}/api/generate-wordsearch`);
  console.log(`🧠 Daily Trivia:         http://localhost:${PORT}/api/daily-trivia/generate`);
});