import test from "node:test";
import assert from "node:assert/strict";
import {
  FREE_MODEL,
  generateDossier,
  isFreeModel,
  localDossier,
  validateDossier,
  validateRequest,
} from "../server/encounters.js";
test("only free model routes are accepted", () => {
  assert.ok(isFreeModel(FREE_MODEL));
  assert.ok(isFreeModel("vendor/model:free"));
  assert.equal(isFreeModel("vendor/paid-model"), false);
});
test("encounter requests bound their inputs", () => {
  assert.ok(validateRequest({ seed: 42, level: 3 }));
  for (const value of [
    { seed: -1, level: 1 },
    { seed: 1, level: 0 },
    { seed: "x", level: 2 },
    { seed: 1, level: 100001 },
  ])
    assert.ok(!validateRequest(value));
});
test("dossiers reject invalid structures and sanitize external text", () => {
  const value = {
    name: "<Test>\u0000",
    title: "A title",
    story: "Words — more words",
    taunt: "A challenge",
    pattern: "adaptive",
  };
  const result = validateDossier(value);
  assert.equal(result.name, "Test");
  assert.equal(result.story, "Words , more words");
  assert.equal(validateDossier({ ...value, pattern: "unknown" }), null);
  assert.equal(validateDossier({}), null);
});
test("missing key and paid model use local encounters without making a request", async () => {
  const fetcher = () => {
    throw new Error("must not fetch");
  };
  const missing = await generateDossier({ seed: 42, level: 1, fetcher });
  assert.equal(missing.ai, false);
  assert.equal(missing.dossier.source, "local");
  const paid = await generateDossier({
    seed: 42,
    level: 1,
    apiKey: "test",
    model: "paid",
    fetcher,
  });
  assert.equal(paid.reason, "free-model-required");
});
test("a valid provider response produces an AI dossier with bounded output", async () => {
  const dossier = localDossier(42, 1);
  let request;
  const fetcher = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(dossier) } }],
      }),
    };
  };
  const result = await generateDossier({
    seed: 42,
    level: 1,
    apiKey: "test-only",
    fetcher,
  });
  assert.ok(result.ai);
  assert.equal(result.dossier.source, "openrouter");
  assert.equal(JSON.parse(request.options.body).model, FREE_MODEL);
  assert.equal(JSON.parse(request.options.body).max_tokens, 260);
});
test("provider errors and malformed output fall back to playable local encounters", async () => {
  for (const fetcher of [
    async () => ({ ok: false }),
    async () => {
      throw new Error("offline");
    },
    async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "not json" } }] }),
    }),
  ]) {
    const result = await generateDossier({
      seed: 42,
      level: 4,
      apiKey: "test-only",
      fetcher,
    });
    assert.equal(result.ai, false);
    assert.equal(result.dossier.source, "local");
  }
});
