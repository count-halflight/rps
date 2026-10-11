import test from "node:test";
import assert from "node:assert/strict";
import { startTraining, progressTraining } from "../src/game/training.js";
import { resolveTurn, counterFor, WEAPONS } from "../src/game/engine.js";
import { attackPresentation, cinematicFrame } from "../src/game/cinematics.js";

test("optional training teaches all three counters, overdrive, and a beatable thermal boss", () => {
  let training = startTraining();
  training = progressTraining(training, resolveTurn(training.run, "rock"));
  assert.equal(training.step, 1);
  training = progressTraining(training, resolveTurn(training.run, "paper"));
  assert.equal(training.step, 2);
  const wrong = progressTraining(
    training,
    resolveTurn(training.run, "scissors"),
  );
  assert.equal(wrong.step, 2);
  assert.equal(wrong.run.charge, 80);
  training = progressTraining(
    training,
    resolveTurn(training.run, "scissors", "overdrive"),
  );
  assert.equal(training.step, 3);
  assert.equal(training.run.enemy.ability.id, "thermal");
  for (let turn = 0; turn < 8 && training.step === 3; turn++) {
    const weapon = counterFor(WEAPONS[training.run.enemy.signal].id).id;
    training = progressTraining(training, resolveTurn(training.run, weapon));
  }
  assert.equal(training.step, 4);
  assert.equal(training.run.phase, "training-complete");
});
test("training mistakes reset the lesson without blocking a retry", () => {
  const initial = startTraining();
  const retry = progressTraining(initial, resolveTurn(initial.run, "paper"));
  assert.equal(retry.step, 0);
  assert.equal(retry.run.hp, 100);
  assert.equal(retry.run.enemy.confidence, 100);
  assert.ok(retry.feedback);
});
test("each weapon has a distinct cinematic and finisher with bounded choreography", () => {
  const titles = new Set();
  for (const weapon of ["rock", "paper", "scissors"]) {
    const normal = attackPresentation(weapon);
    const final = attackPresentation(weapon, true);
    titles.add(normal.title);
    titles.add(final.title);
    assert.ok(final.duration > normal.duration);
    assert.ok(attackPresentation(weapon, true, true).duration < final.duration);
    for (const seconds of [0, 0.3, 0.9, 1.4, 2.5, 3.3, 9]) {
      const frame = cinematicFrame({ ...final, playerWeapon: weapon }, seconds);
      assert.ok(frame.lunge >= 0 && frame.lunge <= 1);
      assert.ok(frame.collapse >= 0 && frame.collapse <= 1);
      assert.ok([...frame.camera, ...frame.target].every(Number.isFinite));
    }
    assert.ok(
      Math.abs(
        cinematicFrame(
          { ...final, playerWeapon: weapon },
          (final.duration / 1000) * final.impactAt,
        ).impact - 1,
      ) < 1e-9,
    );
  }
  assert.equal(titles.size, 6);
});

test('normal and final attacks cut through four directed shots; reduced motion keeps a fixed camera', () => {
  for(const final of [false,true]){
    const a={...attackPresentation('scissors',final,false,0,'echo'),playerWeapon:'scissors',outcome:'win',finalHit:true};
    const frame=p=>cinematicFrame(a,a.duration*p/1000);
    assert.equal(frame(.1).shot,'anticipation');
    assert.equal(frame(.3).shot,'approach');
    assert.equal(frame(a.impactAt).shot,'impact');
    assert.equal(frame(.9).shot,'recovery');
    assert.notDeepEqual(frame(.1).camera,frame(a.impactAt).camera);
    const reduced={...a,reduced:true};
    assert.deepEqual(cinematicFrame(reduced,.3).camera,cinematicFrame(reduced,1).camera);
    if(final){
      const setup=a.contacts.find(([at])=>at>0&&at<a.impactAt)[0];
      assert.ok(frame(setup).secondaryImpact>.9);
      assert.equal(frame(setup).collapse,0);
      assert.ok(frame(.95).collapse>.95);
    }
  }
});
