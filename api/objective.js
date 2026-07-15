const { getUserFromToken, getSupabase } = require('./_supabase');

module.exports = async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorisé' });
  let user;
  try { user = await getUserFromToken(token); } catch (e) { return res.status(401).json({ error: e.message }); }
  const supabase = getSupabase();

  // Récupérer l'objectif actif de l'utilisateur (le plus récent)
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('objectives')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || null);
  }

  // Créer un nouvel objectif (remplace l'ancien s'il existe)
  if (req.method === 'POST') {
    const { nom, goal, etapes } = req.body;
    if (!goal) return res.status(400).json({ error: 'Objectif requis' });
    const { error: delError } = await supabase.from('objectives').delete().eq('user_id', user.id);
    if (delError) return res.status(500).json({ error: delError.message });
    const { data, error } = await supabase
      .from('objectives')
      .insert({ user_id: user.id, nom: nom || goal, goal, etapes: etapes || [], done: 0 })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // Mettre à jour la progression (étape validée)
  if (req.method === 'PATCH') {
    const { done } = req.body;
    if (typeof done !== 'number') return res.status(400).json({ error: 'done requis' });
    const { data, error } = await supabase
      .from('objectives')
      .update({ done })
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // Réinitialiser (supprimer l'objectif actif)
  if (req.method === 'DELETE') {
    const { error } = await supabase.from('objectives').delete().eq('user_id', user.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
};
