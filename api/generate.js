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
function buildPrompt({ title, outputTypes, notes, publicSearch, sources }) {
  const filesText = (sources?.files || [])
    .map(f => `${f.name}:\n${String(f.text || '').slice(0, 3000)}`)
    .join('\n\n');

  const urlsText = (sources?.urls || [])
    .map(u => `${u.url}:\n${String(u.text || '').slice(0, 3000)}`)
    .join('\n\n');

  const sections = (outputTypes || []).map(t => {
    const guide = OUTPUT_TYPE_PROMPTS[t] || '(no guide)';
    return `### ${t}
Guidelines:
${guide}
Draft (from sources):`;
  }).join('\n\n');

  return `Title: ${title || 'Untitled'}
Public Domain Search: ${publicSearch ? 'ON' : 'OFF'}

User notes:
${notes || '(none)'}

Sources:
${filesText}
${urlsText}

${sections || 'No output types selected – outline the key facts from the sources.'}`;
}

// ---------- Call OpenAI ----------
async function callOpenAI({ modelId, temperature, maxTokens, prompt }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  // Strip optional "openai:" prefix from model id
  const model = (String(modelId || '').replace(/^openai:/, '')) || 'gpt-4o-mini';

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: typeof temperature === "number" ? temperature : 0.3,
      max_tokens: typeof maxTokens === "number" ? maxTokens : 1200,
      messages: [
        {
          role: "system",
          content:
            "You are a factual, compliance-safe assistant. " +
            "You MUST base your writing on the provided sources. " +
            "If no sources are present, state that clearly."
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
      // frontend sends `selectedTypes`; we also support `outputTypes` for safety
      selectedTypes,
      outputTypes,
      title,
      notes,
      text
    } = req.body;

    // Wrap the combined text from frontend as a pseudo-"file source"
    const sources = {
      files: [],
      urls: []
    };

    if (typeof text === "string" && text.trim().length > 0) {
      sources.files.push({
        name: "Combined sources (uploads + URLs)",
        text: text.slice(0, 12000) // safety limit
      });
    }

    const finalOutputTypes = outputTypes && outputTypes.length
      ? outputTypes
      : (selectedTypes || []);

    const prompt = buildPrompt({
      title,
      outputTypes: finalOutputTypes,
      notes,
      publicSearch,
      sources
    });

    const output = await callOpenAI({ modelId, temperature, maxTokens, prompt });

    return res.status(200).json({ output });
  } catch (err) {
    console.error("Generate error:", err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}
