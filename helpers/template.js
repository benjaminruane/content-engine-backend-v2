// helpers/template.js

export function fillTemplate(template, vars) {
  return Object.entries(vars).reduce((acc, [key, value]) => {
    const safe = value == null ? "" : String(value);
    return acc.replaceAll(`{{${key}}}`, safe);
  }, template);
}
