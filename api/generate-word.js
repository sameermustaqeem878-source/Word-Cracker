const DIFFICULTY_META = {
  easy:   { label: "Easy",   rule: "exactly 4 letters, a simple everyday word a child would know", minLen: 4, maxLen: 4, temperature: 1.3 },
  medium: { label: "Medium", rule: "5 or 6 letters, a common word most adults would recognize",     minLen: 5, maxLen: 6, temperature: 1.3 },
  hard:   { label: "Hard",   rule: "7 or more letters, a more advanced but still real, well-known word", minLen: 7, maxLen: 99, temperature: 1.3 },
  impossible: {
    label: "Unthinkable",
    rule: "more than 15 letters long (16 or more — count the letters carefully before answering), a real English word even if obscure, technical, or rarely used",
    minLen: 16, maxLen: 99, temperature: 0.6,
    examples: "MISUNDERSTANDING (16), INCOMPREHENSIBLE (17), UNCONSTITUTIONALLY (18), MULTIDIMENSIONAL (16), INSTITUTIONALIZATION (20)"
  }
};

const GEMINI_MODELS = ["gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-3.8-flash"];
const MAX_ATTEMPTS = 6;

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
    return res.status(400).json({ error: "difficulty must be one of: easy, medium, hard, impossible" });
  }

  const avoidLine = avoidWords.length
    ? `- Do NOT use any of these words, they were already used recently: ${avoidWords.join(", ")}.\n`
    : "";
  const themeLine = theme
    ? `- Loosely base the word on this theme if you can: "${theme}". A reasonable fit is enough, don't force it.\n`
    : "";
  const examplesLine = meta.examples
    ? `- For reference, these are the right length and style (do not just reuse one, letter-count shown in parentheses): ${meta.examples}.\n`
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
    examplesLine +
    "- Pick something varied and not the most obvious first choice — surprise the player.\n" +
    "- Before answering, silently count the letters in your chosen word and confirm it fits the required length.\n" +
    "Reply with ONLY raw JSON in this exact shape and nothing else — no markdown fences, no commentary, no extra keys:\n" +
    '{"word":"EXAMPLE","hint":"A one sentence clue."}';

  let lastError = "Unknown error";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const model = GEMINI_MODELS[attempt % GEMINI_MODELS.length];
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: meta.temperature,
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

      if (!response.ok) {
        const errText = await response.text();
        console.error(`Gemini API error on ${model} (attempt ${attempt + 1}):`, response.status, errText);
        lastError = "Gemini API error " + response.status;
        // Auth/bad-request errors won't be fixed by retrying — stop immediately.
        if (response.status !== 503 && response.status !== 404) break;
        continue;
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
        if (!match) { lastError = "Model did not return JSON"; continue; }
        parsed = JSON.parse(match[0]);
      }

      const word = (parsed.word || "").toUpperCase().replace(/[^A-Z]/g, "");
      const hint = (parsed.hint || "").trim();

      if (!word || !hint) { lastError = "Model returned an empty word or hint"; continue; }
      if (word.length < meta.minLen || word.length > meta.maxLen) {
        console.error(`Wrong length on attempt ${attempt + 1}: ${word} (${word.length} letters, needed ${meta.minLen}-${meta.maxLen})`);
        lastError = `Model returned a word of the wrong length: ${word}`;
        continue; // try again rather than giving up — this is the case that was failing for Unthinkable mode
      }

      return res.status(200).json({ word, hint });
    } catch (err) {
      console.error(`generate-word attempt ${attempt + 1} failed:`, err.message);
      lastError = err.message;
    }
  }

  res.status(502).json({ error: "Couldn't generate a valid word after several attempts: " + lastError });
}