import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FREE_MODEL,
  generateDossier,
  isFreeModel,
  localDossier,
  validateRequest,
} from "./encounters.js";
const root = resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
const apiKey = process.env.OPENROUTER_API_KEY;
const model = process.env.OPENROUTER_MODEL || FREE_MODEL;
const cache = new Map(),
  activeRequests = new Map();
let lastRequestAt = 0;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".glb": "model/gltf-binary",
  ".webmanifest": "application/manifest+json",
};
function send(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(body));
}
export const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    if (url.pathname === "/api/health" && req.method === "GET") {
      send(res, 200, {
        status: "ok",
        ai: Boolean(apiKey) && isFreeModel(model),
        freeOnly: true,
      });
      return;
    }
    if (url.pathname === "/api/encounter" && req.method === "POST") {
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host) {
        send(res, 403, { error: "Origin not allowed" });
        return;
      }
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 1024) {
          send(res, 413, { error: "Request too large" });
          return;
        }
      }
      let value;
      try {
        value = JSON.parse(raw);
      } catch {
        send(res, 400, { error: "Invalid request" });
        return;
      }
      if (!validateRequest(value)) {
        send(res, 400, { error: "Invalid run signature or floor" });
        return;
      }
      const key = `${value.seed}:${value.level}`;
      if (cache.has(key)) {
        send(res, 200, cache.get(key));
        return;
      }
      if (activeRequests.has(key)) {
        send(res, 200, await activeRequests.get(key));
        return;
      }
      if (Date.now() - lastRequestAt < 2500 || activeRequests.size >= 2) {
        send(res, 200, {
          dossier: localDossier(value.seed, value.level),
          ai: false,
          reason: "cooldown",
        });
        return;
      }
      lastRequestAt = Date.now();
      const request = generateDossier({
        seed: value.seed,
        level: value.level,
        apiKey,
        model,
      });
      activeRequests.set(key, request);
      const result = await request;
      activeRequests.delete(key);
      cache.set(key, result);
      if (cache.size > 200) cache.delete(cache.keys().next().value);
      send(res, 200, result);
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      send(res, 404, { error: "Unknown endpoint" });
      return;
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      send(res, 405, { error: "Method not allowed" });
      return;
    }
    let target = resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (target !== root && !target.startsWith(root + sep)) {
      send(res, 403, { error: "Invalid path" });
      return;
    }
    const info = await stat(target).catch(() => null);
    if (!info || info.isDirectory()) {
      if (extname(target)) {
        send(res, 404, { error: "Asset not found" });
        return;
      }
      target = resolve(root, "index.html");
    }
    const data = await readFile(target);
    const extension = target.slice(target.lastIndexOf("."));
    res.writeHead(200, {
      "Content-Type": MIME[extension] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": target.includes(`${sep}assets${sep}`)
        ? "public, max-age=3600"
        : "no-cache",
    });
    res.end(req.method === "HEAD" ? undefined : data);
  } catch {
    if (!res.headersSent) send(res, 500, { error: "Service unavailable" });
    else res.end();
  }
});
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3001);
  server.listen(port, process.env.HOST || "127.0.0.1", () =>
    console.log(
      `Trinity service listening on port ${port}. Free AI ${Boolean(apiKey) && isFreeModel(model) ? "enabled" : "offline"}.`,
    ),
  );
}
