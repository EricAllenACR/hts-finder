export const config = { runtime: "edge" };

export default async function handler(req) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") return new Response("", { status: 200, headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: "GEMINI_API_KEY not set on server." }), { status: 500, headers });

  let prompt, systemPrompt;
  try {
    ({ prompt, systemPrompt } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
  }

  if (!prompt) return new Response(JSON.stringify({ error: "Missing prompt" }), { status: 400, headers });

  const models = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-pro"];

  for (const model of models) {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt || "" }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
        }),
      }
    );

    if (geminiRes.status === 404) continue;

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return new Response(JSON.stringify({ error: `Gemini error (${model}): ${errText}` }), { status: 502, headers });
    }

    const data = await geminiRes.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return new Response(JSON.stringify({ text }), { status: 200, headers });
  }

  return new Response(JSON.stringify({ error: "No working Gemini model found. Check your API key at aistudio.google.com." }), { status: 502, headers });
}
