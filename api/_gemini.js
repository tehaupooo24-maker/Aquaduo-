async function callGemini(systemInstruction, userMsg) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Clé Gemini non configurée.');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
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
  if (!res.ok) throw new Error(data.error?.message || 'Erreur Gemini');
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}
module.exports = { callGemini };
