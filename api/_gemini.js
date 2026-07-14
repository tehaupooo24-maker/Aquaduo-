async function callGeminiOnce(model, systemInstruction, userMsg, key) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: userMsg }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: { maxOutputTokens: 8192 },
      }),
    }
  );
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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
    { model: 'gemini-1.5-flash', delay: 500 },
  ];

  let lastError = null;

  for (const attempt of attempts) {
    if (attempt.delay) await sleep(attempt.delay);
    try {
      const { ok, status, data } = await callGeminiOnce(attempt.model, systemInstruction, userMsg, key);
      if (ok) {
        const finishReason = data.candidates?.[0]?.finishReason;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (finishReason === 'MAX_TOKENS' && !text.trim().endsWith('}')) {
          // Réponse coupée avant la fin : on retente plutôt que de renvoyer du JSON cassé
          lastError = 'Réponse tronquée (trop longue)';
          continue;
        }
        return text;
      }
      const message = data.error?.message || 'Erreur Gemini';
      lastError = message;
      if (!isRetryable(status, message)) throw new Error(message);
    } catch (e) {
      lastError = e.message;
      if (!isRetryable(200, e.message)) throw e;
    }
  }

  throw new Error("Le service de coaching est très sollicité en ce moment. Merci de réessayer dans quelques instants.");
}

module.exports = { callGemini };
