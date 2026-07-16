const { getUserFromToken, getUserAccess, getSupabase } = require('./_supabase');
const { checkAndConsumeQuota, DAILY_LIMIT } = require('./_usage');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorisé' });

  let user;
  try {
    user = await getUserFromToken(token);
    const access = await getUserAccess(user.id);
    if (!access.hasPaid && !access.inTrial) return res.status(403).json({ error: 'NO_ACCESS' });

    const supabase = getSupabase();
    const quota = await checkAndConsumeQuota(supabase, user.id, 'gemini_media');
    if (!quota.allowed) return res.status(429).json({ error: 'LIMIT_REACHED', limit: DAILY_LIMIT });
  } catch (e) {
    return res.status(401).json({ error: e.message });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'Clé Gemini non configurée.' });
  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.body) }
    );
    const data = await geminiRes.json();
    return res.status(geminiRes.ok ? 200 : geminiRes.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Erreur interne.' });
  }
};
