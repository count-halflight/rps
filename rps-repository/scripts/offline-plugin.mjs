import { createHash } from "node:crypto";
import { writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const publicFiles = [
  "/",
  "/index.html",
  "/favicon.svg",
  "/manifest.webmanifest",
  "/icons/trinity-192.png",
  "/icons/trinity-512.png",
  "/models/echo-frame.glb",
  "/models/echo-frame-low.glb",
  ...[
    "afterlight-arena",
    "ember-foundry",
    "prism-vault",
    "ghost-market",
    "signal-garden",
    "black-tide",
  ].map((name) => `/assets/${name}.webp`),
];
export default function offlinePlugin() {
  let outputDir;
  return {
    name: "trinity-offline",
    apply: "build",
    configResolved(config) {
      outputDir = resolve(config.root, config.build.outDir);
    },
    async writeBundle(_, bundle) {
      const files = [
        ...new Set([
          ...publicFiles,
          ...Object.keys(bundle).map((name) => `/${name}`),
        ]),
      ];
      const hash = createHash("sha256");
      for (const file of files.filter((file) => file !== "/").sort()) {
        hash.update(file);
        hash.update(await readFile(resolve(outputDir, `.${file}`)));
      }
      const version = hash.digest("hex").slice(0, 12);
      const script = `const CACHE = 'trinity-${version}';
const CORE = ${JSON.stringify(files)};
self.addEventListener('install', event => {event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));});
self.addEventListener('activate', event => {event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('trinity-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));});
self.addEventListener('fetch', event => {
 const url = new URL(event.request.url);
 if(event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
 if(event.request.mode === 'navigate') {
  event.respondWith(fetch(event.request).then(response => {if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put('/index.html',copy)));}return response;}).catch(()=>caches.match('/index.html')));
  return;
 }
 event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {if(response.ok && CORE.includes(url.pathname)){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}return response;})));
});
`;
      await writeFile(resolve(outputDir, "sw.js"), script);
    },
  };
}
