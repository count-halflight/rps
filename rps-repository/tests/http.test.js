import test from "node:test";
import assert from "node:assert/strict";
import { server } from "../server/index.js";

test("HTTP service preserves offline play and serves the production assets", async (t) => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body, headers = {}) =>
    fetch(`${base}/api/encounter`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body,
    });
  await t.test("health endpoint reports the free-only service", async () => {
    const response = await fetch(`${base}/api/health`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).freeOnly, true);
  });
  await t.test(
    "valid encounters return a bounded dossier and reuse the cache",
    async () => {
      const body = JSON.stringify({ seed: 42, level: 7 });
      const first = await (await post(body)).json();
      const second = await (await post(body)).json();
      assert.equal(typeof first.dossier.name, "string");
      assert.ok(first.dossier.story.length <= 220);
      assert.deepEqual(second, first);
    },
  );
  await t.test("malformed and oversized requests are rejected", async () => {
    assert.equal((await post("no json")).status, 400);
    assert.equal(
      (await post(JSON.stringify({ seed: -1, level: 1 }))).status,
      400,
    );
    assert.equal((await post("x".repeat(1025))).status, 413);
  });
  await t.test(
    "cross-origin requests cannot use the optional generation service",
    async () => {
      assert.equal(
        (
          await post(JSON.stringify({ seed: 42, level: 1 }), {
            Origin: "https://unrelated.example",
          })
        ).status,
        403,
      );
    },
  );
  await t.test(
    "unknown APIs and unsupported methods return the right status",
    async () => {
      assert.equal((await fetch(`${base}/api/missing`)).status, 404);
      assert.equal((await fetch(`${base}/`, { method: "POST" })).status, 405);
      assert.equal((await fetch(`${base}/assets/missing.webp`)).status, 404);
    },
  );
  await t.test(
    "the entry page and model serve correct MIME types, including HEAD",
    async () => {
      const page = await fetch(base);
      assert.equal(page.status, 200);
      assert.match(await page.text(), /Trinity/);
      const model = await fetch(`${base}/models/echo-frame.glb`, {
        method: "HEAD",
      });
      assert.equal(model.status, 200);
      assert.equal(model.headers.get("content-type"), "model/gltf-binary");
      assert.equal(await model.text(), "");
    },
  );
});
