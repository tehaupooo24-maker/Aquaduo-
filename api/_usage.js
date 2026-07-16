const DAILY_LIMIT = 20;

// Vérifie le nombre d'appels Gemini de l'utilisateur depuis minuit (heure serveur),
// et enregistre l'appel courant si la limite n'est pas atteinte.
// Retourne { allowed: true/false, count }.
async function checkAndConsumeQuota(supabase, userId, action) {
  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('usage_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since.toISOString());
  if (error) throw new Error(error.message);

  if ((count || 0) >= DAILY_LIMIT) {
    return { allowed: false, count: count || 0 };
  }

  const { error: insertError } = await supabase
    .from('usage_log')
    .insert({ user_id: userId, action: action || 'gemini' });
  if (insertError) throw new Error(insertError.message);

  return { allowed: true, count: (count || 0) + 1 };
}

module.exports = { checkAndConsumeQuota, DAILY_LIMIT };
