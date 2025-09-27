// routes/adminRoutes.js
import express from 'express';
import { adminAuth } from '../firebaseAdmin.js';

const router = express.Router();

// ✅ CREATE Firebase Auth user
router.post('/create-user', async (req, res) => {
  const { email, password } = req.body;
  try {
    const userRecord = await adminAuth.createUser({
      email,
      password,
    });
    res.status(201).json({ message: '✅ User created successfully', uid: userRecord.uid });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ✅ DELETE Firebase Auth user
router.delete('/delete-user/:uid', async (req, res) => {
  const uid = req.params.uid;
  try {
    await adminAuth.deleteUser(uid);
    res.status(200).json({ message: '🗑️ User deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ✅ UPDATE Firebase Auth email
router.post('/user/update-email', async (req, res) => {
  const { uid, newEmail } = req.body;
  try {
    await adminAuth.updateUser(uid, { email: newEmail });
    res.status(200).json({ message: '✉️ Email updated in Firebase Auth' });
  } catch (error) {
    console.error('❌ Email update error:', error);
    res.status(500).json({ error: 'Failed to update user email.' });
  }
});

export default router;
