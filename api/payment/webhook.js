const { getSupabase } = require('../_supabase');

module.exports.config = { api: { bodyParser: false } };

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  const buf = await buffer(req);
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return res.status(400).json({ error: 'Signature ou secret manquant.' });
  }

  const Stripe = require('stripe');
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  let event;
  try {
    // Vérification CRYPTOGRAPHIQUE de la signature : seul Stripe, en possession
    // du secret webhook, peut produire un événement qui passe cette vérification.
    // Sans ça, n'importe qui peut forger une fausse confirmation de paiement.
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (e) {
    return res.status(400).json({ error: 'Signature invalide : ' + e.message });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.user_id;
    // Sécurité supplémentaire : on ne débloque l'accès que si le paiement
    // est effectivement confirmé payé côté Stripe.
    if (userId && session.payment_status === 'paid') {
      const supabase = getSupabase();
      await supabase.from('profiles').update({ paid_at: new Date().toISOString() }).eq('id', userId);
    }
  }

  // Remboursement complet : on retire l'accès automatiquement.
  // On n'agit que sur les remboursements TOTAUX (charge.refunded === true),
  // pas sur les remboursements partiels, pour éviter de retirer l'accès à tort.
  if (event.type === 'charge.refunded') {
    const charge = event.data.object;
    const userId = charge.metadata?.user_id;
    if (userId && charge.refunded === true) {
      const supabase = getSupabase();
      await supabase.from('profiles').update({ paid_at: null }).eq('id', userId);
    }
  }

  return res.status(200).json({ received: true });
};
