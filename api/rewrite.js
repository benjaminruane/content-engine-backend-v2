// api/rewrite.js

import OpenAI from "openai";
import {
  PROMPT_RECIPES,
  SCENARIO_INSTRUCTIONS,
} from "../helpers/promptRecipes.js";

import { fillTemplate } from "../helpers/template.js";
import {
  DEFAULT_STYLE_GUIDE,
  SAMPLE_CLIENT_STYLE_GUIDE,
} from "../helpers/styleGuides.js";
import { scoreOutput } from "../helpers/scoring.js";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  // --- CORS headers ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      text,                 // the draft to improve
      notes,                // rewrite instructions
      outputType,           // "press_release", "linkedin_post", etc.
      workspaceMode = "generic",
      scenario = "default",
      modelId = "gpt-4o-mini",
      temperature = 0.3,
      maxTokens = 2048,
    } = req.body || {};

    if (!text) {
      return res.status(400).json({ error: "Missing draft text to rewrite" });
    }
    if (!outputType) {
      return res.status(400).json({ error: "Missing outputType" });
    }

    // Pick style guide
    const styleGuide =
      workspaceMode === "client"
        ? SAMPLE_CLIENT_STYLE_GUIDE
        : DEFAULT_STYLE_GUIDE;

    // Pick template pack (generic or client)
    const pack =
      PROMPT_RECIPES[workspaceMode] || PROMPT_RECIPES.generic;

    // Pick the generation template for this type
    const originalTemplate =
      pack.templates[outputType] ||
      pack.templates.press_release;

    // Turn the generation template into a rewrite template
        const rewriteTemplate = `
You are to improve and refine an existing draft of a {{outputTypeLabel}}.

Scenario: {{scenario}}

Rewrite Requirements:
- Maintain the intent and meaning of the draft.
- Improve clarity, structure, and tone.
- Follow the style guide exactly.
- Respect all user rewrite notes:
  "{{notes}}"

Here is the draft to rewrite:
===================
{{text}}
===================

Produce a refined, professional version of the draft.
`;

    const userPromptBase = fillTemplate(rewriteTemplate, {
      text,
      notes,
      scenario,
      outputTypeLabel: outputType.replace("_", " "),
    });

    const scenarioExtra =
      SCENARIO_INSTRUCTIONS[scenario] || SCENARIO_INSTRUCTIONS.default;

    const userPrompt =
      userPromptBase +
      "\n\nScenario-specific guidance:\n" +
      scenarioExtra.trim() +
      "\n";

    const systemPrompt =
      pack.systemPrompt + "\n\nSTYLE GUIDE:\n" + styleGuide;

    const completion = await client.chat.completions.create({
      model: modelId,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });


        const rewritten =
      completion.choices?.[0]?.message?.content?.trim() ||
      "[No content returned]";

    // --- New: score the rewritten output ---
    const scoring = await scoreOutput({
      outputText: rewritten,
      scenario,
      outputType,
      workspaceMode,
    });

    return res.status(200).json({
      outputs: [
        {
          outputType,
          text: rewritten,
          score: scoring.overall,
          metrics: {
            clarity: scoring.clarity,
            accuracy: scoring.accuracy,
            tone: scoring.tone,
            structure: scoring.structure,
          },
        },
      ],
      workspaceMode,
      scenario,
    });

  } catch (err) {
    console.error("Error in /api/rewrite:", err);
    return res.status(500).json({
      error: "Internal server error",
      detail: err.message || String(err),
    });
  }
}
