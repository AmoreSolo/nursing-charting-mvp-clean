export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = await req.json();
    const prompt = body.prompt;

    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    // Call OpenAI API
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: prompt,
      }),
    });

    const data = await response.json();
    res.status(200).json({ output: data.output_text || data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
}
