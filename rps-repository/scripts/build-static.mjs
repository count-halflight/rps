import { spawnSync } from "node:child_process";
const result = spawnSync(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "build", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: { ...process.env, VITE_STATIC_HOST: "true" },
  },
);
process.exit(result.status ?? 1);
