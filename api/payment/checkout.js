const { getUserFromToken } = require('../_supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorisé' });
  try {
    const user = await getUserFromToken(token);
    const Stripe = require('stripe');
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const { lang = 'fr' } = req.body;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card', 'bancontact'],
      customer_email: user.email,
      line_items: [{ price_data: { currency: 'eur', unit_amount: 2999, product_data: { name: 'AquaDuo — Accès à vie' } }, quantity: 1 }],
      metadata: { user_id: user.id },
      success_url: `https://aquaduo.app?payment=success`,
      cancel_url: `https://aquaduo.app`,
    });
    return res.status(200).json({ url: session.url });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
