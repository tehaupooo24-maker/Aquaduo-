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

    const systemPrompt = `Tu es un coach de natation expert. Génère une séance structurée en JSON uniquement, sans markdown ni backticks. 
Chaque exercice DOIT avoir une description détaillée expliquant comment l'exécuter concrètement (position du corps, mouvements des bras, des jambes, respiration, conseils pratiques pour les parents).
Format JSON exact :
{"titre":"...","objectif":"...","etapes":[{"num":1,"nom":"...","description":"description générale de l'étape...","duree":"...","exercices":[{"label":"nom court de l'exercice","description":"explication détaillée de comment faire l'exercice, ce qu'on cherche à travailler, conseils pratiques pour le parent","query":"termes de recherche youtube"}]}]}`;

    const userMsg = lang === 'nl'
      ? `Leeftijd: ${age}, niveau: ${level}, tijd: ${duration} minuten. Genereer een zwemles met gedetailleerde oefeningen.`
      : lang === 'en'
      ? `Age: ${age}, level: ${level}, time: ${duration} minutes. Generate a swim session with detailed exercise descriptions.`
      : `Âge : ${age}, niveau : ${level}, durée : ${duration} minutes. Génère une séance avec des exercices très détaillés.`;

    const raw = await callGemini(systemPrompt, userMsg);
    const plan = JSON.parse(raw.replace(/```json|```/g, '').trim());
    return res.status(200).json(plan);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
