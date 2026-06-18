const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

async function getUserFromToken(token) {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) throw new Error('Non autorisé');
  return data.user;
}

async function getUserAccess(userId) {
  const supabase = getSupabase();
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (!data) return { inTrial: false, hasPaid: false, trialDaysLeft: 0 };
  const now = new Date();
  const hasPaid = !!data.paid_at;
  let inTrial = false, trialDaysLeft = 0;
  if (data.trial_ends_at) {
    const trialEnd = new Date(data.trial_ends_at);
    trialDaysLeft = Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)));
    inTrial = trialDaysLeft > 0 && !hasPaid;
  } else if (!hasPaid) {
    const createdAt = new Date(data.created_at);
    const daysSince = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
    trialDaysLeft = Math.max(0, 7 - daysSince);
    inTrial = trialDaysLeft > 0;
  }
  return { hasPaid, inTrial, trialDaysLeft, lang: data.lang || 'fr' };
}

module.exports = { getSupabase, getUserFromToken, getUserAccess };
