const { getUserFromToken, getUserAccess, getSupabase } = require('../_supabase');
const { callGemini } = require('../_gemini');
const { checkAndConsumeQuota, DAILY_LIMIT } = require('../_usage');

function escapeStrayInnerQuotes(str) {
  let result = '';
  let inString = false;
  let escape = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (escape) { result += ch; escape = false; continue; }
    if (ch === '\\') { result += ch; escape = true; continue; }
    if (ch === '"') {
      if (!inString) { inString = true; result += ch; continue; }
      let j = i + 1;
      while (j < str.length && /\s/.test(str[j])) j++;
      const next = str[j];
      if (next === ':' || next === ',' || next === '}' || next === ']' || next === undefined) {
        inString = false;
        result += ch;
      } else {
        result += '\\"';
      }
      continue;
    }
    result += ch;
  }
  return result;
}

function parseGeminiJson(raw) {
  const clean = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .replace(/[\u2018\u2019]/g, "'") // apostrophes typographiques -> apostrophe simple (sans danger)
    .trim();

  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Réponse Gemini invalide : pas de JSON trouvé');
  const jsonStr = clean.slice(start, end + 1);

  try {
    return JSON.parse(jsonStr);
  } catch (e1) {
    try {
      return JSON.parse(escapeStrayInnerQuotes(jsonStr));
    } catch (e2) {
      let inString = false, escaped = false, repaired = '';
      for (const ch of jsonStr) {
        if (escaped) { repaired += ch; escaped = false; continue; }
        if (ch === '\\') { repaired += ch; escaped = true; continue; }
        if (ch === '"') { inString = !inString; repaired += ch; continue; }
        if (inString && ch === '\n') { repaired += '\\n'; continue; }
        if (inString && ch === '\r') { continue; }
        if (inString && ch === '\t') { repaired += ' '; continue; }
        repaired += ch;
      }
      try {
        return JSON.parse(repaired);
      } catch (e3) {
        try {
          return JSON.parse(escapeStrayInnerQuotes(repaired));
        } catch (e4) {
          throw new Error('Réponse Gemini invalide (JSON malformé) : ' + e4.message);
        }
      }
    }
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorisé' });
  try {
    const user = await getUserFromToken(token);
    const access = await getUserAccess(user.id);
    if (!access.hasPaid && !access.inTrial) return res.status(403).json({ error: 'NO_ACCESS' });
    const supabase = getSupabase();
    const quota = await checkAndConsumeQuota(supabase, user.id, 'coach_objective');
    if (!quota.allowed) return res.status(429).json({ error: 'LIMIT_REACHED', limit: DAILY_LIMIT });
    const { level, goal, lang = 'fr' } = req.body;
    const systemPrompt = `Tu es un coach de natation qui s'adresse à des PARENTS SANS AUCUNE CONNAISSANCE technique en natation. Génère un plan mensuel en JSON uniquement, sans markdown, sans backticks.
REGLES IMPORTANTES :
- Évite tout jargon technique non expliqué (pas de "frite sous la nuque" sans dire ce que c'est, pas de termes comme "appui", "gainage" sans reformuler simplement).
- Chaque semaine doit avoir un titre court et une LISTE de 3 à 5 points courts et concrets (une phrase par point, pas un paragraphe dense).
- Chaque point doit être compréhensible par un parent qui n'a jamais mis les pieds dans une piscine de sa vie : explique le geste comme à un débutant total, avec des mots simples et des comparaisons imagées si utile.
- Reste concret et actionnable : ce que le parent doit faire ou observer concrètement.
- INTERDICTION ABSOLUE : n'utilise JAMAIS le caractère guillemet droit (") à l'intérieur des textes (titre, points). Pour mettre un mot en avant, utilise des guillemets simples (') ou reformule sans guillemets. Le caractère " est réservé exclusivement à la structure JSON elle-même.
Format JSON strict :
{"nom":"...","etapes":[{"titre":"Semaine 1 : ...","points":["Point 1 clair et simple","Point 2 clair et simple","Point 3 clair et simple"]},{"titre":"Semaine 2 : ...","points":["...","...","..."]},{"titre":"Semaine 3 : ...","points":["...","...","..."]},{"titre":"Semaine 4 : ...","points":["...","...","..."]}]}`;
    const userMsg = `Niveau: ${level}, objectif: ${goal}.`;
    const raw = await callGemini(systemPrompt, userMsg);
    const plan = parseGeminiJson(raw);
    return res.status(200).json(plan);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
