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

    const { age, level, duration, lang = 'fr', coachExos = null } = req.body;

    const exosInstruction = coachExos
      ? `IMPORTANT : La seance doit imperativement inclure et detailler ces exercices issus de l analyse du coach : ${coachExos}. Ne pas en inventer de nouveaux, uniquement detailler ceux-ci.`
      : '';

    const systemPrompt = `Tu es un coach de natation expert. Reponds UNIQUEMENT en JSON valide, sans markdown, sans backticks.
REGLE : chaque exercice DOIT avoir un champ description avec les etapes numerotees 1. 2. 3. expliquant comment faire.
${exosInstruction}
Format JSON strict :
{"titre":"...","objectif":"...","etapes":[{"num":1,"nom":"...","description":"description generale","duree":"X min","exercices":[{"label":"nom court 3-5 mots","description":"1. Position de depart. 2. Mouvement des bras ou jambes. 3. Respiration. 4. Repeter X fois. Conseil parent.","query":"mots cles youtube natation"}]}]}`;

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
