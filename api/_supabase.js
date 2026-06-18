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

  // Use paid_at if exists, otherwise fall back to has_access
  const hasPaid = !!data.paid_at || (data.has_access === true && !data.trial_ends_at);

  // Trial: has_access=true and trial_ends_at is in the future
  let inTrial = false;
  let trialDaysLeft = 0;
  if (data.trial_ends_at) {
    const trialEnd = new Date(data.trial_ends_at);
    trialDaysLeft = Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)));
    inTrial = trialDaysLeft > 0 && !hasPaid;
  } else if (!hasPaid) {
    // Fallback: calculate from created_at
    const createdAt = new Date(data.created_at);
    const daysSince = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
    trialDaysLeft = Math.max(0, 7 - daysSince);
    inTrial = trialDaysLeft > 0;
  }

  return {
    hasPaid,
    inTrial,
    trialDaysLeft,
    lang: data.lang || 'fr',
  };
}
