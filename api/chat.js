// /api/chat.js
// Updated to use OpenAI Responses API (2024 spec) with Educator Feedback mode.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { input } = req.body || {};
    if (!input || typeof input !== "string" || input.trim().length === 0) {
      return res.status(400).json({ error: "Missing or invalid 'input'." });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Server error: missing OpenAI API key." });
    }

    // System prompt: rewrite + educator feedback
    const systemPrompt = [
      "You are a nursing documentation assistant and clinical educator.",
      "TASK 1: Rewrite the user's note into an objective, clear nursing chart entry for a resident.",
      "Always use the word 'resident' instead of 'patient'. Avoid subjective phrasing or opinions.",
      "TASK 2: Provide one short educator feedback line starting with '💬 Feedback:' explaining the documentation reasoning."
    ].join(" ");

    const response = await fetch("https://api.openai.com/v1/responses", {
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
        text_format: "json", // ✅ fixed per new API
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      return res.status(500).json({ error: `Upstream error: ${errText || response.statusText}` });
    }

    const data = await response.json();
    let text = data?.output_text || "";

    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      // If not valid JSON, split feedback manually
      const [notePart, ...feedbackParts] = text.split("💬 Feedback:");
      payload = {
        note: notePart?.trim() || "No note returned.",
        feedback: feedbackParts.length ? "💬 Feedback:" + feedbackParts.join("💬 Feedback:").trim() : "💬 Feedback: Not available."
      };
    }

    // Force “resident” terminology
    if (payload?.note) {
      payload.note = payload.note.replace(/\b[Pp]atient\b/g, "resident");
    }

    return res.status(200).json(payload);
  } catch (err) {
    return res.status(500).json({ error: `Server error: ${err?.message || err}` });
  }
}
