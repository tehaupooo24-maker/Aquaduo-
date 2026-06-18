import { createClient } from '@supabase/supabase-js';

export function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

export async function getUserFromToken(token) {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) throw new Error('Non autorisé');
  return data.user;
}

export async function getUserAccess(userId) {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (!data) return { inTrial: false, hasPaid: false, trialDaysLeft: 0 };

  const now = new Date();
  const createdAt = new Date(data.created_at);
  const daysSinceCreation = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
  const trialDaysLeft = Math.max(0, 7 - daysSinceCreation);

  return {
    hasPaid: !!data.paid_at,
    inTrial: !data.paid_at && trialDaysLeft > 0,
    trialDaysLeft,
    lang: data.lang || 'fr',
  };
}
