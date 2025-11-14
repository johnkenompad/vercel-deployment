// ✅ ES Module Version of index.js (QuizRush Backend)
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// ✅ Load .env config
dotenv.config();

// ✅ Setup Express App
const app = express();

// ✅ Global Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Basic test route
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'QuizRush Backend is running!',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API test endpoint working!',
    env: {
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      hasFirebase: !!process.env.FIREBASE_SERVICE_ACCOUNT
    }
  });
});

// ✅ Server Startup (only for local development)
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
  });
}

// ✅ Export for Vercel
export default app;