// /api/chat.js
import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { input } = req.body || {};
    if (!input || typeof input !== "string" || !input.trim()) {
      return res.status(400).json({ error: "Missing 'input' text." });
    }

    const system = `
You are an AI assistant trained on Alberta Health Services (AHS) nursing documentation principles.
Your goals:
- Encourage objective, factual charting (who/what/when/where), resident response, interventions, safety, and notifications.
- Maintain professional, concise tone (avoid judgement/opinion).
- Provide educational feedback with bullet points that include AHS-aligned standards.
- Create a realistic example note that models excellent documentation. No placeholders like [detail]; insert concrete, likely examples (e.g., duration, % intake, behaviours, pain scores, assistance level, mobility aids, safety checks, notifications).
`;

    const user = `
Staff input (brief): """${input.trim()}"""

Return strict JSON matching exactly:
{
  "feedback": "string with a short intro line followed by bullet points",
  "example": "string with a realistic example clinical note (1–3 sentences)"
}

Requirements:
1) FEEDBACK:
   - Start with one sentence summarizing what to improve.
   - Then add 5–8 concise bullet points that teach *what to include* next time.
   - Include AHS-aligned standards as bullets, phrased plainly (e.g., "Focused & objective facts", "Accurate & complete", "Concise & clinically relevant", "Timely entry", "Safety & follow-up actions documented").
   - Also include situational bullets such as:
     - timeframes/duration; specific measurable details (e.g., 75% intake, 10/10 pain -> 6/10 after PRN);
     - resident response to care/education; risks/safety measures; persons notified (RN/LPN/MD/family) with time;
     - refusals with alternatives offered and outcome; interventions and evaluation.

2) EXAMPLE:
   - 1–3 sentences, objective and realistic for assisted-living/LTC.
   - Insert concrete examples (duration, percentages, assistance level, observable behaviour, mobility device, safety checks).
   - No placeholders like [specific detail]; write actual content that illustrates what's expected.
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
      feedback: data.feedback || "",
      example: data.example || ""
    });
  } catch (err) {
    console.error("API error:", err);
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
}
