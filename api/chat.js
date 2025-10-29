// /api/chat.js
// Minimal, stable Responses API call (no text_format/response_format).
// Returns { note, feedback } and is tolerant of slightly non-JSON outputs.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { input } = req.body || {};
    if (!input || typeof input !== "string" || !input.trim()) {
      return res.status(400).json({ error: "Missing or invalid 'input'." });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Server error: missing OpenAI API key." });
    }

    const systemPrompt = `
      You are a nursing documentation assistant and educator.

      TASK 1: Rewrite the user's quick note into a clear, objective chart entry.
      - Always use "resident" instead of "patient".
      - Be factual and concise; avoid opinions or subjective adjectives.
      - No diagnosis or new orders.

      TASK 2: Provide ONE short educator feedback line that begins with "💬 Feedback:".

      Return ONLY valid JSON:
      {
        "note": "rewritten objective chart entry",
        "feedback": "💬 Feedback: <one concise tip>"
      }
    `;

    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [
          { role: "system", content: systemPrompt },
          { role: "user", content: input }
        ],
        temperature: 0.2
      })
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "");
      return res.status(500).json({ error: `Upstream error: ${errText || upstream.statusText}` });
    }

    const data = await upstream.json();

    // Responses API handy fields:
    let text =
      data?.output_text ||
      data?.output?.[0]?.content?.[0]?.text?.value ||
      "";

    // Try to parse strict JSON first
    let payload = null;
    try {
      payload = JSON.parse(text);
    } catch (_) {
      // Relaxed fallback: try to extract a JSON block if the model wrapped it in prose
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          payload = JSON.parse(match[0]);
        } catch (_) { /* ignore */ }
      }
    }

    // Final fallback – still return something useful
    if (!payload || typeof payload !== "object") {
      const [notePart, ...rest] = text.split("💬 Feedback:");
      payload = {
        note: (notePart || "No note returned.").trim(),
        feedback: rest.length ? ("💬 Feedback:" + rest.join("💬 Feedback:").trim()) : "💬 Feedback: Keep notes objective and resident-focused."
      };
    }

    // Guard fields
    if (typeof payload.note !== "string") payload.note = "No note returned.";
    if (typeof payload.feedback !== "string") payload.feedback = "💬 Feedback: Keep notes objective and resident-focused.";

    return res.status(200).json(payload);
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
}
