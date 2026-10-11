import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import { build } from 'vite';
import offlinePlugin from '../scripts/offline-plugin.mjs';
import { assetUrl } from '../src/game/assets.js';

const modelPath = 'models/echo-human.glb';
const modelBytes = await readFile(new URL('../public/models/echo-human.glb', import.meta.url));
const modelDigest = createHash('sha256').update(modelBytes).digest('hex');
const poseBytes = Buffer.from([0, 1, 2, 127, 255]);
const metadataBytes = Buffer.from(JSON.stringify({ sourceDigest: modelDigest, tier: 'medium' }));
// Exact worker emitted from release 8a253c78c9bf738b97f2244f7f9ab47bc3498607
// with VITE_BASE_PATH=/rps/. Kept as a fixture because CI has a shallow checkout.
const releasedWorker = await readFile(new URL('./fixtures/offline-worker-8a253c7.js', import.meta.url), 'utf8');
const temporaryRoots = [];
after(async () => Promise.all(temporaryRoots.map(root => rm(root, { recursive: true, force: true }))));

async function productionFixture(base) {
  const root = await mkdtemp(resolve(tmpdir(), 'trinity-model-version-'));
  temporaryRoots.push(root);
  const publicDir = resolve(root, 'public');
  const files = ['index.html', 'favicon.svg', 'manifest.webmanifest', 'icons/trinity-192.png',
    'icons/trinity-512.png', 'art/afterlight-cover.png', 'fonts/PirataOne-Regular.ttf',
    modelPath, ...['ronin', 'brawler', 'nyx', 'vex'].map(id => `models/${id}-human.glb`),
    'models/echo-reflections.json', 'models/echo-reflections-medium.bin', 'models/reflections/nested.bin'];
  for (const file of files) {
    const target = resolve(publicDir, file);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file === modelPath ? modelBytes : file === 'models/echo-reflections.json' ? metadataBytes
      : file.endsWith('.bin') ? poseBytes : file === 'index.html' ? '<div id="app">New release</div>' : 'fixture');
  }
  const assetsModule = fileURLToPath(new URL('../src/game/assets.js', import.meta.url));
  const entry = resolve(root, 'entry.js');
  await writeFile(entry, `import {assetUrl} from ${JSON.stringify(assetsModule)}; export const modelUrl=assetUrl(${JSON.stringify(modelPath)}); export const workerUrl=assetUrl('sw.js'); export const poseUrl=assetUrl('models/echo-reflections-medium.bin'); export const metadataUrl=assetUrl('models/echo-reflections.json');`);
  // A tiny real Vite build exercises config-time define replacement and the
  // emitted worker; it never builds/renders the game or touches its dist folder.
  await build({ configFile: false, root, base, logLevel: 'silent', plugins: [offlinePlugin()],
    build: { lib: { entry, formats: ['es'], fileName: () => 'entry.js' } } });
  const output = resolve(root, 'dist');
  const compiled = await import(`data:text/javascript;base64,${(await readFile(resolve(output, 'entry.js'))).toString('base64')}`);
  return { root, output, base, ...compiled, source: await readFile(resolve(output, 'sw.js'), 'utf8') };
}

const builds = new Map();
const fixtureFor = base => {
  if (!builds.has(base)) builds.set(base, productionFixture(base));
  return builds.get(base);
};

function workerFixture(source, base, seeded = []) {
  const origin = 'https://trinity.example', handlers = new Map(), stored = new Map(), network = [], writes = [];
  let offline = false;
  const key = request => new URL(typeof request === 'string' ? request : request.url, origin).href;
  for (const [path, bytes] of seeded) stored.set(key(path), new Response(bytes));
  const fetchNetwork = async request => {
    const url = new URL(key(request)); network.push(url.href);
    if (offline) throw new TypeError('Network unavailable');
    return new Response(url.pathname.endsWith(`/${modelPath}`) ? modelBytes : url.pathname.endsWith('/models/echo-reflections.json') ? metadataBytes
      : url.pathname.endsWith('.bin') ? poseBytes : '<div id="app">New release</div>');
  };
  const cache = {
    async put(request, response) {
      const url = key(request); writes.push(url);
      stored.set(url, new Response(await response.arrayBuffer(), { status: response.status, headers: response.headers }));
    },
    async match(request) { return stored.get(key(request))?.clone(); },
    async addAll(requests) { await Promise.all(requests.map(async request => cache.put(request, await fetchNetwork(request)))); },
  };
  const context = createContext({ URL, Promise, fetch: fetchNetwork,
    self: { location: { origin }, addEventListener(id, handler) { handlers.set(id, handler); }, clients: { async claim() {} } },
    caches: { async open() { return cache; }, async match(request) { return cache.match(request); }, async keys() { return []; }, async delete() { return true; } },
  });
  runInContext(source, context);
  return { network, writes, stored, core: [...runInContext('CORE', context)],
    setOffline(value) { offline = value; },
    async install() { let work; handlers.get('install')({ waitUntil(promise) { work = promise; } }); await work; },
    async request(path, mode = 'cors') {
      let response; const work = [];
      handlers.get('fetch')({ request: { url: key(path), method: 'GET', mode },
        respondWith(promise) { response = promise; }, waitUntil(promise) { work.push(promise); } });
      assert.ok(response, 'same-origin request is handled');
      const value = await response; await Promise.all(work); return value;
    },
  };
}

