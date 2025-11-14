// ✅ QuizRush Backend - CommonJS Version
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const admin = require('firebase-admin');

// ✅ Load .env config
dotenv.config();

// ✅ Initialize Firebase Admin SDK (only if not already initialized)
if (!admin.apps.length) {
  try {
    let serviceAccount;
    
    // Check if FIREBASE_SERVICE_ACCOUNT env variable exists (for Vercel)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Basic routes
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'QuizRush Backend is running!',
    firebaseInitialized: admin.apps.length > 0,
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
module.exports = app;