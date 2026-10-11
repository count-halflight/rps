import test from 'node:test';
import assert from 'node:assert/strict';
import { FIGHTERS, fighterFor } from '../src/game/fighters.js';
import { levelFor, loadSave, newRun, resolveTurn } from '../src/game/engine.js';
import { phaseFor } from '../src/game/rivals.js';
import { BOSS_PROFILES, RIVAL_NAMES, RIVAL_PALETTES, rivalProfile, visualPhaseFor } from '../src/game/rivalProfile.js';

test('visual rival generation is deterministic and leaves legacy enemies, RNG and combat unchanged', () => {
  for (const seed of [0, 1, 42, 0xffffffff]) for (const level of [1, 2, 3, 5, 10, 15, 20, 25, 30, 99999]) {
    const enemy = levelFor(seed, level), original = structuredClone(enemy);
    const a = rivalProfile(seed, level, enemy, 'echo');
    assert.deepEqual(a, rivalProfile(seed, level, enemy, fighterFor('echo')));
    assert.deepEqual(enemy, original);
    assert.deepEqual(levelFor(seed, level), original);
    assert.equal(a.personality, enemy.pattern);
    assert.equal(a.serial, enemy.serial);
    assert.equal(a.personalityInfo.reliability, enemy.rival.personalityInfo.reliability);
    const run = { ...newRun(seed), level, enemy };
    const before = resolveTurn(run, 'rock', 'strike');
    rivalProfile(seed, level, enemy, 'kuro');
    assert.deepEqual(resolveTurn(run, 'rock', 'strike'), before);
  }
});

test('five-kit bags exhaust every kit before repeating and never repeat across boss seams', () => {
  const kits = FIGHTERS.map(f => f.id).sort();
  for (const seed of [0, 1, 42, 517, 0xffffffff]) {
    let previous;
    for (let first = 1; first <= 500; first += 5) {
      const bag = [];
      for (let level = first; level < first + 5; level++) {
        const profile = rivalProfile(seed, level, levelFor(seed, level));
        assert.notEqual(profile.kit, previous, `seed ${seed}, floor ${level}: consecutive kits`);
        assert.equal(profile.character, profile.kit);
        bag.push(profile.kit); previous = profile.kit;
      }
      assert.deepEqual(bag.sort(), kits, `seed ${seed}, bag starting floor ${first}`);
    }
  }
});

test('twelve palettes exclude the player signature hue and never repeat on consecutive floors', () => {
  assert.equal(RIVAL_PALETTES.length, 12);
  assert.equal(new Set(RIVAL_PALETTES.map(p => p.id)).size, 12);
  for (const player of FIGHTERS) {
    let previous;
    for (let level = 1; level <= 500; level++) {
      const profile = rivalProfile(2718, level, levelFor(2718, level), player.id);
      assert.notEqual(profile.palette.id, previous, `${player.id}, floor ${level}`);
      assert.notEqual(profile.color.toLowerCase(), player.color.toLowerCase());
      const hex = player.color.slice(1), [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
      const hi = Math.max(r, g, b), d = hi - Math.min(r, g, b);
      const hue = (((hi === r ? (g - b) / d : hi === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60) + 360) % 360;
      const distance = Math.abs(profile.palette.hue - hue);
      assert.ok(Math.min(distance, 360 - distance) > 24, `the ${profile.palette.id} palette shares ${player.id}'s hue`);
      previous = profile.palette.id;
    }
  }
});

test('all forty names match their weapon pool and every kit reaches twenty-four modular looks', () => {
  const names = Object.values(RIVAL_NAMES).flat(), looks = new Map(FIGHTERS.map(f => [f.id, new Set()]));
  assert.equal(names.length, 40); assert.equal(new Set(names).size, 40);
  const forbidden = new RegExp(`\\b(${FIGHTERS.map(f => f.name).join('|')})\\b`, 'i');
  assert.ok(names.every(name => !forbidden.test(name)));
  for (const seed of [18, 29, 41]) for (let level = 1; level <= 1000; level++) {
    const profile = rivalProfile(seed, level, levelFor(seed, level), 'vex');
    if (!profile.boss) {
      assert.ok(RIVAL_NAMES[profile.kit].includes(profile.name));
      assert.equal(profile.weapon, fighterFor(profile.kit).weapon);
    }
    looks.get(profile.kit).add(`${profile.look.outfit}/${profile.look.head}/${profile.look.accessory}`);
  }
  for (const [kit, combinations] of looks) assert.equal(combinations.size, 24, kit);
});

test('canonical boss identities follow the legacy protocol in any district without changing gameplay phases', () => {
  const expected = { thermal: 'CRUCIBLE-9', siphon: 'SABLE', plating: 'BULWARK', redline: 'REDLINE', blackout: 'CIPHER', mirror: 'ONYX' };
  for (const [ability, name] of Object.entries(expected)) for (let district = 0; district < 6; district++) {
    const enemy = { ...levelFor(5, 5), ability: { id: ability }, district: { ...levelFor(5, district + 1).district } };
    const profile = rivalProfile(5, 5, enemy, 'echo');
    assert.equal(profile.name, name);
    assert.equal(profile.model, BOSS_PROFILES[ability].id);
    assert.equal(profile.bossProfile, BOSS_PROFILES[ability]);
    assert.equal(profile.entrance.duration, 5);
    assert.equal(profile.phaseDuration, 3);
    assert.deepEqual(profile.phases.map(p => p.at), [1, .66, .33]);
  }
  for (const [health, visual, combat] of [[67, 0, 0], [66, 1, 0], [65, 1, 1], [33, 2, 1], [30, 2, 2]]) {
    const enemy = { boss: true, maxHp: 100, hp: health };
    assert.equal(visualPhaseFor(enemy), visual);
    assert.equal(phaseFor(enemy), combat);
  }
});

test('floor-two elite tailoring is presentation only and existing v1/v2 saves still load', () => {
  const legacy = levelFor(37, 2), original = structuredClone(legacy);
  const elite = rivalProfile(37, 2, legacy, 'echo');
  assert.equal(elite.tier, 'elite'); assert.equal(elite.scale, 1.1);
  assert.equal(legacy.elite, false); assert.deepEqual(legacy, original);
  assert.equal(rivalProfile(37, 3, levelFor(37, 3)).tier, 'miniboss');
  for (const version of [1, 2]) {
    const saved = { ...newRun(37), version };
    rivalProfile(saved.seed, saved.level, saved.enemy, saved.character);
    const restored = loadSave({ getItem() { return JSON.stringify(saved); } });
    assert.ok(restored); assert.equal(restored.seed, saved.seed);
    assert.deepEqual(restored.enemy, saved.enemy);
  }
});
