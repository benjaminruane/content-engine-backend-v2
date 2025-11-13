// ---------- Output Type Guidelines ----------
const OUTPUT_TYPE_PROMPTS = {
  investor: `Audience: existing investors (LPs). Tone: concise, factual, professional. Avoid hype.
Include: period performance, drivers, material changes, portfolio actions, risk/mitigants, cautious outlook.`,

  detailed: `Audience: existing investors and internal stakeholders. Tone: thorough, neutral, compliance-safe.
Include: context, factual analysis, key metrics, caveats, assumptions.`,

  press: `Audience: media & public. Tone: clear, objective, third-person. Avoid forward-looking promises.
Include: headline, dateline, who/what/when/where/why, quotes, boilerplate.`,

  linkedin: `Audience: professional network. Tone: crisp, accessible, compliance-aware.
Include: short hook, impact bullets, link, hashtags.`
};

// ---------- Prompt Builder ----------
function buildPrompt({ title, selectedTypes, notes, publicSearch, text }) {
  const inlineSources = String(text || "").slice(0, 12000); // safety cap

  const sections = (selectedTypes || []).map((t) => {
    const guide = OUTPUT_TYPE_PROMPTS[t] || "(no guide available for this type)";
    return `### ${t}
Guidelines:
${guide}

Draft (from sources):`;
  }).join("\n\n");

  return `Title: ${title || "Untitled"}
Public Domain Search: ${publicSearch ? "ON" : "OFF"}

User notes:
${notes || "(none)"}

Combined Sources (files + URLs merged):
${inlineSources || "(no source text provided)"}

${sections}`;
}

// ---------- Call OpenAI ----------
async function callOpenAI({ modelId, temperature, maxTokens, prompt }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  // Strip "openai:" prefix
  const model = (String(modelId).replace(/^openai:/, "")) || "gpt-4o-mini";

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: typeof temperature === "number" ? temperature : 0.3,
      max_tokens: typeof maxTokens === "number" ? maxTokens : 1200,
      messages: [
        {
          role: "system",
          content: "You are a factual, compliance-safe assistant that only writes from provided sources."
        },
        { role: "user", content: prompt }
      ]
    })
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`OpenAI API error: ${resp.status} ${txt}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "";
}

// ---------- API Route ----------
export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      modelId,
      temperature,
      maxTokens,
      publicSearch,
      title,
      notes,
      selectedTypes,
      text
    } = req.body || {};

    const prompt = buildPrompt({
      title,
      selectedTypes,
      notes,
      publicSearch,
      text
    });

    const output = await callOpenAI({ modelId, temperature, maxTokens, prompt });

    return res.status(200).json({ output });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
