// api/chat.js
import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert nursing documentation assistant. Convert input into concise, objective, and professional nursing charting notes.",
        },
        { role: "user", content: prompt },
      ],
    });

    const output = completion.choices?.[0]?.message?.content || "No response.";
    return res.status(200).json({ output });
  } catch (error) {
    console.error("Server error:", error);

    // Always respond in JSON
    return res.status(500).json({
      error: "Server error",
      details: error?.message || "Unknown error",
    });
  }
}
