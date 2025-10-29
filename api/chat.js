export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt } = req.body || {};
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server misconfig: missing OPENAI_API_KEY' });
    }

    // Call OpenAI via fetch (no SDK needed)
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'You are a nursing documentation assistant. Convert brief shift notes into clear, objective, professional nursing charting. No subjective language.'
          },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!r.ok) {
      const txt = await r.text();
      console.error('OpenAI error:', r.status, txt);
      return res.status(500).json({ error: 'Upstream error', status: r.status, detail: txt.slice(0, 300) });
    }

    const data = await r.json();
    const text = data.choices?.[0]?.message?.content?.trim() || 'No output.';
    return res.status(200).json({ output: text });
  } catch (err) {
    console.error('SERVER ERROR:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
