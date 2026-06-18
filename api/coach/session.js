const { getUserFromToken, getUserAccess } = require('../_supabase');
const { callGemini } = require('../_gemini');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorise' });
  try {
    const user = await getUserFromToken(token);
    const access = await getUserAccess(user.id);
    if (!access.hasPaid && !access.inTrial) return res.status(403).json({ error: 'NO_ACCESS' });

    const { age, level, duration, lang = 'fr' } = req.body;

    const systemPrompt = `Tu es un coach de natation expert qui s'adresse a des parents non-nageurs. Reponds en JSON uniquement, sans markdown ni backticks.
Chaque exercice doit etre explique en etapes numerotees (1. 2. 3.) comme une recette de cuisine. Le parent doit pouvoir lire a voix haute sans interpreter.
Format JSON strict :
{"titre":"...","objectif":"...","etapes":[{"num":1,"nom":"...","description":"...","duree":"...","exercices":[{"label":"nom court 3-5 mots","description":"Position de depart. Etape 1. Etape 2. Etape 3. Repetitions. Conseil parent.","query":"termes youtube natation"}]}]}
Ne jamais utiliser de guillemets doubles a l interieur des valeurs JSON. Utiliser des apostrophes si necessaire.`;

    const userMsg = lang === 'nl'
      ? `Leeftijd: ${age}, niveau: ${level}, tijd: ${duration} minuten.`
      : lang === 'en'
      ? `Age: ${age}, level: ${level}, time: ${duration} minutes.`
      : `Age : ${age}, niveau : ${level}, duree : ${duration} minutes.`;

    const raw = await callGemini(systemPrompt, userMsg);
    const clean = raw.replace(/```json|```/g, '').trim();
    const plan = JSON.parse(clean);
    return res.status(200).json(plan);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
