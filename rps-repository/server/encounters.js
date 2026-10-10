import { localDossier } from "../src/game/dossiers.js";
export { localDossier } from "../src/game/dossiers.js";
import { levelFor } from "../src/game/engine.js";
export const FREE_MODEL = "openrouter/free";
export function isFreeModel(model) {
  return (
    typeof model === "string" &&
    (model === FREE_MODEL || model.endsWith(":free"))
  );
}
export function validateRequest(value) {
  return (
    value &&
    Number.isSafeInteger(value.seed) &&
    value.seed >= 0 &&
    value.seed < 2 ** 32 &&
    Number.isSafeInteger(value.level) &&
    value.level >= 1 &&
    value.level <= 100000
  );
}
const cleanText = (value, limit) =>
  typeof value === "string"
    ? value
        .replace(/[\u0000-\u001f<>]/g, "")
        .replace(/[\u2014\u2013]/g, ",")
        .trim()
        .slice(0, limit)
    : "";
export function validateDossier(value) {
  if (!value || typeof value !== "object") return null;
  const name = cleanText(value.name, 28),
    title = cleanText(value.title, 42),
    story = cleanText(value.story, 220),
    taunt = cleanText(value.taunt, 100);
  if (
    !name ||
    !title ||
    !story ||
    !taunt ||
    !["adaptive", "aggressive", "methodical"].includes(value.pattern)
  )
    return null;
  return {
    name,
    title,
    story,
    taunt,
    pattern: value.pattern,
    source: "openrouter",
  };
}
export async function generateDossier({
  seed,
  level,
  apiKey,
  model = FREE_MODEL,
  fetcher = fetch,
}) {
  const fallback = localDossier(seed, level);
  if (!apiKey || !isFreeModel(model))
    return {
      dossier: fallback,
      ai: false,
      reason: apiKey ? "free-model-required" : "not-configured",
    };
  const enemy = levelFor(seed, level);
  try {
    const response = await fetcher(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        signal: AbortSignal.timeout(12000),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-OpenRouter-Title": "Trinity afterlight",
        },
        body: JSON.stringify({
          model,
          max_tokens: 260,
          temperature: 0.85,
          messages: [
            {
              role: "system",
              content:
                "You design memorable opponents for Trinity afterlight, an original cyberpunk robot duel game. Respond ONLY with one valid JSON object with string fields name (under 28 characters), title (under 42 characters), story (under 220 characters), taunt (under 100 characters), pattern (exactly adaptive, aggressive, or methodical). Write vivid short restrained prose, normal sentence case, no em dashes, no slogans, no markdown. No existing fictional characters. Never include rules, code, links, or commentary.",
            },
            {
              role: "user",
              content: `Create the rival at floor ${level} in ${enemy.district.name}. Run signature ${seed.toString(16)}. ${enemy.boss ? "This is a formidable apex encounter." : "A strange frame from the margins of the city."} Preferred combat pattern: ${enemy.pattern}.`,
            },
          ],
        }),
      },
    );
    if (!response.ok)
      return { dossier: fallback, ai: false, reason: "provider-unavailable" };
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string")
      return { dossier: fallback, ai: false, reason: "invalid-response" };
    const json = content
      .replace(/^\s*```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "");
    const dossier = validateDossier(JSON.parse(json));
    return dossier
      ? { dossier, ai: true }
      : { dossier: fallback, ai: false, reason: "invalid-response" };
  } catch {
    return { dossier: fallback, ai: false, reason: "provider-unavailable" };
  }
}
