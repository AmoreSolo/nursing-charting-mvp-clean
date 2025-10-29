// /api/chat.js
// Final stable version — works with new OpenAI Responses API and guarantees output.

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
      You are a nursing documentation assistant and clinical educator.

      TASK 1: Rewrite the user's note into a clear, objective nursing chart entry for a resident.
      - Always use the term "resident" instead of "patient".
      - Keep language factual, concise, and professional.
      - Avoid subjective statements and emotional words.

      TASK 2: Provide a short feedback line beginning with "💬 Feedback:"
      explaining how well the documentation follows objective charting standards.

      Respond strictly in JSON format as:
      {
        "note": "rewritten note",
        "feedback": "💬 Feedback: <one concise educational tip>"
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

    // 🔍 Some versions of the API return output in nested fields
    let text =
      data?.output_text ||
      data?.output?.[0]?.content?.[0]?.text?.value ||
      data?.output?.[0]?.content?.[0]?.text ||
      "";

    // ✅ Try to parse JSON
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      // Fallback: extract manually if the model didn’t return pure JSON
      const [notePart, ...rest] = text.split("💬 Feedback:");
      payload = {
        note: notePart?.trim() || "No note returned.",
        feedback: rest.length
          ? "💬 Feedback:" + rest.join("💬 Feedback:").trim()
          : "💬 Feedback: Keep notes objective and resident-focused."
      };
    }

    // Ensure proper defaults
    if (!payload.note) payload.note = "No note returned.";
    if (!payload.feedback) payload.feedback = "💬 Feedback: Keep notes objective and resident-focused.";

    return res.status(200).json(payload);
  } catch (err) {
    return res.status(500).json({ error: `Server error: ${err?.message || err}` });
  }
}
