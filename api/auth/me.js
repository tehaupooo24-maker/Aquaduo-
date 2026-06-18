import { getUserFromToken, getUserAccess } from '../_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorisé' });

  try {
    const user = await getUserFromToken(token);
    const access = await getUserAccess(user.id);
    return res.status(200).json({ profile: { id: user.id, email: user.email, lang: access.lang }, access });
  } catch (e) {
    return res.status(401).json({ error: e.message });
  }
}
