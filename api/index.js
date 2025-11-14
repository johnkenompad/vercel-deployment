// ✅ Vercel Serverless Function Entry Point
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import admin from 'firebase-admin';

// 🧩 Import Routes (use full .js extension for ES Modules)
import quizRoutes from '../routes/quizRoutes.js';
import adminRoutes from '../routes/adminRoutes.js';
import extractTextRoute from '../routes/extractText.js';
import crosswordRoutes from '../routes/crosswordRoutes.js';
import wordsearchRoutes from '../routes/wordsearchRoutes.js';
import dailyTriviaRoutes from '../routes/dailyTriviaRoutes.js';

// ✅ Load .env config
dotenv.config();

// ✅ Initialize Firebase Admin SDK using environment variables
if (!admin.apps.length) {
  try {
    // Parse the service account from environment variable
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
  }
}

// ✅ Setup Express App
const app = express();

// ✅ Global Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// ✅ Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'QuizRush Backend is running!' });
});

// ✅ Export for Vercel
export default app;
