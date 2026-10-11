import { spawnSync } from "node:child_process";
const reflectionCheck = spawnSync(process.execPath, ["scripts/build-reflections.mjs", "--check"], { stdio: "inherit" });
if (reflectionCheck.status !== 0) process.exit(reflectionCheck.status ?? 1);
const result = spawnSync(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "build", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: { ...process.env, VITE_STATIC_HOST: "true" },
  },
);
process.exit(result.status ?? 1);
