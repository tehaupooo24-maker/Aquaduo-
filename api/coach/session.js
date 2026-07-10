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
REGLE IMPORTANTE : chaque exercice DOIT avoir une description DETAILLEE et REDIGEE en plusieurs phrases completes (5 a 8 phrases minimum), au meme niveau de detail et de qualite redactionnelle qu'un conseil de coach professionnel donne a un parent. Explique clairement : la position de depart, le mouvement precis a effectuer, la respiration, le nombre de repetitions ou la duree, et un conseil pratique pour le parent (comment encourager, quoi dire a l'enfant, comment corriger un geste). Ecris comme si tu expliquais a un parent qui n'a jamais fait ca, avec des phrases naturelles et completes, pas une liste telegraphique de mots-cles.
${exosInstruction}
Format JSON strict :
{"titre":"...","objectif":"phrase complete decrivant l objectif general de la seance","etapes":[{"num":1,"nom":"...","description":"description generale de l etape en 1-2 phrases","duree":"X min","exercices":[{"label":"nom court 3-5 mots","description":"Description detaillee et redigee en 5 a 8 phrases completes expliquant la position de depart, le mouvement, la respiration, le nombre de repetitions, et un conseil pratique pour le parent.","query":"mots cles youtube natation"}]}]}`;
    const userMsg = lang === 'nl'
      ? `Leeftijd: ${age}, niveau: ${level}, tijd: ${duration} minuten.`
      : lang === 'en'
      ? `Age: ${age}, level: ${level}, time: ${duration} minutes.`
      : `Age : ${age}, niveau : ${level}, duree : ${duration} minutes.`;
    const raw = await callGemini(systemPrompt, userMsg);
    const clean = raw
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u00A0]/g, ' ')
      .trim();
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('Réponse Gemini invalide : pas de JSON trouvé');
    const plan = JSON.parse(clean.slice(start, end + 1));
    return res.status(200).json(plan);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
