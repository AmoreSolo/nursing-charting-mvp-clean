import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { input } = req.body || {};
    if (!input || !input.trim()) {
      return res.status(400).json({ error: "Missing 'input'." });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Single-string prompt (works reliably with the Responses API)
    const prompt = `
You are a strict Alberta Health Services (AHS)–compliant nursing documentation coach.
Transform the quick note into:
1) a clear, objective charting NOTE (resident-focused, no diagnosis, no “appears/seems/appearing”, past tense, include only facts observed or stated, avoid subjective language).
2) a brief FEEDBACK section (1–3 concise bullet points about what info is missing to meet AHS expectations and audit readiness).
3) an EXAMPLE note that demonstrates the feedback in practice. If details are missing, use square-bracket placeholders like [time], [site], [medication], [dose], [provider notified] so staff know what to supply.

Rules:
- Keep all content professional and concise.
- Do NOT invent specifics—use [brackets] for unknowns.
- Prefer “Resident” over “patient.”
- Use single paragraph sentences for notes.
- Return ONLY valid JSON with keys: "note", "feedback", "example".
- JSON must be minified (no extra keys, no markdown).

Input note:
"""${input.trim()}"""

Return JSON like:
{"note":"...","feedback":"• point 1\\n• point 2","example":"..."}
`;

    const r = await client.responses.create({
      model: "gpt-4o-mini",
      input: prompt
    });

    const text = (r.output_text || "").trim();

    // Try to parse JSON; fallback to safe empties if parsing fails.
    let payload = { note: "", feedback: "", example: "" };
    try {
      payload = JSON.parse(text);
    } catch {
      // If the model didn't return JSON for some reason
      payload.note = "";
      payload.feedback = "• Unable to parse model response. Please try again.";
      payload.example = "";
    }

    // Final safety: coerce to strings
    const note = String(payload.note || "").trim();
    const feedback = String(payload.feedback || "").trim();
    const example = String(payload.example || "").trim();

    return res.status(200).json({ note, feedback, example });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ error: err?.message || "Server error" });
  }
}
