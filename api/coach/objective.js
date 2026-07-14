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
    const systemPrompt = `Tu es un coach de natation qui s'adresse à des PARENTS SANS AUCUNE CONNAISSANCE technique en natation. Génère un plan mensuel en JSON uniquement, sans markdown, sans backticks.

REGLES IMPORTANTES :
- Évite tout jargon technique non expliqué (pas de "frite sous la nuque" sans dire ce que c'est, pas de termes comme "appui", "gainage" sans reformuler simplement).
- Chaque semaine doit avoir un titre court et une LISTE de 3 à 5 points courts et concrets (une phrase par point, pas un paragraphe dense).
- Chaque point doit être compréhensible par un parent qui n'a jamais mis les pieds dans une piscine de sa vie : explique le geste comme à un débutant total, avec des mots simples et des comparaisons imagées si utile (ex: "comme un avion qui plane" plutôt que juste "position hydrodynamique").
- Reste concret et actionnable : ce que le parent doit faire ou observer concrètement.

Format JSON strict :
{"nom":"...","etapes":[{"titre":"Semaine 1 : ...","points":["Point 1 clair et simple","Point 2 clair et simple","Point 3 clair et simple"]},{"titre":"Semaine 2 : ...","points":["...","...","..."]},{"titre":"Semaine 3 : ...","points":["...","...","..."]},{"titre":"Semaine 4 : ...","points":["...","...","..."]}]}`;
    const userMsg = `Niveau: ${level}, objectif: ${goal}.`;
    const raw = await callGemini(systemPrompt, userMsg);
    const clean = raw
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
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
