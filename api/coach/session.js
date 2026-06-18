const { getUserFromToken, getUserAccess } = require('../_supabase');
const { callGemini } = require('../_gemini');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorisé' });
  try {
    const user = await getUserFromToken(token);
    const access = await getUserAccess(user.id);
    if (!access.hasPaid && !access.inTrial) return res.status(403).json({ error: 'NO_ACCESS' });
    const { age, level, duration, lang = 'fr' } = req.body;
    const systemPrompt = `Tu es un coach de natation. Génère une séance en JSON uniquement, sans markdown. Format: {"titre":"...","objectif":"...","etapes":[{"num":1,"nom":"...","description":"...","duree":"...","exercices":[{"label":"...","query":"..."}]}]}`;
    const userMsg = `Âge: ${age}, niveau: ${level}, durée: ${duration} minutes.`;
    const raw = await callGemini(systemPrompt, userMsg);
    const plan = JSON.parse(raw.replace(/```json|```/g, '').trim());
    return res.status(200).json(plan);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
