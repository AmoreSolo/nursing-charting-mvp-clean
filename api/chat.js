// /api/chat.js
import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { input } = req.body || {};
    if (!input || typeof input !== "string" || !input.trim()) {
      return res.status(400).json({ error: "Missing 'input' text." });
    }

    const system = `
You are an AI assistant trained in Alberta Health Services (AHS) nursing documentation standards.
Your role: transform short nurse inputs into accurate, objective charting and provide educational feedback.

Rules:
- Be concise (1–3 sentences max per note).
- Always focus on observable facts, actions, and resident responses.
- Avoid assumptions, diagnoses, or subjective phrasing.
- Use professional tone and complete sentences.
- Use realistic examples of resident behaviour, engagement, or outcomes (e.g., “smiled and clapped along with peers,” “completed 50% of meal,” “verbalized feeling tired after activity”).
- Avoid vague placeholders like [specific detail]; instead, insert likely realistic examples of what should be documented.
`;

    const user = `
Brief input: """${input.trim()}"""

Your tasks:
1. Rewrite the input into a clear, objective, and audit-ready nursing chart note.
2. Provide one educator feedback comment — what the staff could add or improve (based on AHS documentation standards: FACTS: Focused, Accurate, Concise, Timely, and Safe).
3. Based on your feedback, generate a new "Suggested Example" note that includes **realistic examples** (e.g., specific engagement levels, emotional or physical responses, completion percentages, or follow-up actions).  
   - Use examples consistent with long-term care or assisted living documentation.
   - Do NOT use placeholder brackets (e.g., [specific observation]).
   - Include concrete examples, e.g.:
       ✅ “Resident participated in exercise group for 20 minutes, smiled and followed all movements.”  
       ✅ “Ate approximately 75% of meal, tolerated fluids well.”  
       ✅ “Reported feeling tired after activity; resting in recliner, safety maintained.”  

Output must be valid JSON with this exact format:
{
  "note": "...",
  "feedback": "...",
  "example": "..."
}
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    });

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
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
}
