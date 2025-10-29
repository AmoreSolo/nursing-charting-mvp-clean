// /api/chat.js
// Serverless endpoint for Nursing Charting MVP + Educator Feedback mode.
// Uses OpenAI Responses API via fetch (no npm installs required).

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

    // Build the prompt with strict rules
    const systemPrompt = [
      "You are a nursing documentation assistant **and** clinical educator.",
      "TASK 1 (Note): Rewrite the user's quick note into a clear, objective,",
      "concise **nursing chart entry** for a **resident** in assisted living.",
      "Use neutral clinical language, **always use the word 'resident' (not 'patient')**,",
      "avoid subjective judgments, no diagnoses, no treatment plans, no abbreviations that are non-standard.",
      "Prefer short, complete sentences or a brief paragraph. Keep it factual.",
      "",
      "TASK 2 (Feedback): Provide one short teaching tip (1–2 sentences) that explains",
      "why the rewrite is appropriate (documentation best practice).",
      "Begin the feedback line with: \"💬 Feedback:\"",
    ].join(" ");

    // Ask for JSON output to make the frontend simple
    const jsonSchema = {
      name: "NursingNoteWithFeedback",
      schema: {
        type: "object",
        properties: {
          note: { type: "string" },
          feedback: { type: "string" }
        },
        required: ["note", "feedback"],
        additionalProperties: false
      },
      strict: true
    };

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
        response_format: { type: "json_schema", json_schema: jsonSchema },
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      return res.status(500).json({ error: `Upstream error: ${errText || response.statusText}` });
    }

    const data = await response.json();

    // Responses API: pull assistant text safely
    // Expecting JSON string as the first content piece.
    let text =
      data?.output?.[0]?.content?.[0]?.text ??
      data?.output_text ??
      "";

    // Parse the JSON string into an object
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      // Fallback if the model didn’t return strict JSON for some reason
      payload = { note: text || "No note returned.", feedback: "💬 Feedback: Not available." };
    }

    // Final safety: force “resident” wording
    if (payload?.note) {
      payload.note = payload.note.replace(/\b[Pp]atient\b/g, "resident");
    }

    return res.status(200).json(payload);
  } catch (err) {
    return res.status(500).json({ error: `Server error: ${err?.message || err}` });
  }
}
