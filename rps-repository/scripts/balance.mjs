import {
  newRun,
  resolveTurn,
  chooseUpgrade,
  upgradeChoices,
  counterFor,
  scanSignal,
  repairFrame,
  random,
} from "../src/game/engine.js";
import fs from "node:fs/promises";
function simulate(seed, strategy) {
  let run = newRun(seed),
    exchanges = 0;
  const rng = random(seed * 1009);
  while (run.phase !== "defeat" && run.level < 200 && exchanges < 3000) {
    if (run.phase === "upgrade") {
      const choices = upgradeChoices(run);
      const scored = choices
        .map((u) => ({
          ...u,
          score:
            u.id === "power"
              ? 12
              : u.id === "capacity"
                ? run.hp / run.maxHp < 0.6
                  ? 22
                  : 10
                : u.id === "armor"
                  ? run.upgrades.armor < 5
                    ? 14
                    : 4
                  : u.id === "coolant"
                    ? run.upgrades.coolant < 2
                      ? 11
                      : 3
                    : run.upgrades.battery < 2
                      ? 9
                      : 2,
        }))
        .sort((a, b) => b.score - a.score);
      run = chooseUpgrade(
        run,
        strategy === "random"
          ? choices[Math.floor(rng() * 3)].id
          : scored[0].id,
      );
      continue;
    }
    if (strategy === "tactical") {
      if (run.credits >= 80 && run.hp < run.maxHp * 0.7 && !run.repairUsed)
        run = repairFrame(run);
      if (
        run.charge >= 30 &&
        !run.scanUsed &&
        (run.enemy.boss || run.enemy.confidence < 75)
      )
        run = scanSignal(run);
    }
    const weapon =
      strategy === "random"
        ? ["rock", "paper", "scissors"][Math.floor(rng() * 3)]
        : counterFor(
            run.scanned || ["rock", "paper", "scissors"][run.enemy.signal],
            run.enemy.district.reverse,
          ).id;
    const stance =
      strategy === "tactical"
        ? run.charge >= 70 && run.heat < 50 && run.enemy.hp > 25
          ? "overdrive"
          : run.hp < run.maxHp * 0.5 || run.enemy.confidence < 65
            ? "guard"
            : "strike"
        : "strike";
    run = resolveTurn(run, weapon, stance);
    exchanges++;
  }
  return { floor: run.level, exchanges, phase: run.phase };
}
const summary = {};
for (const strategy of ["random", "signal", "tactical"]) {
  const results = Array.from({ length: 500 }, (_, i) =>
    simulate(i + 1, strategy),
  );
  const floors = results.map((r) => r.floor).sort((a, b) => a - b);
  summary[strategy] = {
    runs: results.length,
    median: floors[249],
    mean: Number((floors.reduce((a, b) => a + b) / 500).toFixed(1)),
    p90: floors[449],
    max: floors[499],
    hitLimit: results.filter((r) => r.phase !== "defeat").length,
  };
}
console.log(JSON.stringify(summary, null, 2));
await fs.mkdir("artifacts", { recursive: true });
await fs.writeFile("artifacts/balance.json", JSON.stringify(summary, null, 2));
