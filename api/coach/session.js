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

    const systemPrompt = `Tu es un coach de natation expert. Reponds UNIQUEMENT en JSON valide, sans markdown, sans backticks, sans commentaires.

REGLE ABSOLUE : chaque exercice DOIT avoir un champ description NON VIDE avec minimum 3 phrases expliquant comment faire l exercice etape par etape. Sans description = reponse invalide.

Format JSON :
{"titre":"...","objectif":"...","etapes":[{"num":1,"nom":"...","description":"description generale de l etape en 1-2 phrases","duree":"X minutes","exercices":[{"label":"nom court 3-5 mots","description":"1. Position de depart : l enfant fait ceci. 2. Il fait ensuite cela avec ses bras ou jambes. 3. Pour la respiration faire ainsi. 4. Repeter X fois. Conseil pour le parent : dire ceci.","query":"mots cles youtube natation"}]}]}`;

    const userMsg = lang === 'nl'
      ? `Maak een zwemles. Leeftijd: ${age}, niveau: ${level}, tijd: ${duration} minuten. Elke oefening moet gedetailleerde stap-voor-stap instructies hebben.`
      : lang === 'en'
      ? `Create a swim session. Age: ${age}, level: ${level}, time: ${duration} minutes. Every exercise must have detailed step-by-step instructions.`
      : `Cree une seance de natation. Age : ${age}, niveau : ${level}, duree : ${duration} minutes. Chaque exercice doit avoir des instructions detaillees etape par etape.`;

    const raw = await callGemini(systemPrompt, userMsg);
    const clean = raw.replace(/```json|```/g, '').trim();
    const plan = JSON.parse(clean);
    return res.status(200).json(plan);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
