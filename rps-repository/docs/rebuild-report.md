# Rebuild delivery report

This report describes the playable rebuild and its practical limits. The exact code changes and binary assets are available in the Git commit diff; `changed-files.txt` lists every changed path relative to the repository root.

## Changes by phase

**A, architecture:** Central encounter definitions keep names, weapons, costumes, and tells consistent. Sixty authored move timelines have pose/root/camera/effect/audio/contact/reaction data. Version-two saves migrate earlier runs, retaining health, progress, character, and inventory.

**B, characters:** Five compressed, clothed anatomical models include boots, hair, eyes, brows, cuffs, fasteners, and accessories. A continuous garment surface replaces intersecting duplicate clothing. Original modular geometry builds rival costumes and six separate boss silhouettes. Two-joint limb solving keeps weapons held, including reachable sliding glaive grips and bow nocks. Procedural cloth maps and reflected lighting replace flat unlit surfaces.

**C, cinematics:** Separate anticipation, travel, impact, and recovery shots use authored root motion and anatomical targets. Combatants close distance and defenders stagger, launch, trip, spin, break guard, or bounce. Heavy moves have hit stop. Finishers retain hidden damage until impact and include a distinct collapse/recovery. Six boss signatures and district-specific defeat poses supplement the player moves.

**D, arenas:** Six district kits contain trains, rails, traffic, furnaces, pistons, orbiting prisms, market stalls/crowds, antenna plants, water, moving cranes, boats, and containers. Each kit has three dressing layouts and additional seeded placements. Weather, traffic, and boss phases change scenery motion and lighting.

District floors also use separate asphalt, steel plate, glass, cobble, moss and dock plank maps.

**E, encounters and progression:** Twenty-four named rivals use seeded personality distributions and tell reliability. Scheduled minibosses, six bosses, phase thresholds, signature warnings, thirty-two stackable perks, and six boss rewards extend the original combat. Victory leads through a three-choice reward screen and route doors. Shops and events have free exits. Every new opponent starts with full player health.

**F, effects:** Actual weapon edges feed ribbon trails. Contact particles, dust, magic shards, projectiles, impact lights, and posed afterimages replace detached combat rings. Bloom, chromatic impact pulses, grain, vignette, and static distortion scale down in lightweight mode. Materials and renderer resources are disposed on arena teardown.

**G, interface/audio:** The title has a live hero scene and character selection has a 3D turntable. The arena HUD includes delayed health drain, phase segments, perk summaries, personality tells, and signature warnings. Route doors and room screens stay inside the game viewport. Existing fullscreen, keyboard, touch, optional tutorial, and calculus controls remain. Original synthesized encounter stingers, hit layers, and boss-phase layers join the existing dynamic music, heartbeat, muffling, and finisher silence.

The arena and impact overlay use the same monotonic attack start time. The overlay registers reveal deadlines before painting, preventing a delayed effect from revealing damage after the cinematic has already ended. Encounter intros wait for the first rendered fighter frame and use the full arena viewport.

**H, verification:** Unit tests, seeded simulations, browser checks, an offline test, a WebGL-disabled touch test, and real-game fixed-beat attack capture scripts are included. Captures and numerical distances are separate checks: a unique vector path alone is insufficient evidence of good cinematography.

## Build and review

Requires Node 24.5+, npm, and Chromium for browser checks. Blender 4.3+ is only needed to regenerate the shipped models. Pillow is only needed to assemble contact sheets.

```sh
npm ci
npm run build
npm test
VITE_BASE_PATH=/rps/ npm run build:static
VITE_BASE_PATH=/rps/ npm run preview -- --host 127.0.0.1
```

For development capture and encounter verification:

```sh
npm run dev
npm run simulate
npm run proof
npm run capture:attacks
node scripts/encounter-smoke.mjs
node scripts/browser-smoke.mjs
node scripts/training-smoke.mjs
node scripts/fallback-smoke.mjs
```

Set `TEST_URL` to a running static preview for `scripts/offline-smoke.mjs`. The attack and encounter capture scripts require the development build because the fixture hook is intentionally absent from production. Do not edit imported source while capturing; Vite reloads invalidate the stepped presentation clock.

## Dependencies and licenses

The only added npm dependency is **gltfpack 1.3.0**, a development tool under the MIT license. The model decoder already ships with Three.js. No paid service or browser API key is required. The optional OpenRouter server retains its free-model restriction and local fallback.

MakeHuman anatomy, rig, weights, and morph targets are CC0. Anton, Barlow Condensed, and Chakra Petch are self-hosted under the SIL Open Font License. Costume geometry, weapons, procedural maps, scenery, animation, and synthesized music are original. Notices are in `public/licenses/`, including the complete gltfpack MIT notice.

## Verification evidence

