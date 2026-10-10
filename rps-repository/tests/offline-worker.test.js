import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';

// Like the HTTP tests, this exercises the emitted production files. Build first.
const workerSource = await readFile(new URL('../dist/sw.js', import.meta.url), 'utf8');
const gameHtml = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const galleryHtml = await readFile(new URL('../dist/proof/index.html', import.meta.url), 'utf8');

function workerFixture() {
  const origin = 'https://trinity.example';
  const handlers = new Map(), stored = new Map(), writes = [], network = [];
  let offline = false, entry, root;
  const cacheKey = request => new URL(typeof request === 'string' ? request : request.url, origin).href;
  const cache = {
    async put(request, response) {
      const key = cacheKey(request);
      // Cache.put consumes its response. Native Responses also catch invalid
      // body reuse rather than letting this fixture silently reuse a string.
      const bytes = await response.arrayBuffer();
      stored.set(key, new Response(bytes, { status: response.status, headers: response.headers }));
      writes.push(key);
    },
    async match(request) { return stored.get(cacheKey(request))?.clone(); },
  };
  const context = createContext({
    URL,
    self: { location: { origin }, addEventListener(type, listener) { handlers.set(type, listener); } },
    caches: { async open() { return cache; }, async match(request) { return cache.match(request); } },
    async fetch(request) {
      network.push(request.url);
      if (offline) throw new TypeError('Network unavailable');
      const path = new URL(request.url).pathname;
      const html = path === root || path === entry ? gameHtml : path === `${root}proof/index.html` ? galleryHtml : null;
      return new Response(html ?? 'Not found', { status: html === null ? 404 : 200, headers: { 'Content-Type': 'text/html' } });
    },
  });
  runInContext(workerSource, context);
  entry = runInContext('ENTRY', context);
  assert.ok(entry.endsWith('/index.html'), 'worker entry is the built game document');
  root = entry.slice(0, -'index.html'.length);
  stored.set(cacheKey(entry), new Response(gameHtml, { headers: { 'Content-Type': 'text/html' } }));
  assert.ok(handlers.has('fetch'));
  return {
    entry, root, writes, network,
    setOffline(value) { offline = value; },
    async cachedEntry() { return (await cache.match(entry)).text(); },
    async navigate(path) {
      const waits = [];
      let responsePromise;
      // Node Request cannot use mode "navigate". These are the exact request
      // fields read by the production fetch handler for a browser navigation.
      handlers.get('fetch')({
        request: { url: new URL(path, origin).href, method: 'GET', mode: 'navigate' },
        respondWith(promise) { responsePromise = promise; },
        waitUntil(promise) { waits.push(promise); },
      });
      assert.ok(responsePromise, 'worker handles the same-origin navigation');
      const response = await responsePromise;
      await Promise.all(waits); // Include cache writes after returning the page.
      return response.text();
    },
  };
}

test('production worker refreshes its game entry for online root and index navigations', async () => {
  assert.match(gameHtml, /id="app"/, 'built entry contains the React game mount');
  for (const target of ['root', 'index', 'query']) {
    const fixture = workerFixture();
    const path = target === 'index' ? fixture.entry : target === 'query' ? `${fixture.root}?from=gallery` : fixture.root;
    assert.equal(await fixture.navigate(path), gameHtml);
    assert.equal(await fixture.cachedEntry(), gameHtml);
    assert.deepEqual(fixture.writes, [new URL(fixture.entry, 'https://trinity.example').href]);
    assert.equal(fixture.network.length, 1);
  }
});

test('successful gallery navigation cannot overwrite the cached production game entry', async () => {
  assert.notEqual(galleryHtml, gameHtml, 'regression uses a separate emitted HTML page');
  const fixture = workerFixture();
  const entryBefore = await fixture.cachedEntry();
  assert.equal(await fixture.navigate(`${fixture.root}proof/index.html`), galleryHtml);
  assert.equal(await fixture.cachedEntry(), entryBefore, 'gallery HTML must never replace the offline game');
  assert.deepEqual(fixture.writes, []);
});

test('visiting the gallery online preserves an offline reload of the production game root', async () => {
  const fixture = workerFixture();
  await fixture.navigate(fixture.root);
  await fixture.navigate(`${fixture.root}proof/index.html`);
  fixture.setOffline(true);
  assert.equal(await fixture.navigate(fixture.root), gameHtml, 'offline root must return the game, after any gallery visit');
  assert.match(await fixture.cachedEntry(), /id="app"/);
});
