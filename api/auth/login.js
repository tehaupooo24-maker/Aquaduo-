const { getSupabase } = require('../_supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis.' });
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
  return res.status(200).json({ session: data.session, profile });
};
