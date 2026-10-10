import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { launchBrowser, delay } from "./browser.mjs";
import { newRun, resolveTurn, levelFor } from "../src/game/engine.js";
import { FIGHTERS } from "../src/game/fighters.js";
import { attackPresentation } from "../src/game/cinematics.js";
const b = await launchBrowser(),
  checks = [],
  url = process.env.TEST_URL || "http://127.0.0.1:5173/";
const lossOnly=process.env.TRAINING_CASE==='loss';
const check = (n) => {
    checks.push(n);
    console.log("PASS", n);
  },
  read = () =>
    b.evaluate("JSON.parse(localStorage.getItem('trinity-save-v1'))");
const fixture = async (run) => {
  run.encounterSeen=true;
  await b.evaluate(
    `localStorage.setItem('trinity-save-v1',${JSON.stringify(JSON.stringify(run))});localStorage.setItem('trinity-preferences-v1',JSON.stringify({quality:'low',motion:'system',liveDossiers:false}));`,
  );
  await b.reload();
  await b.waitFor("document.querySelector('.start-button')");
};
async function hand(index, attack = 1) {
  await b.touch(`.weapon-card:nth-child(${index})`);
  await b.waitFor("document.querySelector('.attack-card')");
  await b.touch(`.attack-card:nth-child(${attack})`);
}
try {
  await mkdir("artifacts", { recursive: true });
  await b.call("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await b.call("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 5,
  });
  await b.navigate(url);
  await b.waitFor("document.querySelector('.start-button')");
  if(!lossOnly){
  const saved = newRun(421);
  saved.hp = 20;
  saved.charge = 66;
  saved.credits = 240;
  await fixture(saved);
  await b.touch(".training-start");
  await b.waitFor(
    "document.querySelector('.game-surface .three-arena')?.dataset.frameAsset==='loaded'",
    30000,
  );
  await b.waitFor(
    "document.querySelector('.training-coach h1')?.textContent==='Win a hand.'",
  );
  await hand(1);
  await b.waitFor(
    "document.querySelector('.training-coach h1')?.textContent==='Try paper.'",
  );
  await hand(2);
  await b.waitFor(
    "document.querySelector('.training-coach h1')?.textContent==='Try a heavy attack.'",
  );
  await hand(3, 3);
  await b.waitFor(
    "document.querySelector('.training-coach h1')?.textContent==='Beat the trainer.'",
  );
  for (let turn = 0; turn < 8; turn++) {
    if (
      await b.evaluate(
        "document.querySelector('.training-coach h1')?.textContent==='Training complete'",
      )
    )
      break;
    const tell = await b.evaluate(
      "document.querySelector('.enemy-tell b').textContent",
    );
    await hand({ Scissors: 1, Rock: 2, Paper: 3 }[tell]);
    await b.waitFor(
      "!document.querySelector('.weapon-card').disabled || document.querySelector('.training-coach h1')?.textContent==='Training complete'",
    );
  }
  assert.equal(
    await b.evaluate(
      "document.querySelector('.training-coach h1').textContent",
    ),
    "Training complete",
  );
  assert.deepEqual(await read(), saved);
  await b.touch(".training-coach .primary-button");
  await b.waitFor("!document.querySelector('.training-coach')");
  assert.deepEqual(await read(), saved);
  check(
    "Touch tutorial teaches counters, earned attacks, and a boss without replacing the campaign",
  );
  await b.touch(".mobile-tactics-toggle");
  await b.touch(".lab-toggle");
  await b.touch(".lab-tabs button:nth-child(2)");
  await b.touch(".slice-controls button:nth-child(3)");
  assert.equal(
    await b.evaluate(
      "document.querySelectorAll('.lab-panel .integral-slice').length",
    ),
    64,
  );
  await b.touch(".lab-tabs button:nth-child(3)");
  assert.match(
    await b.evaluate("document.querySelector('.lab-lesson').textContent"),
    /75/,
  );
  await b.screenshot("artifacts/calculus-phone.png");
  check("Calculus controls change concepts and Riemann slices on a phone");
  await b.call("Emulation.setTouchEmulationEnabled", { enabled: false });
  await b.call("Emulation.setDeviceMetricsOverride", {
    width: 960,
    height: 640,
    deviceScaleFactor: 1,
    mobile: false,
  });
  for (const f of FIGHTERS)
    for (const [weapon, index, signal] of [
      ["rock", 1, 2],
      ["paper", 2, 0],
      ["scissors", 3, 1],
    ]) {
      const r = newRun(0, null, f.id);
      r.enemy.hp = 1;
      r.enemy.signal = signal;
      r.enemy.confidence = 100;
      await fixture(r);
      await b.click(".start-button");
      await b.waitFor(
        "document.querySelector('.game-surface .three-arena')?.dataset.frameAsset==='loaded'",
        30000,
      );
      await b.click(`.weapon-card:nth-child(${index})`);
      await b.waitFor("document.querySelector('.attack-card')");
      const reveal = await b.evaluate(
        `new Promise((resolve,reject)=>{const start=performance.now();let pending=false,leaked=false;const o=new MutationObserver(()=>{const e=document.querySelector('.cinematic-overlay');if(e?.dataset.reveal==='pending'){pending=true;if(document.querySelector('.damage-feedback'))leaked=true;}if(e?.dataset.reveal==='confirmed'){o.disconnect();clearTimeout(t);resolve({pending,leaked,time:performance.now()-start,title:document.querySelector('.cinematic-caption strong')?.textContent,slices:document.querySelectorAll('.cinematic-integral .integral-slice').length});}});o.observe(document.querySelector('.battle-stage'),{subtree:true,childList:true,attributes:true});const t=setTimeout(()=>{o.disconnect();reject(new Error('Missing impact'));},10000);document.querySelector('.attack-card').click();})`,
      );
      assert.equal(reveal.pending, true);
      assert.equal(reveal.leaked, false);
      assert.equal(
        reveal.title,
        attackPresentation(weapon, true, false, 0, f.id).title,
      );
      assert.ok(reveal.time >= 3300, `early reveal ${reveal.time} ms`);
      assert.equal(reveal.slices, weapon === "paper" && f.id === "nyx" ? 24 : 0);
      if (weapon === "paper")
        await b.screenshot(`artifacts/finisher-${f.id}.png`);
      await b.waitFor("document.querySelector('.upgrade-modal')");
      assert.equal((await read()).phase, "upgrade");
      check(
        `${f.name} / ${weapon}: damage stays hidden until the final impact`,
      );
    }
  }
  const loss = newRun(Array.from({length:100},(_,i)=>i).find(seed=>levelFor(seed,4).rival.character==='nyx'));
  loss.level = 4;
  loss.enemy = levelFor(loss.seed, loss.level);
  loss.hp = 1;
  loss.enemy.signal = 1;
  loss.enemy.confidence = 100;
  await fixture(loss);
  await b.click(".start-button");
  await b.waitFor("document.querySelector('.game-surface .three-arena')?.dataset.frameAsset==='loaded'",30000);
  await b.click(".weapon-card:nth-child(1)");
  await b.waitFor("document.querySelector('.cinematic-overlay.is-finisher')");
  await b.waitFor("document.querySelector('.cinematic-integral .integral-graph')");
  assert.equal(
    await b.evaluate("document.querySelector('.cinematic-integral .integral-graph').getAttribute('aria-label')"),
    "Area under an impact rate curve.",
  );
  assert.equal(
    await b.evaluate(
      "document.querySelector('.cinematic-caption span').textContent",
    ),
    "Rival attacks",
  );
  await b.waitFor("document.querySelector('.cinematic-overlay')?.dataset.reveal==='confirmed'");
  const incoming = resolveTurn(loss, "rock").result.incoming;
  assert.equal(
    await b.evaluate("document.querySelector('.cinematic-integral .integral-graph').getAttribute('aria-label')"),
    `Area under an impact rate curve. Its exact integral is ${incoming}.`,
  );
  await b.waitFor("document.querySelector('[aria-label=\"You fell\"]')");
  assert.equal((await read()).hp, 0);
  check(
    "A losing final exchange plays the rival’s finisher and resolves defeat",
  );
  assert.equal(b.errors.length, 0, JSON.stringify(b.errors));
  assert.equal(b.requests.length, 0, JSON.stringify(b.requests));
  await writeFile(
    lossOnly?"artifacts/losing-finisher-smoke.json":"artifacts/training-smoke.json",
    JSON.stringify({ checks, errors: b.errors, requests: b.requests }, null, 2),
  );
} catch (error) {
  await b.screenshot("artifacts/training-failure.png").catch(() => {});
  await writeFile(
    "artifacts/training-failure.json",
    JSON.stringify(
      {
        checks,
        failure: error.message,
        errors: b.errors,
        requests: b.requests,
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await b.close();
}
