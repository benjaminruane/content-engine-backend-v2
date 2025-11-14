import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      mode = "generate",
      title,
      notes,
      selectedTypes,
      publicSearch,
      text,
      previousContent,
      modelId = "gpt-4o-mini",
      temperature = 0.3,
      maxTokens = 2048,
    } = req.body;

    const typesLabel =
      Array.isArray(selectedTypes) && selectedTypes.length
        ? selectedTypes.join(", ")
        : "general investment content";

    const baseSystemPrompt = `
You are a highly skilled investment and private markets content writer.

You produce clear, concise, professional writing suitable for:
- investor reporting commentary
- investment notes
- press releases
- LinkedIn posts

You follow the user's notes and respect the chosen output types.
When rewriting, you **preserve the structure and core points of the previous draft**
unless the user explicitly asks for major restructuring.
`.trim();

    let messages = [];

    if (mode === "rewrite" && previousContent) {
      // --- REWRITE PATH ---
      messages = [
        {
          role: "system",
          content: baseSystemPrompt,
        },
        {
          role: "user",
          content: `You are revising an existing draft. Make targeted edits only.

Goals:
- Preserve the existing structure
- Keep the major points and order
- Improve clarity, accuracy, tone, and flow
- Apply the rewrite instructions
- Use source material only to refine details, not to replace the draft

Output types: ${typesLabel}
Title: ${title || "(untitled)"}
Public domain search: ${publicSearch ? "Enabled" : "Disabled"}
`,
        },
        {
          role: "user",
          content: `REWRITE INSTRUCTIONS:\n${notes || "(none provided)"}`,
        },
        {
          role: "user",
          content: `EXISTING DRAFT:\n\n${previousContent}`,
        },
        {
          role: "user",
          content: `SOURCE MATERIAL (REFERENCE ONLY):\n\n${text || "(none)"}`
        }
      ];

    } else {
      // --- GENERATE PATH ---
      messages = [
        {
          role: "system",
          content: baseSystemPrompt,
        },
        {
          role: "user",
          content: `Create a new draft.

Output types: ${typesLabel}
Title: ${title || "(untitled)"}
Public domain search: ${publicSearch ? "Enabled" : "Disabled"}

Notes:
${notes || "(none)"}
`,
        },
        {
          role: "user",
          content: `SOURCE MATERIAL:\n\n${text || "(none provided)"}`
        }
      ];
    }

    const completion = await openai.chat.completions.create({
      model: modelId,
      temperature,
      max_tokens: maxTokens,
      messages,
    });

    const output =
      completion.choices?.[0]?.message?.content?.trim() ||
      "[No content generated]";

    return res.status(200).json({ mode, output });

  } catch (err) {
    console.error("Error in /api/generate:", err);
    return res.status(500).json({
      error: "Error generating content",
      details: err?.message || String(err),
    });
  }
}
