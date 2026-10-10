import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCombatEffects } from '../src/components/combatEffects.js';

function fixture(finisher = false) {
  const scene = new THREE.Scene();
  const effects = createCombatEffects(scene);
  const edge = [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 2, 0)];
  const attacker = { root: new THREE.Group(), weaponSegments: () => [edge] };
  const animation = { id: 'first', style: 'blades', finisher, impactAt: .6, color: '#00ffaa', vfx: 'draw-line' };
  const frame = { progress: .5, returnHome: 0, defender: { x: 0, y: 0 }, impact: 0, secondaryImpact: 0, weapon: 'scissors' };
  const trail = scene.children[0].children[0];
  const moveEdge = x => edge.forEach(v => { v.x = x; });
  return { effects, attacker, animation, frame, trail, moveEdge };
}

test('weapon trails retain nearby edge snapshots and discard them after a long frame gap', () => {
  const f = fixture();
  try {
    f.effects.update(f.attacker, f.frame, f.animation, 1, 1);
    f.moveEdge(.1);
    f.effects.update(f.attacker, f.frame, f.animation, 1, 1.04);
    const count = f.trail.geometry.drawRange.count;
    assert.equal(count, 6, 'nearby samples form two ribbon triangles');
    const vertices = [...f.trail.geometry.attributes.position.array.slice(0, count * 3)];
    assert.ok(vertices.every(Number.isFinite));
    assert.ok(vertices.filter((_, i) => i % 3 === 0).some(x => x === 0), 'earlier blade positions remain snapshots');
    assert.ok(vertices.filter((_, i) => i % 3 === 0).some(x => x > .09));
    assert.equal(f.trail.material.opacity, .32);
    assert.equal(f.trail.material.color.getHexString(), '00ffaa');

    f.moveEdge(8);
    f.effects.update(f.attacker, f.frame, f.animation, 1, 3);
    assert.equal(f.trail.geometry.drawRange.count, 0, 'a long gap cannot connect distant blade positions');
    f.moveEdge(8.1);
    f.effects.update(f.attacker, f.frame, f.animation, 1, 3.04);
    assert.equal(f.trail.geometry.drawRange.count, 6);
    const fresh = [...f.trail.geometry.attributes.position.array.slice(0, 18)];
    assert.ok(fresh.filter((_, i) => i % 3 === 0).every(x => x >= 8), 'the restarted trail contains only recent positions');
  } finally { f.effects.dispose(); }
});

test('leaving a cut, resetting combat and starting another attack cannot bridge old trails', () => {
  const f = fixture(true);
  try {
    f.effects.update(f.attacker, f.frame, f.animation, 1, 1);
    f.moveEdge(.1);
    f.effects.update(f.attacker, f.frame, f.animation, 1, 1.03);
    assert.equal(f.trail.geometry.drawRange.count, 6);
    assert.equal(f.trail.material.opacity, .24);

    f.effects.update(f.attacker, { ...f.frame, progress: .95 }, f.animation, 1, 1.05);
    assert.equal(f.trail.visible, false);
    assert.equal(f.trail.geometry.drawRange.count, 0);
    f.moveEdge(2);
    f.effects.update(f.attacker, f.frame, f.animation, 1, 1.07);
    assert.equal(f.trail.geometry.drawRange.count, 0, 'reentering a cut starts with one fresh sample');

    f.moveEdge(2.1);
    f.effects.update(f.attacker, f.frame, f.animation, 1, 1.10);
    assert.equal(f.trail.geometry.drawRange.count, 6);
    f.effects.reset();
    assert.equal(f.trail.geometry.drawRange.count, 0);
    f.effects.update(f.attacker, f.frame, f.animation, 1, 1.12);
    assert.equal(f.trail.geometry.drawRange.count, 0, 'reset removes even recent samples');

    f.moveEdge(2.2);
    f.effects.update(f.attacker, f.frame, f.animation, 1, 1.14);
    assert.equal(f.trail.geometry.drawRange.count, 6);
    f.effects.update(f.attacker, f.frame, { ...f.animation, id: 'second' }, 1, 1.16);
    assert.equal(f.trail.geometry.drawRange.count, 0, 'changing attacks clears previous blade positions');
  } finally { f.effects.dispose(); }
});
