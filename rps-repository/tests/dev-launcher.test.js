import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const reservePort = async (port = 0) => {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return server;
};
const unusedPort = async () => {
  const server = await reservePort();
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
};

test(
  "development launcher releases the API watcher and Vite ports on shutdown",
  { timeout: 20000 },
  async () => {
    const apiPort = await unusedPort();
    const webPort = await unusedPort();
    const child = spawn(
      process.execPath,
      [
        "scripts/dev.mjs",
        "--host",
        "127.0.0.1",
        "--port",
        String(webPort),
        "--strictPort",
      ],
      {
        cwd: root,
        env: { ...process.env, API_PORT: String(apiPort) },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    child.stdout.on("data", (data) => {
      output += data;
    });
    child.stderr.on("data", (data) => {
      output += data;
    });
    const exited = once(child, "exit");
    try {
      let ready = false;
      for (let attempt = 0; attempt < 60; attempt++) {
        const responses = await Promise.allSettled([
          fetch(`http://127.0.0.1:${apiPort}/api/health`),
          fetch(`http://127.0.0.1:${webPort}/`),
        ]);
        if (
          responses.every(
            (result) => result.status === "fulfilled" && result.value.ok,
          )
        ) {
          ready = true;
          break;
        }
        if (child.exitCode !== null) break;
        await pause(100);
      }
      assert.equal(ready, true, output);
      child.kill("SIGTERM");
      await exited;
      for (const port of [apiPort, webPort]) {
        const probe = await reservePort(port);
        await new Promise((resolve) => probe.close(resolve));
      }
    } finally {
      child.kill("SIGTERM");
    }
  },
);

test(
  "development launcher explains an occupied API port before starting Vite",
  { timeout: 10000 },
  async () => {
    const occupied = await reservePort();
    const child = spawn(process.execPath, ["scripts/dev.mjs"], {
      cwd: root,
      env: { ...process.env, API_PORT: String(occupied.address().port) },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let output = "";
    child.stderr.on("data", (data) => {
      output += data;
    });
    try {
      const [code] = await once(child, "exit");
      assert.equal(code, 1);
      assert.match(output, /Stop the process using that port, or set API_PORT/);
    } finally {
      child.kill("SIGTERM");
      await new Promise((resolve) => occupied.close(resolve));
    }
  },
);
