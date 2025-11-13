// ---------- Output Type Guidelines ----------
const OUTPUT_TYPE_PROMPTS = {
  investor_commentary: `Audience: existing investors (LPs). Tone: concise, factual, professional. Avoid hype.
Include: period performance, drivers, material changes, portfolio actions, risk/mitigants, cautious outlook.`,

  detailed_investor_note: `Audience: existing investors and internal stakeholders. Tone: thorough, neutral, compliance-safe.
Include: context, factual analysis, key metrics, caveats, assumptions.`,

  press_release: `Audience: media & public. Tone: clear, objective, third-person. Avoid forward-looking promises.
Include: headline, dateline, who/what/when/where/why, quotes, boilerplate.`,

  linkedin_post: `Audience: professional network. Tone: crisp, accessible, compliance-aware.
Include: short hook, impact bullets, link, hashtags.`
};

// ---------- Prompt Builder ----------
function buildPrompt({ title, outputTypes, notes, publicSearch, sources, text }) {
  const filesArr = (sources && sources.files) || [];
  const urlsArr = (sources && sources.urls) || [];

  let filesText = filesArr
    .map((f) => `${f.name}:\n${String(f.text || "").slice(0, 3000)}`)
    .join("\n\n");

  let urlsText = urlsArr
    .map((u) => `${u.url}:\n${String(u.text || "").slice(0, 3000)}`)
    .join("\n\n");

  // 🔁 Fallback: if no structured sources but combined text is provided
  if (!filesText && !urlsText && text) {
    filesText = `Combined text:\n${String(text).slice(0, 6000)}`;
  }

  const sections = (outputTypes || [])
    .map((t) => {
      const guide = OUTPUT_TYPE_PROMPTS[t] || "(no guide)";
      return `### ${t}
Guidelines:
${guide}
Draft (from sources):`;
    })
    .join("\n\n");

  const searchInstruction = publicSearch
    ? "You may supplement the sources with your own general/public knowledge when helpful, but you must not contradict the provided sources. If there is a conflict, prefer the sources."
    : "Base your writing strictly and only on the sources below. If information is missing, clearly state that it is not available in the supplied sources rather than guessing.";

  return `Title: ${title || "Untitled"}
Public Domain Search: ${publicSearch ? "ON" : "OFF"}

User notes:
${notes || "(none)"}

Assistant behaviour:
${searchInstruction}

Sources:
${filesText}
${urlsText}

${sections}`;
}

// ---------- System message based on publicSearch ----------
function buildSystemMessage(publicSearch) {
  if (publicSearch) {
    return (
      "You are a factual, compliance-safe assistant. " +
      "You can use both the provided sources and your own general/public-domain knowledge. " +
      "However, you must treat the sources as primary. If your knowledge conflicts with them, trust the sources. " +
      "Do not speculate beyond well-established, non-controversial facts."
    );
  }

  return (
    "You are a factual, compliance-safe assistant. " +
    "Base your answer strictly and only on the provided 'Sources' section. " +
    "If a detail is not present in the sources, say that it is not available in the supplied material. " +
    "Do not invent or infer facts that are not justified by the sources."
  );
}

// ---------- Call OpenAI ----------
async function callOpenAI({
  modelId,
  temperature,
  maxTokens,
  prompt,
  publicSearch
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  // Strip "openai:" prefix if present
  const model = String(modelId || "").replace(/^openai:/, "") || "gpt-4o-mini";

  const systemMessage = buildSystemMessage(publicSearch);

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: typeof temperature === "number" ? temperature : 0.3,
      max_tokens: typeof maxTokens === "number" ? maxTokens : 1200,
      messages: [
        { role: "system", content: systemMessage },
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
      outputTypes,
      selectedTypes,
      title,
      notes,
      sources,
      text
    } = req.body;

    const effectiveOutputTypes = outputTypes || selectedTypes || [];

    const prompt = buildPrompt({
      title,
      outputTypes: effectiveOutputTypes,
      notes,
      publicSearch,
      sources,
      text
    });

    const output = await callOpenAI({
      modelId,
      temperature,
      maxTokens,
      prompt,
      publicSearch
    });

    return res.status(200).json({ output });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
