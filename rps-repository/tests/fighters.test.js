import { createTexturedGltfLoader } from "./helpers/texturedGltfLoader.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { createRiggedFighter } from "../src/components/riggedFighter.js";
import { FIGHTERS } from "../src/game/fighters.js";
import { attackPresentation, cinematicFrame } from "../src/game/cinematics.js";
test("all shipped human assets load, articulate, and retain finite bounds through every technique", async () => {
  for (const f of FIGHTERS) {
    const name = f.model;
    const bytes = await readFile(
      new URL(`../public/models/${name}-human.glb`, import.meta.url),
    );
    const gltf = await createTexturedGltfLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    );
    const fighter = createRiggedFighter(gltf, f.color, f.style);
    fighter.model.traverse(o=>{
      if(o.isSkinnedMesh)assert.ok(o.geometry.getAttribute('uv'),'compression preserves cloth UVs');
    });
    const rest = fighter.hands[0].getWorldPosition(new THREE.Vector3());
    const anatomy = new THREE.Box3();
    fighter.model.traverse(o=>{if(o.isSkinnedMesh)anatomy.union(new THREE.Box3().setFromObject(o));});
    const size = anatomy.getSize(new THREE.Vector3());
    assert.ok(size.y > 1.8 && size.y < 2.7, "anatomy fits the arena scale");
    for (const weapon of ["rock", "paper", "scissors"])
      for (const final of [false, true])
        for (let variant = 0; variant < 3; variant++) {
          const presentation = {
            ...attackPresentation(weapon, final, false, variant, f.id),
            playerWeapon: weapon,
            outcome: "win",
            finalHit: final,
          };
          for (const p of [0.3, 0.5, 0.64, 0.85]) {
            fighter.setWeapon(weapon);
            fighter.pose(
              cinematicFrame(presentation, (presentation.duration / 1000) * p)
                .attacker,
            );
            fighter.root.updateMatrixWorld(true);
            const hand = fighter.hands[0].getWorldPosition(new THREE.Vector3());
            assert.ok(hand.toArray().every(Number.isFinite));
            if(f.style==='archer'||f.style==='glaive'){
              const grip=fighter.gripPoints();
              assert.ok(grip.rightPalm.distanceTo(grip.shaft)<.025,`${f.id} ${weapon}: support hand stays on the weapon`);
            }
          }
        }
    assert.ok(
      fighter.hands[0].getWorldPosition(new THREE.Vector3()).distanceTo(rest) >
        0.02,
      "pose changes the skinned hand",
    );
  }
});
test("weapon choreography produces distinct trajectories and poses, including normal variants", () => {
  const paths = new Set();
  for (const weapon of ["rock", "paper", "scissors"])
    for (let variant = 0; variant < 3; variant++) {
      const a = {
        ...attackPresentation(weapon, false, false, variant),
        playerWeapon: weapon,
        outcome: "win",
      };
      paths.add(
        JSON.stringify(
          [0.32, 0.43, 0.55, 0.65].map(
            (p) => cinematicFrame(a, (a.duration / 1000) * p).attacker,
          ),
        ),
      );
    }
  assert.equal(paths.size, 9);
});

test("five weapon kits have 45 distinct normal paths and 30 distinct finishers", () => {
  const paths = new Set(),
    finals = new Set();
  for (const f of FIGHTERS)
    for (const weapon of ["rock", "paper", "scissors"])
      for (let variant = 0; variant < 3; variant++) {
        const a = {
          ...attackPresentation(weapon, false, false, variant, f.id),
          playerWeapon: weapon,
          outcome: "win",
        };
        paths.add(
          JSON.stringify(
            [0.23, 0.35, 0.47, 0.55, 0.64].map(
              (p) => cinematicFrame(a, (a.duration / 1000) * p).attacker,
            ),
          ),
        );
        if (variant === 0) for (const finisherIndex of [0, 1]) {
          const fin = {
            ...attackPresentation(weapon, true, false, 0, f.id, null, finisherIndex),
            playerWeapon: weapon,
            outcome: "win",
            finalHit: true,
          };
          finals.add(
            JSON.stringify(
              [0.2, 0.4, 0.6, 0.8].map(
                (p) => cinematicFrame(fin, (fin.duration / 1000) * p).attacker,
              ),
            ),
          );
        }
      }
  assert.equal(paths.size, 45);
  assert.equal(finals.size, 30);
});
