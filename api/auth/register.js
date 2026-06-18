import { getSupabase } from '../_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password, lang = 'fr' } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis.' });

  const supabase = getSupabase();

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) return res.status(400).json({ error: error.message });

  await supabase.from('profiles').upsert({
    id: data.user.id,
    email,
    lang,
    created_at: new Date().toISOString(),
  });

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) return res.status(400).json({ error: signInError.message });

  return res.status(200).json({ session: signInData.session, user: signInData.user });
}
