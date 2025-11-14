// backend/routes/generate.js
const express = require("express");
const OpenAI = require("openai");

const router = express.Router();

// Make sure OPENAI_API_KEY is set in your environment (Vercel project settings)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.post("/generate", async (req, res) => {
  try {
    const {
      title,
      notes,
      selectedTypes,
      publicSearch,
      text,
      previous, // <-- matches what your frontend sends
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
unless the user explicitly asks for a major restructure.
`.trim();

    const isRewrite =
      typeof previous === "string" && previous.trim().length > 0;

    let messages;

    if (isRewrite) {
      // 🔁 REWRITE PATH – treat "previous" as the base draft to tweak
      messages = [
        {
          role: "system",
          content: baseSystemPrompt,
        },
        {
          role: "user",
          content: `You are revising an existing draft. Make **targeted edits only**, unless the instructions explicitly request broader changes.

Goals:
- Preserve overall structure, sections, and key points of the existing draft.
- Improve clarity, tone, flow, and correctness.
- Apply the rewrite instructions.
- Use the source material only to refine details or correct facts, not to rewrite from scratch.

Output types: ${typesLabel}
Title: ${title || "(untitled)"}
Include public domain search context: ${
            publicSearch
              ? "Yes (already applied on backend if enabled)"
              : "No – rely only on provided sources."
          }
`,
        },
        {
          role: "user",
          content: `REWRITE INSTRUCTIONS:\n${
            notes || "(no additional instructions provided)"
          }`,
        },
        {
          role: "user",
          content: `EXISTING DRAFT (KEEP STRUCTURE, TWEAK CONTENT):\n\n${
            previous || ""
          }`,
        },
        {
          role: "user",
          content: `SOURCE MATERIAL (REFERENCE ONLY, DO NOT REPLACE DRAFT):\n\n${
            text || "(no extra source material provided)"
          }`,
        },
      ];
    } else {
      // 🆕 GENERATE PATH – fresh draft from sources
      messages = [
        {
          role: "system",
          content: baseSystemPrompt,
        },
        {
          role: "user",
          content: `You are creating a **new draft**.

Output types: ${typesLabel}
Title: ${title || "(untitled)"}
Include public domain search context: ${
            publicSearch
              ? "Yes (already applied on backend if enabled)"
              : "No – rely only on provided sources."
          }

Notes / constraints:
${notes || "(none provided)"}
`,
        },
        {
          role: "user",
          content: `SOURCE MATERIAL (PRIMARY BASIS FOR THE DRAFT):\n\n${
            text || "(no source text provided)"
          }`,
        },
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

    res.json({
      mode: isRewrite ? "rewrite" : "generate",
      output,
    });
  } catch (err) {
    console.error("Error in /api/generate:", err);
    res.status(500).json({
      error: "Error generating content",
      details: err?.message ?? String(err),
    });
  }
});

module.exports = router;
