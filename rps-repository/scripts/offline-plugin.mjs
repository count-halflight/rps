import { createHash } from "node:crypto";
import { writeFile, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const publicFiles = [
  "/",
  "/index.html",
  "/favicon.svg",
  "/manifest.webmanifest",
  "/icons/trinity-192.png",
  "/icons/trinity-512.png",
  "/art/afterlight-cover.png",
  "/fonts/PirataOne-Regular.ttf",
  "/models/echo-human.glb",
  "/models/ronin-human.glb",
  "/models/brawler-human.glb",
  "/models/nyx-human.glb",
  "/models/vex-human.glb",
];
async function modelFilesIn(directory, folder = "models") {
  const entries = await readdir(resolve(directory, folder), { withFileTypes: true });
  const files = await Promise.all(entries.map(entry => {
    const relative = `${folder}/${entry.name}`;
    return entry.isDirectory() ? modelFilesIn(directory, relative)
      : entry.isFile() && /\.(glb|bin|json)$/i.test(entry.name) ? [relative] : [];
  }));
  return files.flat().sort();
}
export default function offlinePlugin() {
  let outputDir, base, modelVersions;
  return {
    name: "trinity-offline",
    apply: "build",
    async config(config) {
      const publicDir = resolve(config.root || process.cwd(), config.publicDir || "public");
      // Reflection pose buffers/metadata are finalized before Vite starts, just
      // like their source GLBs; every member of that set needs its own cache key.
      const paths = await modelFilesIn(publicDir);
      modelVersions = Object.fromEntries(await Promise.all(paths.map(async path => [
        path,
        createHash("sha256").update(await readFile(resolve(publicDir, path))).digest("hex"),
      ])));
      return { define: { __TRINITY_ASSET_VERSIONS__: JSON.stringify(modelVersions) } };
    },
    configResolved(config) {
      outputDir = resolve(config.root, config.build.outDir);
      base = config.base;
    },
    async writeBundle(_, bundle) {
      const modelPaths = await modelFilesIn(outputDir);
      if (JSON.stringify(modelPaths) !== JSON.stringify(Object.keys(modelVersions).sort())) {
        throw new Error("Model asset set changed during build. Finish reflection baking before starting Vite and rebuild.");
      }
      const models = modelPaths.map(path => `/${path}`);
      const art=(await readdir(resolve(outputDir,'art'))).filter(f=>/\.(png|webp|jpg|jpeg|avif)$/i.test(f)).map(f=>`/art/${f}`);
      const files = [
        ...new Set([
          ...publicFiles,
          ...models,
          ...art,
          ...Object.keys(bundle).map((name) => `/${name}`),
        ]),
      ];
      const hash = createHash("sha256");
      hash.update(base);
      for (const file of files.filter((file) => file !== "/").sort()) {
        const bytes = await readFile(resolve(outputDir, `.${file}`));
        if (file.startsWith("/models/") && createHash("sha256").update(bytes).digest("hex") !== modelVersions[file.slice(1)]) {
          throw new Error(`Model changed during build: ${file}. Freeze model output and rebuild.`);
        }
        hash.update(file);
        hash.update(bytes);
      }
      const version = hash.digest("hex").slice(0, 12);
      const prefix = `trinity-${createHash("sha256").update(base).digest("hex").slice(0, 8)}-`;
      const script = `const PREFIX = ${JSON.stringify(prefix)};
const CACHE = PREFIX + '${version}';
const CORE = ${JSON.stringify(files.map((file) => `${base}${file.slice(1)}${modelVersions[file.slice(1)] ? `?v=${modelVersions[file.slice(1)]}` : ""}`))};
const ENTRY = ${JSON.stringify(`${base}index.html`)};
const APP_ROOT = ${JSON.stringify(base)};
const API = ${JSON.stringify(`${base}api/`)};
self.addEventListener('install', event => {event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));});
self.addEventListener('activate', event => {event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));});
self.addEventListener('fetch', event => {
 const url = new URL(event.request.url);
 if(event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith(API)) return;
 if(event.request.mode === 'navigate') {
  event.respondWith(fetch(event.request).then(response => {if(response.ok && (url.pathname === APP_ROOT || url.pathname === ENTRY)){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(ENTRY,copy)));}return response;}).catch(()=>caches.match(ENTRY)));
  return;
 }
 event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {if(response.ok && CORE.includes(url.pathname + url.search)){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}return response;})));
});
`;
      await writeFile(resolve(outputDir, "sw.js"), script);
    },
  };
}
