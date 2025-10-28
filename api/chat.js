// api/chat.js
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert nursing documentation assistant. Convert user input into concise, objective, professional nursing charting notes.",
        },
        { role: "user", content: prompt },
      ],
    });

    const output = completion.choices[0].message.content;
    res.status(200).json({ output });
  } catch (error) {
    console.error("API error:", error);
    res.status(500).json({ error: "Server error" });
  }
}
