import { getUserFromToken, getUserAccess } from '../_supabase.js';
import { callGemini } from '../_gemini.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorisé' });

  try {
    const user = await getUserFromToken(token);
    const access = await getUserAccess(user.id);

    if (!access.hasPaid && !access.inTrial) {
      return res.status(403).json({ error: 'NO_ACCESS' });
    }

    const { age, level, description, lang = 'fr' } = req.body;

    const systemPrompt = lang === 'nl'
      ? `Je bent een professionele zwemcoach die ouders begeleidt bij het leren zwemmen met hun kind. Geef concrete, praktische adviezen in het Nederlands. Gebruik emoji's 🏊 voor elke oefening. Formaat: 🏊 Naam oefening — Uitleg | YOUTUBE: zoekterm`
      : lang === 'en'
      ? `You are a professional swimming coach helping parents teach their child to swim. Give concrete, practical advice in English. Use emoji 🏊 for each exercise. Format: 🏊 Exercise name — Explanation | YOUTUBE: search term`
      : `Tu es un coach de natation professionnel qui aide les parents à apprendre la natation à leurs enfants. Donne des conseils concrets et pratiques en français. Utilise des emoji 🏊 pour chaque exercice. Format : 🏊 Nom exercice — Explication | YOUTUBE: terme de recherche`;

    const userMsg = lang === 'nl'
      ? `Kind: ${age}, niveau: ${level}\nMoeilijkheden: ${description}`
      : lang === 'en'
      ? `Child: ${age}, level: ${level}\nDifficulties: ${description}`
      : `Enfant : ${age}, niveau : ${level}\nDifficultés observées : ${description}`;

    const text = await callGemini(systemPrompt, userMsg);
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
