// helpers/promptRecipes.js

export const OUTPUT_TYPES = {
  press_release: "press_release",
  investment_note: "investment_note",
  linkedin_post: "linkedin_post",
};

const baseSystemPrompt = `
You are an expert investment writer producing institutional-grade content.
Follow the provided style guide exactly.
Use a clear, structured format and avoid marketing fluff.
`;

const baseTemplate = `
Write a {{outputTypeLabel}} for the scenario "{{scenario}}".

Title:
{{title}}

Notes from the user (constraints, must-include points):
{{notes}}

Source material to base your writing on:
{{text}}

Instructions:
- Follow the style guide carefully.
- Do not invent facts; rely on the source material.
- Use clear structure, headings, and short paragraphs.
`;

export const PROMPT_RECIPES = {
  generic: {
    systemPrompt: baseSystemPrompt,
    templates: {
      press_release: baseTemplate.replace("{{outputTypeLabel}}", "press release"),
      investment_note: baseTemplate.replace("{{outputTypeLabel}}", "investment note"),
      linkedin_post: baseTemplate.replace("{{outputTypeLabel}}", "LinkedIn post"),
    },
  },
  client: {
    systemPrompt: baseSystemPrompt,
    templates: {
      press_release: baseTemplate.replace(
        "{{outputTypeLabel}}",
        "client-branded press release"
      ),
      investment_note: baseTemplate.replace(
        "{{outputTypeLabel}}",
        "client-branded investment note"
      ),
      linkedin_post: baseTemplate.replace(
        "{{outputTypeLabel}}",
        "client-branded LinkedIn post"
      ),
    },
  },
};
