const { getUserFromToken, getSupabase } = require('./_supabase');

module.exports = async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorisé' });
  let user;
  try { user = await getUserFromToken(token); } catch (e) { return res.status(401).json({ error: e.message }); }
  const supabase = getSupabase();
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('progress').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }
  if (req.method === 'POST') {
    const { note, stars } = req.body;
    if (!note) return res.status(400).json({ error: 'Note requise' });
    const { data, error } = await supabase.from('progress').insert({ user_id: user.id, note, stars: stars || 0 }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }
  if (req.method === 'DELETE') {
    const id = req.url.split('/').pop();
    const { error } = await supabase.from('progress').delete().eq('id', id).eq('user_id', user.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }
  return res.status(405).end();
};
