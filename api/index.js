// ✅ Vercel Serverless Function Entry Point
export default function handler(req, res) {
  res.status(200).json({ 
    status: 'OK', 
    message: 'QuizRush Backend is running!',
    method: req.method,
    url: req.url
  });
}
