import OpenAI from "openai";

export const config = {
  runtime: "nodejs18.x",
};

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { note } = req.body || {};
    if (!note || typeof note !== "string") {
      return res.status(400).json({ error: "Missing 'note' (string) in body" });
    }

    // System prompt: educator voice + AHS-aligned guidance + strict JSON-only output
    const system = `
You are a Clinical Documentation Educator for continuing care in Alberta.
Your job: (1) critique the nurse's note against **AHS Nursing Documentation Standards**
and (2) provide a realistic, objective **Suggested Example** note that demonstrates
the missing details. Be specific. No placeholders.

Tone: supportive, mentoring, professional. Assume this is for audit-readiness
and interdisciplinary communication.

AHS-aligned teaching anchors (weave into feedback where relevant):
- Objective, factual, resident-focused language
- Required assessment details (site, size, color/characteristics, drainage/odor, associated symptoms, onset/time)
- Interventions & resident response
- Communication/escalation (who was notified, when)
- Timeliness and legibility
- Avoid assumptions, opinions, vague terms; use measurable language

OUTPUT RULES (VERY IMPORTANT):
Return ONLY a single JSON object with these keys:
{
  "educator_feedback_html": string,   // HTML string: short intro paragraph + <ul><li>…</li></ul> + a final line noting “AHS Nursing Documentation Standards”
  "suggested_example": string         // 2–5 sentences, objective, specific, realistic. No placeholders like [xx] or {{xx}}.
}
Do not include any extra text outside the JSON.
`;

    const user = `
Nurse's quick note (free text):
"""
${note}
"""
`;

    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    // Try to parse the model output as JSON safely
    const raw = response.output_text || "";
    const jsonText =
      // If the model wrapped it in code fences, strip them
      raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
    let data;
    try {
      data = JSON.parse(jsonText);
    } catch {
      // Fallback: attempt to extract the first {...} block
      const m = jsonText.match(/\{[\s\S]*\}/);
      if (!m) {
        throw new Error("Model did not return valid JSON.");
      }
      data = JSON.parse(m[0]);
    }

    const { educator_feedback_html, suggested_example } = data || {};
    if (!educator_feedback_html || !suggested_example) {
      return res.status(502).json({
        error: "Upstream returned incomplete data.",
        raw: jsonText,
      });
    }

    return res.status(200).json({
      feedbackHtml: educator_feedback_html,
      example: suggested_example,
    });
  } catch (err) {
    console.error("API /api/chat error:", err);
    return res
      .status(500)
      .json({ error: "Server error", detail: String(err?.message || err) });
  }
}
