const PREFIX = "trinity-e28074f3-";
const CACHE = PREFIX + '4d63472f5474';
const CORE = ["/rps/","/rps/index.html","/rps/favicon.svg","/rps/manifest.webmanifest","/rps/icons/trinity-192.png","/rps/icons/trinity-512.png","/rps/art/afterlight-cover.png","/rps/models/echo-human.glb","/rps/models/ronin-human.glb","/rps/models/brawler-human.glb","/rps/models/nyx-human.glb","/rps/models/vex-human.glb","/rps/art/arena-docks.webp","/rps/art/arena-foundry.webp","/rps/art/arena-garden.webp","/rps/art/arena-market.webp","/rps/art/arena-rain.webp","/rps/art/arena-vault.webp","/rps/assets/barlow-condensed-latin-500-normal-BgYH2mbd.woff2","/rps/assets/barlow-condensed-latin-600-normal-DepVgxBB.woff2","/rps/assets/anton-latin-400-normal-Byf51wtH.woff2","/rps/assets/barlow-condensed-latin-700-normal-v1xN8_Wq.woff2","/rps/assets/chakra-petch-latin-700-normal-CnDBPjkL.woff2","/rps/assets/barlow-condensed-latin-500-normal-HIEiP5Ov.woff","/rps/assets/barlow-condensed-latin-600-normal-BFJEwTuo.woff","/rps/assets/anton-latin-400-normal-AUNGEG_V.woff","/rps/assets/chakra-petch-latin-700-normal-D1s_c2du.woff","/rps/assets/barlow-condensed-latin-700-normal-Dmwat-ge.woff","/rps/assets/index-lp0lGPBZ.css","/rps/assets/graphics-CnIqXUZs.js","/rps/assets/react-D-vXKkXw.js","/rps/assets/index-CfPr08vc.js","/rps/assets/Arena-DrC2TInl.js"];
const ENTRY = "/rps/index.html";
const APP_ROOT = "/rps/";
const API = "/rps/api/";
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
