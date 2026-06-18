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

    const { level, goal, lang = 'fr' } = req.body;

    const systemPrompt = `Tu es un coach de natation. Génère un plan mensuel en JSON uniquement, sans markdown ni backticks. Format exact :
{"nom":"...","etapes":["Semaine 1 : ...","Semaine 2 : ...","Semaine 3 : ...","Semaine 4 : ..."]}`;

    const userMsg = lang === 'nl'
      ? `Niveau: ${level}, doel: ${goal}. Maak een 4-weken plan.`
      : lang === 'en'
      ? `Level: ${level}, goal: ${goal}. Create a 4-week plan.`
      : `Niveau : ${level}, objectif : ${goal}. Crée un plan de progression sur 4 semaines.`;

    const raw = await callGemini(systemPrompt, userMsg);
    const clean = raw.replace(/```json|```/g, '').trim();
    const plan = JSON.parse(clean);
    return res.status(200).json(plan);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
