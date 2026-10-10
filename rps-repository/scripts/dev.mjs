import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const apiPort = process.env.API_PORT || "3001";
const detached = process.platform !== "win32";
const portProbe = createServer();
try {
  await new Promise((resolve, reject) => {
    portProbe.once("error", reject);
    portProbe.listen(Number(apiPort), "127.0.0.1", resolve);
  });
  await new Promise((resolve) => portProbe.close(resolve));
} catch (error) {
  console.error(`Cannot start the API on port ${apiPort}: ${error.message}`);
  console.error(
    "Stop the process using that port, or set API_PORT to another port.",
  );
  process.exit(1);
}
const processes = [
  spawn(
    process.execPath,
    [
      "--watch",
      "--use-env-proxy",
      "--env-file-if-exists=.env",
      "server/index.js",
    ],
    {
      cwd: root,
      stdio: "inherit",
      detached,
      env: { ...process.env, PORT: apiPort },
    },
  ),
  spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", ...process.argv.slice(2)],
    {
      cwd: root,
      stdio: "inherit",
      detached,
      env: { ...process.env, API_PORT: apiPort },
    },
  ),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  processes.forEach((child) => {
    if (!child.pid) return;
    try {
      if (detached) process.kill(-child.pid, "SIGTERM");
      else child.kill("SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  });
  process.exitCode = code;
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
processes.forEach((child) => {
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) stop(code || 0);
  });
});
