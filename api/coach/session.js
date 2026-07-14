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
REGLE IMPORTANTE : chaque exercice DOIT avoir une description DETAILLEE et REDIGEE en plusieurs phrases completes (4 a 6 phrases, reste concis), au meme niveau de detail qu'un conseil de coach professionnel donne a un parent. Explique la position de depart, le mouvement precis, la respiration, le nombre de repetitions, et un conseil pratique pour le parent. Ecris des phrases naturelles et completes, pas une liste de mots-cles.
IMPORTANT : reste concis pour que le JSON complet tienne dans la reponse. Maximum 4 etapes, maximum 2 exercices par etape.
${exosInstruction}
Format JSON strict :
{"titre":"...","objectif":"phrase complete decrivant l objectif general de la seance","etapes":[{"num":1,"nom":"...","description":"description generale de l etape en 1-2 phrases","duree":"X min","exercices":[{"label":"nom court 3-5 mots","description":"Description detaillee en 4 a 6 phrases completes.","query":"mots cles youtube natation"}]}]}`;
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
    let end = clean.lastIndexOf('}');
    if (start === -1) throw new Error('Réponse Gemini invalide : pas de JSON trouvé');

    let jsonStr = end !== -1 ? clean.slice(start, end + 1) : clean.slice(start);
    let plan;
    try {
      plan = JSON.parse(jsonStr);
    } catch (parseErr) {
      // JSON tronqué : on tente de le réparer en fermant les structures ouvertes
      const repaired = repairTruncatedJson(clean.slice(start));
      try {
        plan = JSON.parse(repaired);
      } catch (secondErr) {
        throw new Error('La séance générée était incomplète. Merci de réessayer.');
      }
    }
    return res.status(200).json(plan);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

// Tente de réparer un JSON coupé en plein milieu (typiquement une réponse IA tronquée)
// en retirant le dernier élément incomplet et en refermant les crochets/accolades ouverts.
function repairTruncatedJson(str) {
  let s = str;
  // Coupe au dernier "}" ou "]" complet pour retirer un fragment incomplet en fin de chaîne
  const lastGoodBrace = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (lastGoodBrace !== -1) s = s.slice(0, lastGoodBrace + 1);

  // Compte les accolades/crochets ouverts non refermés, en ignorant ceux dans les chaînes
  let depthCurly = 0, depthSquare = 0, inString = false, escape = false;
  for (const ch of s) {
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depthCurly++;
    else if (ch === '}') depthCurly--;
    else if (ch === '[') depthSquare++;
    else if (ch === ']') depthSquare--;
  }
  // Referme dans l'ordre inverse d'ouverture (approximation raisonnable pour ce cas d'usage)
  s = s + ']'.repeat(Math.max(0, depthSquare)) + '}'.repeat(Math.max(0, depthCurly));
  return s;
}
