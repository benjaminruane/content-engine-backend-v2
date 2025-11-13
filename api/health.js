Your file will be created at: api/health.js

export default function handler(req, res) {
  // Allow cross-origin requests (needed for your frontend)
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // Success response
  return res.status(200).json({ ok: true });
}
