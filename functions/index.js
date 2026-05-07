const functions = require('firebase-functions');
const fetch = require('node-fetch');

// Remplace par ta clé API Gemini ou autre IA
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'TA_CLE_API_GEMINI';
const GEMINI_MODEL = 'gemini-2.5-flash';

// Ajout CORS universel pour le frontend web
exports.chatAI = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const prompt = req.body.prompt || req.body.message || req.body.text || '';
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt manquant' });
  }

  try {
    // Appel à l’API Gemini (ou autre IA)
    const geminiRes = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + GEMINI_API_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 512 }
      })
    });
    const geminiData = await geminiRes.json();
    const raw = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'Aucune réponse.';
    let response = raw;
    let title = undefined;
    // Essayer de parser un JSON pour extraire response et title
    try {
      const parsed = JSON.parse(raw);
      if (parsed.response) response = parsed.response;
      if (parsed.title) title = parsed.title;
    } catch (e) {
      // Si ce n'est pas du JSON, on laisse la réponse brute
    }
    res.json(title ? { response, title } : { response });
  } catch (err) {
    res.status(500).json({ error: 'Erreur IA: ' + err.message });
  }
});
