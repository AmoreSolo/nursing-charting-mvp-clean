// /api/chat.js
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { input } = req.body || {};
    if (!input || typeof input !== "string" || !input.trim()) {
      return res.status(400).json({ error: "Missing 'input' text." });
    }

    // One-shot JSON instruction to produce 3 fields
    const system = `
You are a nursing documentation assistant for assisted-living/continuing-care.
Return concise, objective notes in professional tone (no diagnosis, no assumptions).
Use Canadian/Alberta nomenclature (AHS), 24-hour time, and resident-focused language.
Never include identifiers (names/room #).`;

    const user = `
Brief input: """${input.trim()}"""

Task:
1) Rewrite as a clean, objective nursing chart note (1–2 sentences max).
2) Provide a single educator feedback point telling the author what detail is missing or how to improve (AHS standards: facts, time, action, response, safety).
3) Based on that feedback, provide one improved example note that shows what to include (use bracket placeholders like [specific symptom] if facts are unknown).

Return strictly as JSON with keys:
{
  "note": "...",
  "feedback": "...",
  "example": "..."
}
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    });

    // Parse JSON result safely
    const raw = completion.choices?.[0]?.message?.content || "{}";
    let data;
    try { data = JSON.parse(raw); } catch { data = {}; }

    return res.status(200).json({
      note: data.note || "",
      feedback: data.feedback || "",
      example: data.example || ""
    });

  } catch (err) {
    console.error("API error:", err);
    const message = err?.response?.data?.error?.message || err.message || "Unknown error";
    return res.status(500).json({ error: message });
  }
}
