const DIFFICULTY_META = {
  easy:   { label: "Easy",   rule: "exactly 4 letters, a simple everyday word a child would know", minLen: 4, maxLen: 4 },
  medium: { label: "Medium", rule: "5 or 6 letters, a common word most adults would recognize",     minLen: 5, maxLen: 6 },
  hard:   { label: "Hard",   rule: "7 or more letters, a more advanced but still real, well-known word", minLen: 7, maxLen: 99 }
};

const GEMINI_MODELS = ["gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-3.8-flash"];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server is missing GEMINI_API_KEY. Add it in Vercel → Project → Settings → Environment Variables." });
  }

  const difficulty = req.body?.difficulty;
  const avoidWords = Array.isArray(req.body?.avoidWords) ? req.body.avoidWords.slice(0, 20) : [];
  const theme = typeof req.body?.theme === "string" ? req.body.theme.slice(0, 40) : "";
  const meta = DIFFICULTY_META[difficulty];
  if (!meta) {
    return res.status(400).json({ error: "difficulty must be one of: easy, medium, hard" });
  }

  const avoidLine = avoidWords.length
    ? `- Do NOT use any of these words, they were already used recently: ${avoidWords.join(", ")}.\n`
    : "";
  const themeLine = theme
    ? `- Loosely base the word on this theme if you can: "${theme}". A reasonable fit is enough, don't force it.\n`
    : "";

  const prompt =
    "Generate one single-word English word-guessing puzzle for a game like Wordle.\n" +
    `Difficulty: ${meta.label} — the word must be ${meta.rule}.\n` +
    "Rules:\n" +
    "- The word must be a real, common English dictionary word.\n" +
    "- Only letters A-Z, no proper nouns, no hyphens or spaces, no abbreviations.\n" +
    "- Provide one clear, single-sentence hint describing the word without using the word itself, any part of it, or an obvious rhyme.\n" +
    avoidLine +
    themeLine +
    "- Pick something varied and not the most obvious first choice — surprise the player.\n" +
    "Reply with ONLY raw JSON in this exact shape and nothing else — no markdown fences, no commentary, no extra keys:\n" +
    '{"word":"EXAMPLE","hint":"A one sentence clue."}';

  try {
    let response, lastStatus;
    for (const model of GEMINI_MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 1.3,
            responseSchema: {
              type: "OBJECT",
              properties: {
                word: { type: "STRING" },
                hint: { type: "STRING" }
              },
              required: ["word", "hint"]
            },
            maxOutputTokens: 200
          }
        })
      });

      if (response.ok) break;
      lastStatus = response.status;
      const errText = await response.text();
      console.error(`Gemini API error on ${model}:`, response.status, errText);
      // 503 = overloaded right now, 404 = model no longer available — both mean
      // "try the next model in the list." Any other error won't be fixed by
      // switching models (e.g. a bad key), so stop looping.
      if (response.status !== 503 && response.status !== 404) break;
    }

    if (!response.ok) {
      return res.status(502).json({ error: "Gemini API error " + (lastStatus || response.status) });
    }

    const data = await response.json();
    const text = (data.candidates?.[0]?.content?.parts || [])
      .map((p) => p.text || "")
      .join("")
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Model did not return JSON: " + text.slice(0, 120));
      parsed = JSON.parse(match[0]);
    }

    const word = (parsed.word || "").toUpperCase().replace(/[^A-Z]/g, "");
    const hint = (parsed.hint || "").trim();

    if (!word || !hint) throw new Error("Model returned an empty word or hint");
    if (word.length < meta.minLen || word.length > meta.maxLen) {
      throw new Error(`Model returned a word of the wrong length: ${word}`);
    }

    res.status(200).json({ word, hint });
  } catch (err) {
    console.error("generate-word failed:", err.message);
    res.status(500).json({ error: err.message });
  }
}