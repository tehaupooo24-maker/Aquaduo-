import { getUserFromToken, getUserAccess } from '../_supabase.js';
import { callGemini } from '../_gemini.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorisé' });

  try {
    const user = await getUserFromToken(token);
    const access = await getUserAccess(user.id);
    if (!access.hasPaid && !access.inTrial) return res.status(403).json({ error: 'NO_ACCESS' });

    const { age, level, duration, lang = 'fr' } = req.body;

    const systemPrompt = `Tu es un coach de natation. Génère une séance structurée en JSON uniquement, sans markdown ni backticks. Format exact :
{"titre":"...","objectif":"...","etapes":[{"num":1,"nom":"...","description":"...","duree":"...","exercices":[{"label":"...","query":"..."}]}]}`;

    const userMsg = lang === 'nl'
      ? `Leeftijd: ${age}, niveau: ${level}, tijd: ${duration} minuten. Genereer een zwemles.`
      : lang === 'en'
      ? `Age: ${age}, level: ${level}, time: ${duration} minutes. Generate a swim session.`
      : `Âge : ${age}, niveau : ${level}, durée : ${duration} minutes. Génère une séance de natation.`;

    const raw = await callGemini(systemPrompt, userMsg);
    const clean = raw.replace(/```json|```/g, '').trim();
    const plan = JSON.parse(clean);
    return res.status(200).json(plan);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
