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

    const systemPrompt = `Tu es un coach de natation expert qui s'adresse à des parents non-nageurs. Génère une séance en JSON uniquement, sans markdown ni backticks.

IMPORTANT : Chaque exercice doit être expliqué comme une recette de cuisine, étape par étape, numérotée. Le parent doit pouvoir lire à voix haute sans avoir à interpréter. 

Format exact :
{"titre":"...","objectif":"...","etapes":[{"num":1,"nom":"...","description":"description générale de l'étape","duree":"...","exercices":[{"label":"nom court","description":"Explication en étapes numérotées. Commence par la position de départ. Décris chaque geste précisément (où vont les mains, les jambes, la tête, la respiration). Termine par combien de fois répéter. Donne un conseil parent en fin.","query":"termes youtube"}]}]}

Exemple de description d'exercice attendue :
"L'enfant est allongé sur le ventre, bras tendus devant, tenant la planche.\\n1. Il lâche la planche et pousse l'eau vers l'extérieur avec les deux bras en faisant un grand cercle.\\n2. Ce mouvement redresse son buste — c'est là qu'il sort la tête et inspire.\\n3. Ses mains reviennent ensemble devant et reprennent la planche.\\n4. Tête dans l'eau, il souffle ses bulles. Les jambes restent immobiles.\\nRépéter 4 fois. Conseil parent : dites-lui \\"bras, respire, glisse\\" à chaque cycle."`;

    const userMsg = lang === 'nl'
      ? `Leeftijd: ${age}, niveau: ${level}, tijd: ${duration} minuten. Gedetailleerde stap-voor-stap oefeningen voor ouders.`
      : lang === 'en'
      ? `Age: ${age}, level: ${level}, time: ${duration} minutes. Detailed step-by-step exercises for parents.`
      : `Âge : ${age}, niveau : ${level}, durée : ${duration} minutes. Exercices très détaillés étape par étape pour les parents.`;

    const raw = await callGemini(systemPrompt, userMsg);
    const plan = JSON.parse(raw.replace(/```json|```/g, '').trim());
    return res.status(200).json(plan);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
