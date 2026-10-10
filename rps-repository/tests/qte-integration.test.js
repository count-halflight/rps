import test from 'node:test';
import assert from 'node:assert/strict';
import { ATTACK_CATALOG } from '../src/game/attackCatalog.js';
import { attackPresentation, cinematicFrame, cinematicCue } from '../src/game/cinematics.js';
import { createQteTrack, pressQte, expireQtes, qteScore, qteCharge } from '../src/game/qte.js';
import { newRun, levelFor, WEAPONS, counterFor, openingFor, resolveTurn, loadSave } from '../src/game/engine.js';

function earnedOpening(character, hand, level, turn) {
  const run = newRun(417, null, character);
  run.level = level;
  run.turn = turn;
  run.fightTurn = turn;
  run.charge = 88;
  run.enemy = levelFor(run.seed, level);
  run.enemy.confidence = 100;
  run.enemy.signal = WEAPONS.findIndex(weapon => counterFor(weapon.id, run.enemy.district.reverse).id === hand);
  return run;
}

function resolveTrack(presentation, hits) {
  let track = createQteTrack(cinematicCue(presentation.sequenceId), presentation.duration);
  for (const cue of track) {
    const input = hits ? cue.key : String(Number(cue.key) % 3 + 1);
    track = pressQte(track, input, cue.opensAt).track;
  }
  return expireQtes(track, presentation.duration);
}

test('Both finale families remain reachable through seeded earned openings in every floor region', () => {
  const reachable = new Set();
  for (const character of ['echo', 'cinder', 'nyx', 'vex', 'kuro']) {
    for (const hand of ['rock', 'paper', 'scissors']) {
      for (const level of [1, 3, 4, 6, 7, 9, 10, 15]) {
        for (const turn of [0, 1]) {
          const run = earnedOpening(character, hand, level, turn);
          run.enemy.hp = 1;
          const before = structuredClone(run);
          const opening = openingFor(run, hand);
          const next = resolveTurn(run, hand);
          assert.equal(opening.outcome, 'win');
          assert.equal(opening.enemyWeapon, next.result.enemyWeapon);
          assert.equal(next.phase, 'upgrade');
          assert.equal(next.turn, turn + 1);
          assert.deepEqual(run, before, 'presentation must not spend or reroll the opening');
          const index = (Math.floor((level - 1) / 3) + turn) % 2;
          const presentation = attackPresentation(hand, true, false, 0, character, null, index);
          assert.equal(presentation.finisherIndex, index);
          reachable.add(presentation.sequenceId);
        }
      }
    }
  }
  assert.deepEqual(reachable, new Set(ATTACK_CATALOG.filter(sequence => sequence.final).map(sequence => sequence.id)));
  assert.equal(reachable.size, 30);
});

test('Perfect and failed inputs branch choreography without cancelling any earned impact or knockout', () => {
  for (const sequence of ATTACK_CATALOG) {
    const presentation = attackPresentation(sequence.weapon, sequence.final, false, sequence.variant, sequence.character, null, sequence.finisherIndex || 0);
    const correct = resolveTrack(presentation, true);
    const failed = resolveTrack(presentation, false);
    assert.ok(correct.every(cue => cue.status === 'hit'), sequence.id);
    assert.ok(failed.every(cue => cue.status === 'missed'), sequence.id);
    assert.equal(qteCharge(correct), sequence.final ? 6 : 3);
    assert.equal(qteCharge(failed), 0);
    for (const [track, branch] of [[correct, 'perfect'], [failed, 'strained']]) {
      const animation = { ...presentation, playerWeapon: sequence.weapon, outcome: 'win', finalHit: sequence.final, qte: track, qteSuccess: qteScore(track, true) };
      const hit = cinematicFrame(animation, presentation.duration * presentation.impactAt / 1000);
      assert.equal(hit.qteBranch, branch, sequence.id);
      assert.ok(hit.impact > .999, sequence.id + ' earned damage cannot disappear after a missed prompt');
      assert.equal(hit.contactStrength, 1, sequence.id + ' final contact remains decisive');
      const end = cinematicFrame(animation, presentation.duration / 1000);
      assert.equal(end.progress, 1, sequence.id + ' no input is required for the sequence to finish');
      if (sequence.final) assert.equal(end.collapse, 1, sequence.id + ' earned knockout remains final');
    }
  }
});

test('A QTE charge reward survives save validation while the same hand remains deterministic on continue', () => {
  const run = earnedOpening('nyx', 'paper', 3, 1);
  const next = resolveTurn(run, 'paper', 'overdrive');
  assert.equal(next.result.outcome, 'win', 'inverted districts preserve their original earned hand');
  const presentation = attackPresentation('paper', false, false, 2, 'nyx');
  const rewarded = { ...next, charge: next.charge + qteCharge(resolveTrack(presentation, true)) };
  assert.ok(rewarded.charge < 100, 'fixture exercises a real saved reward, below the cap');
  const restored = loadSave({ getItem: () => JSON.stringify(rewarded) });
  assert.ok(restored);
  assert.equal(restored.charge, rewarded.charge);
  assert.equal(restored.turn, run.turn + 1, 'QTE itself never spends another combat turn');
  assert.deepEqual(restored.result, rewarded.result);
  for (const hand of WEAPONS) {
    assert.equal(openingFor(restored, hand.id).outcome, openingFor(rewarded, hand.id).outcome);
    assert.equal(openingFor(restored, hand.id).enemyWeapon, openingFor(rewarded, hand.id).enemyWeapon);
  }
});
