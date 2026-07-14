async function callGeminiOnce(model, systemInstruction, userMsg, key) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: userMsg }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
      }),
    }
  );
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Erreurs de surcharge/temporaires : on retente. Les autres (clé invalide, quota dépassé
// définitivement, requête malformée) ne servent à rien de retenter.
function isRetryable(status, message) {
  if (status === 429 || status === 503) return true;
  const m = (message || '').toLowerCase();
  return m.includes('overloaded') || m.includes('high demand') || m.includes('unavailable');
}

async function callGemini(systemInstruction, userMsg) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Clé Gemini non configurée.');

  const attempts = [
    { model: 'gemini-2.5-flash', delay: 0 },
    { model: 'gemini-2.5-flash', delay: 1500 },
    { model: 'gemini-2.5-flash', delay: 3500 },
    { model: 'gemini-1.5-flash', delay: 500 }, // dernier recours : modèle de secours
  ];

  let lastError = null;

  for (const attempt of attempts) {
    if (attempt.delay) await sleep(attempt.delay);
    try {
      const { ok, status, data } = await callGeminiOnce(attempt.model, systemInstruction, userMsg, key);
      if (ok) {
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }
      const message = data.error?.message || 'Erreur Gemini';
      lastError = message;
      if (!isRetryable(status, message)) {
        // Erreur définitive (clé invalide, requête malformée...) : inutile de retenter
        throw new Error(message);
      }
      // sinon on continue la boucle vers la prochaine tentative
    } catch (e) {
      lastError = e.message;
      if (!isRetryable(200, e.message)) throw e;
    }
  }

  // Toutes les tentatives ont échoué à cause de la surcharge
  throw new Error("Le service de coaching est très sollicité en ce moment. Merci de réessayer dans quelques instants.");
}

module.exports = { callGemini };