test('asset URLs preserve /rps/, development paths, existing query values and fragments', () => {
  const versions = { [modelPath]: modelDigest };
  assert.equal(assetUrl(`/${modelPath}`, '/rps/', versions), `/rps/${modelPath}?v=${modelDigest}`);
  assert.equal(assetUrl(`${modelPath}?view=portrait&v=old#head`, '/rps/', versions), `/rps/${modelPath}?view=portrait&v=${modelDigest}#head`);
  assert.equal(assetUrl(modelPath, '/rps/', {}), `/rps/${modelPath}`, 'development has no build-only map');
  assert.equal(assetUrl('sw.js', '/rps/', versions), '/rps/sw.js', 'worker scope does not receive a model query');
});

test('real production builds inject the actual model digest and precache matching URLs at both bases', async () => {
  for (const base of ['/', '/rps/']) {
    const built = await fixtureFor(base), worker = workerFixture(built.source, base);
    assert.equal(built.modelUrl, `${base}${modelPath}?v=${modelDigest}`);
    assert.equal(built.workerUrl, `${base}sw.js`);
    assert.ok(worker.core.includes(built.modelUrl));
    assert.ok(!worker.core.includes(`${base}${modelPath}`), 'unversioned model must not enter the new cache');
    assert.equal(worker.core.filter(url => url.includes('/models/')).length, 8);
    assert.ok(worker.core.filter(url => url.includes('/models/')).every(url => /\?v=[a-f0-9]{64}$/.test(url)));
    for (const path of ['models/echo-reflections.json', 'models/echo-reflections-medium.bin', 'models/reflections/nested.bin']) {
      const digest = createHash('sha256').update(await readFile(resolve(built.output, path))).digest('hex');
      assert.ok(worker.core.includes(`${base}${path}?v=${digest}`), 'baked metadata/buffers have content-versioned precache keys');
    }
    assert.deepEqual(await readFile(resolve(built.output, modelPath)), modelBytes, 'versioned URL serves the original GLB bytes');
  }
});

test('actual published worker serves the new model when a returning player loads new HTML', async () => {
  const built = await fixtureFor('/rps/');
  const worker = workerFixture(releasedWorker, '/rps/', [['/rps/'+modelPath, 'OLD_PUBLISHED_MODEL']]);
  assert.equal(await (await worker.request('/rps/', 'navigate')).text(), '<div id="app">New release</div>');
  assert.equal(await (await worker.request('/rps/'+modelPath)).text(), 'OLD_PUBLISHED_MODEL', 'fixture reproduces the old cache-first collision');
  assert.deepEqual(Buffer.from(await (await worker.request(built.modelUrl)).arrayBuffer()), modelBytes);
  assert.ok(worker.network.includes('https://trinity.example'+built.modelUrl));
  worker.setOffline(true);
  assert.deepEqual(Buffer.from(await (await worker.request(built.modelUrl)).arrayBuffer()), modelBytes,
    'old controlling worker also retains the fetched versioned model for offline play');
});

test('new worker installs and serves exact versioned models offline without matching an obsolete version', async () => {
  for (const base of ['/', '/rps/']) {
    const built = await fixtureFor(base), worker = workerFixture(built.source, base);
    await worker.install(); const fetched = worker.network.length;
    worker.setOffline(true);
    assert.deepEqual(Buffer.from(await (await worker.request(built.modelUrl)).arrayBuffer()), modelBytes);
    assert.deepEqual(Buffer.from(await (await worker.request(built.poseUrl)).arrayBuffer()), poseBytes, 'baked pose bytes work offline too');
    assert.deepEqual(await (await worker.request(built.metadataUrl)).json(), JSON.parse(metadataBytes.toString()), 'pose metadata uses its exact offline key');
    assert.equal(worker.network.length, fetched, 'offline model is satisfied by its exact precache URL');
    await assert.rejects(worker.request(`${base}${modelPath}?v=obsolete`), /Network unavailable/);
    await assert.rejects(worker.request(`${base}${modelPath}`), /Network unavailable/);
  }
});

test('runtime model cache writes require the complete versioned URL, not just its pathname', async () => {
  const built = await fixtureFor('/rps/'), worker = workerFixture(built.source, '/rps/');
  await worker.request('/rps/'+modelPath+'?v=obsolete');
  assert.equal(worker.writes.length, 0);
  await worker.request(built.modelUrl);
  assert.deepEqual(worker.writes, ['https://trinity.example'+built.modelUrl]);
  worker.setOffline(true);
  assert.deepEqual(Buffer.from(await (await worker.request(built.modelUrl)).arrayBuffer()), modelBytes);
});

test('a model or baked asset changed after config cannot produce mismatched URLs and an offline worker', async () => {
  const built = await fixtureFor('/rps/'), plugin = offlinePlugin();
  await plugin.config({ root: built.root });
  plugin.configResolved({ root: built.root, base: built.base, build: { outDir: 'dist' } });
  const target = resolve(built.output, modelPath);
  await writeFile(target, Buffer.concat([modelBytes, Buffer.from([0])]));
  try {
    await assert.rejects(plugin.writeBundle({}, { 'entry.js': {} }), /Model changed during build/);
  } finally { await writeFile(target, modelBytes); }
  const pose = resolve(built.output, 'models/reflections/nested.bin');
  await rm(pose);
  await assert.rejects(plugin.writeBundle({}, { 'entry.js': {} }), /Model asset set changed during build/);
});
