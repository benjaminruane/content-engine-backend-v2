// api/health.js

// --- CORS helper -------------------------------------------------
function setCorsHeaders(req, res) {
  const origin = req.headers.origin || "*";

  // For the prototype, be permissive so frontend + localhost both work
  res.setHeader("Access-Control-Allow-Origin", origin === "null" ? "*" : origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
// -----------------------------------------------------------------

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  return res.status(200).json({ status: "ok", message: "Backend is healthy" });
}
