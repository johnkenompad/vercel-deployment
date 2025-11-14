// ✅ Vercel Serverless Function Entry Point
import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';

// ✅ Initialize Firebase Admin SDK using environment variables
if (!admin.apps.length) {
  try {
    // Parse the service account from environment variable
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      : null;
    
    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('✅ Firebase Admin initialized');
    } else {
      console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT not found');
    }
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
  }
}

// ✅ Setup Express App
const app = express();

// ✅ Global Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ✅ Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'QuizRush Backend is running!',
    firebaseInitialized: admin.apps.length > 0
  });
});

app.get('/api', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'QuizRush API is running!',
    firebaseInitialized: admin.apps.length > 0
  });
});

// Simple test endpoint
app.post('/api/test', (req, res) => {
  res.json({ success: true, message: 'API is working!', body: req.body });
});

// ✅ Export handler function for Vercel
export default (req, res) => {
  return app(req, res);
};
