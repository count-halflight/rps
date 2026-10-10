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
  "/models/echo-human.glb",
  "/models/ronin-human.glb",
  "/models/brawler-human.glb",
  "/models/nyx-human.glb",
  "/models/vex-human.glb",
];
export default function offlinePlugin() {
  let outputDir, base;
  return {
    name: "trinity-offline",
    apply: "build",
    configResolved(config) {
      outputDir = resolve(config.root, config.build.outDir);
      base = config.base;
    },
    async writeBundle(_, bundle) {
      const models=(await readdir(resolve(outputDir,"models"))).filter(f=>f.endsWith(".glb")).map(f=>`/models/${f}`);
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
        hash.update(file);
        hash.update(await readFile(resolve(outputDir, `.${file}`)));
      }
      const version = hash.digest("hex").slice(0, 12);
      const prefix = `trinity-${createHash("sha256").update(base).digest("hex").slice(0, 8)}-`;
      const script = `const PREFIX = ${JSON.stringify(prefix)};
const CACHE = PREFIX + '${version}';
const CORE = ${JSON.stringify(files.map((file) => `${base}${file.slice(1)}`))};
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
 event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {if(response.ok && CORE.includes(url.pathname)){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}return response;})));
});
`;
      await writeFile(resolve(outputDir, "sw.js"), script);
    },
  };
}
