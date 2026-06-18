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
    const { level, goal, lang = 'fr' } = req.body;
    const systemPrompt = `Tu es un coach de natation. Génère un plan mensuel en JSON uniquement, sans markdown. Format: {"nom":"...","etapes":["Semaine 1: ...","Semaine 2: ...","Semaine 3: ...","Semaine 4: ..."]}`;
    const userMsg = `Niveau: ${level}, objectif: ${goal}.`;
    const raw = await callGemini(systemPrompt, userMsg);
    const plan = JSON.parse(raw.replace(/```json|```/g, '').trim());
    return res.status(200).json(plan);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
