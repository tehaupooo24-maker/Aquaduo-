const { getSupabase } = require('../_supabase');

module.exports.config = { api: { bodyParser: false } };

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const Stripe = require('stripe');
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers['stripe-signature'];
  const buf = await buffer(req);
  let event;
  try { event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.user_id;
    if (userId) {
      const supabase = getSupabase();
      await supabase.from('profiles').update({ paid_at: new Date().toISOString() }).eq('id', userId);
    }
  }
  return res.status(200).json({ received: true });
};
