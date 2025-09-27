// ✅ ES Module Version of index.js (QuizRush Backend)
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// 🧩 Import Routes (use full .js extension for ES Modules)
import quizRoutes from './routes/quizRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import extractTextRoute from './routes/extractText.js';
import crosswordRoutes from './routes/crosswordRoutes.js';
import wordsearchRoutes from './routes/wordsearchRoutes.js'; // ✅ Word Search route

// ✅ Load .env config
dotenv.config();

const app = express();

// ✅ Global Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Route Mounting
app.use('/api', quizRoutes);                      // 🧠 Quiz generation & customization
app.use('/api', adminRoutes);                     // 👤 Admin management
app.use('/api/extract-text', extractTextRoute);   // 📁 OCR endpoint
app.use('/api', crosswordRoutes);                 // 🧩 Crossword generation
app.use('/api', wordsearchRoutes);                // 🔤 Word Search generation

// ✅ Server Startup
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`🧪 Test GET/POST:       http://localhost:${PORT}/api/test`);
  console.log(`🧠 Quiz Generator:      http://localhost:${PORT}/api/generate-custom-quiz`);
  console.log(`📁 OCR Upload:          http://localhost:${PORT}/api/extract-text`);
  console.log(`🧩 Crossword Generator: http://localhost:${PORT}/api/generate-crossword-clues`);
  console.log(`🔤 Word Search:         http://localhost:${PORT}/api/generate-wordsearch`);
});
