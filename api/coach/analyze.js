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
    const { age, level, description, lang = 'fr' } = req.body;
    const systemPrompt = lang === 'nl'
      ? `Je bent een professionele zwemcoach. Geef concrete adviezen in het Nederlands. Gebruik 🏊 voor elke oefening. Formaat: 🏊 Naam — Uitleg | YOUTUBE: zoekterm`
      : lang === 'en'
      ? `You are a professional swimming coach. Give concrete advice in English. Use 🏊 for each exercise. Format: 🏊 Name — Explanation | YOUTUBE: search term`
      : `Tu es un coach de natation professionnel. Donne des conseils concrets en français. Utilise 🏊 pour chaque exercice. Format : 🏊 Nom — Explication | YOUTUBE: terme de recherche`;
    const userMsg = `Enfant : ${age}, niveau : ${level}\nDifficultés : ${description}`;
    const text = await callGemini(systemPrompt, userMsg);
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
