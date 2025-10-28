// /api/chat.js
export default async function handler(req, res) {
  try {
    // Only allow POST
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    // Get prompt from body (supports both Node & Web runtimes)
    const body = req.body ?? (await (async () => {
      try { return await req.json(); } catch { return {}; }
    })());
    const { prompt } = body || {};
    if (!prompt) {
      res.status(400).json({ error: "Missing prompt" });
      return;
    }

    // Call OpenAI Responses API
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: prompt,
        temperature: 0.3
      })
    });

    const data = await r.json();
    res.status(r.ok ? 200 : 500).json(data);
  } catch (e) {
    res.status(500).json({ error: e?.message || "Server error" });
  }
}