| Check | Result |
|---|---|
| Clean dependency installation | `npm ci` passed. |
| Production compilation | `npm run build` and the static `/rps/` build passed. Vite reports the existing large graphics-chunk warning. |
| Unit and integration tests | 56 passed, zero failed. |
| Seeded simulation | 1,000 seeds per policy, 3,000 total; no softlocks or invalid resources. Tactical play reached floor 20 in 79.5% of runs; random play did so in 0.1%. |
| Choreography distance | 60 sequences, all 1,770 pairs; minimum combined distance 0.405659, threshold 0.18, zero collisions. |
| Real-game attack capture | 240 fixed-beat frames, four per sequence, assembled into five original PNG contact sheets. |
| General browser checks | 15 checks passed, including measured audio output, mute/resume, actual fullscreen, touch, layout bounds, character selection, inventory, saves and progression. |
| Boss and miniboss browser checks | Six boss intros, twelve phase transitions and signature warnings, plus six miniboss model/health checks passed without exceptions or failed assets. |
| Production WebGL fallback | Touch combat and all five route types passed; free exits, full health and visible phone controls verified. |
| Production tutorial and player finishers | Optional touch tutorial, calculus controls and all fifteen player finishers passed; damage remained hidden until impact. |
| Offline production checks | All five assets cached; entry/fonts/scripts/arena loaded offline; measured music, mute/resume, actual fullscreen, earned attacks and saving passed. |

The simulation data is in `simulation-results.json`; browser evidence is in `browser-validation.json`. The published `proof/` gallery contains the five PNG contact sheets, smaller WebP previews, fixed-beat capture manifest, all pair distances in CSV/JSON, and real-game boss/miniboss screenshots. It is separate from the offline game's core cache so the large review sheets do not inflate the first game download.

## Known limits

- This is stylized procedural art. It does not meet the original request for hyperrealistic commercial-game graphics.
- Bosses have different original geometry assemblies, but retain a common anatomical skeleton and base bodies. Minibosses also share roster anatomy. These are not separately sculpted anatomical characters.
- Cloth motion uses periodic deformation, and facial animation uses bones rather than a complete expression blendshape library. Hair is shaped geometry with limited secondary motion.
- The sixty sequences have distinct authored poses, paths, camera rigs, rhythms, and effects, but reuse the evaluator and six reaction families. The move library is finite; endless encounters recombine authored content rather than generating an infinite set of entirely new animations.
- The three district layouts change dressing and placement around the district's main structures. They are not three independent architectural maps per district.
- Reflection is environment based; there is no screen-space reflection, true volumetric scattering, or depth-of-field pass. Contact particles use buffered/instanced geometry, not GPU compute simulation.
- The five models total approximately 2.1 MB and are fetched when the arena mounts. Physical mid-range phone GPU performance has not been measured, so 60 fps is a target rather than a verified result. Software-rendered browser checks exercise lightweight mode.
- Simulations use defined policies, not human playtests. Their success curve measures resource and progression consistency, not how engaging the game will be for every player.

## Art review and release status

These are subjective, deliberately strict scores from reviewing the captured game frames. Passing tests does not raise an art score. The requested minimum of 8 in every category has **not** been reached. The user authorized publication as a **playable preview** on October 10, 2026; this is not a claim that the visual brief is finished.

| Category | Score / 10 | Reason |
|---|---:|---|
| Characters | 6 | Clothing, eyes, grips and silhouettes improved, but faces, hair and garment shaping still look procedural. |
| Variety | 8 | Sixty authored move timelines, six scenery kits, seeded rivals, perks and route choices provide measurable variety. |
| Cinematics | 6.5 | Contact, shot changes and reactions are present; pose transitions and performance still need authored animation polish. |
| Arenas | 7 | District-specific moving structures and floors read distinctly, but the scene composition and atmospheric effects remain simple. |
| Bosses | 6 | Large, different costume assemblies and phase behavior are visible; shared anatomy falls short of independent boss sculptures. |
| Feel | 7 | Input, hit layers, silence, health trails and adaptive music work; convincing character motion and player testing remain necessary. |
| UI | 8 | Fullscreen arena controls, touch layouts, readable earned attacks and integrated progression screens are functional. |

The weakest point is character and boss art. Fitted costumes, independent boss bodies, better facial expression shapes and authored motion are needed before the requested visual quality gate can honestly pass. Phase-by-phase artistic acceptance was not completed, and the table above does not claim otherwise.

## Next five upgrades

1. Commission or sculpt six independent boss bodies and six miniboss bodies with fitted costumes and facial expression shapes.
2. Add animation clips authored against the final rigs, with per-move contact markers and more detailed footwork.
3. Replace dressing variants with larger independent arena layouts, more varied landmark silhouettes and stronger atmospheric lighting.
4. Profile real phones, then tune geometry, draw calls, asset loading, effects, and automatic quality thresholds against those measurements.
5. Run player sessions to tune tell difficulty, perk balance, pacing, music motifs, and readability using observed play rather than simulated policies alone.
