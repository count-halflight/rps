# Trinity: afterlight

[Play on GitHub Pages](https://count-halflight.github.io/rps/)

This playable preview adds the gothic Echo/Docks slice, authored reflection strikes, a revised game HUD and district ambience. The full Ultra rebuild remains unfinished: four canonical attacks are authored out of a planned 65, and the visual slice has not passed its art acceptance gate. The user explicitly authorized publishing the current preview and continuing the remaining work later. See the [current project state](docs/ultra-project-state.md) and [actual rendered review](docs/ultra-phase-a-review.md). The verification claims below describe the previous published release.

The previous published upgrade has a completed 75-attack capture gallery, passing production and `/rps/` static builds, and 80 passing tests. Its local checks include offline and no-WebGL play. See the [previous published upgrade report](docs/cinematic-upgrade.md) and [125-file change manifest](docs/changed-files-upgrade.md). The [earlier rebuild report](docs/rebuild-report.md) records the previous preview and its art limitations.

[Desktop screenshots](https://count-halflight.github.io/rps/proof/#desktop) · [Finisher gallery](https://count-halflight.github.io/rps/proof/#finishers) · [Latest deployment](https://github.com/count-halflight/rps/actions/workflows/pages.yml).

A free React and Three.js fighting game by Halflight. Pick one of five fighters, win a rock, paper, scissors hand, then choose an attack or use an item. The rival attacks if you lose. Draws deal no damage. Endless floors change rivals, districts, boss abilities, and upgrades.

## Play

Press **Play**, choose a fighter, and confirm. **Continue** resumes a saved run. Use **New game · choose a fighter** to change fighters on a fresh run. A trusted Play gesture starts music unless sound is off.

Fullscreen is available on the title screen, in the arena, and in the pause menu, or by pressing **F**. Installed apps request fullscreen where supported.

On a phone, tap a hand, then tap an attack or **Items** after winning. Each fighter has three attacks for each won hand. Their weapons stay equipped throughout combat.

With **Cinematic prompts** enabled, player attacks include timed inputs: one per normal attack and two per finisher. Press the displayed **1**, **2**, or **3**, or tap the target before its ring closes. A correct input inside the open prompt window earns **3 charge** and strengthens the visual follow-up; inputs before it opens or after it closes earn none. A miss changes that flourish while preserving the damage and knockout earned through the hand. Disable prompts in Settings for automatic scenes. Reduced motion and tutorial fights skip them, without adding prompt rewards.

| Fighter | Weapon       | Starting health | Starting charge |
| ------- | ------------ | --------------- | --------------- |
| Echo    | Twin blades  | 100             | 20              |
| Cinder  | Impact wraps | 120             | 10              |
| Nyx     | Prism staff  | 90              | 40              |
| Vex     | Arc bow      | 95              | 30              |
| Kuro    | Storm glaive | 110             | 20              |

Every new opponent starts with your health fully restored, including any max-health upgrades. Continue preserves damage during an unfinished fight. Quick attacks build 14 charge. Safe attacks deal less damage and build 22 charge. Heavy attacks cost 40 charge for double damage and lock at 75 heat. Medkits restore 35 health, coolant clears 40 heat, and batteries restore 35 charge before perk bonuses. Items consume the winning action instead of dealing damage.

Victory gives three seeded reward choices, then three route doors. Choose a regular fight, elite fight, rest stop, event, or supply stall. Rest and event rooms lead into the next fight; shops always offer a free exit. Scheduled guardians remain on their floors. Thirty-two stackable perks and six boss rewards modify damage, cooling, charge, bracing, scans, healing, and credits. Inventory is capped at five per item.

**Options** contains a once-per-floor scan for 30 charge, defensive bracing, rules, and optional calculus. Brace halves incoming damage when you lose. The rival's tell is a forecast and can be wrong.

| Control        | Action                                                         |
| -------------- | -------------------------------------------------------------- |
| 1 / 2 / 3      | Select rock / paper / scissors; choose an attack after winning; answer a displayed cinematic prompt |
| Space or Enter | Reveal the selected hand when a button is not focused          |
| Escape         | Pause or close a menu                                          |
| F              | Toggle fullscreen                                              |
| Tab / Enter    | Navigate and activate buttons                                  |

**The tutorial is optional.** Three drills teach counters and heavy attacks, followed by a fight against Cinder. Your main run is preserved while you train.

## Arena and sound

The game uses full-screen duels with skinned human fighters, animated 3D scenery, and authored action sequences. Each fighter has a distinct anatomical model, sculpted hair, tailored clothing, boots and weapon. Hands, elbows, knees and planted feet use a two-joint pose solver. The five weapon kits have **45 normal attacks and 30 finishers**. Multiple contacts move the attacker and opponent around the arena and into the air; directed cameras follow those movements. Damage stays hidden until the final impact. Blade trails follow weapon edges over a fixed **160 ms** history, keeping their time span independent of frame rate.

Each fighter has two finishing sequences for each hand, selected deterministically as the run advances. Cinder's rock finisher, **Orbit breaker**, launches the opponent into space, kicks them through planets and returns to the same arena for a ground impact. Nyx's paper finisher, **Event horizon**, draws the opponent into a black hole and stretches their silhouette before collapse. Kuro's scissors finisher, **Iron cyclone**, traps the opponent in a mechanical blade chamber. Echo's rock finisher, **Fault sever**, separates concrete pavement around a ground fracture. The other sequences include mirrors, crystal prisons, meteors, a miniature sun, water, tethers, time fractures and an energy serpent. The [complete finisher roster](docs/cinematic-upgrade.md#finisher-roster) lists all 30.

Six districts have separate geometry and rules: a rainy rail crossing, pumping foundry, orbiting prism vault, lantern market, signal garden, and moving docks. Each has three dressing layouts with further seeded placement variation. Twenty-four named rivals have consistent costume, character, weapon, personality, and tells. Minibosses appear on floors whose remainder after division by five is three, or through an elite door. Every fifth floor has a district boss with an entrance, two phase thresholds, a signature warning, arena changes, and a unique reward. The prism vault reverses the counter cycle, so follow the matchup labels.

Trains and cars pass, furnaces and pistons work, market cloth and lanterns sway, plants move in wind, and harbour water, boats, and cranes move. Later district cycles vary weather and traffic. Reflected lighting, cloth weave, bloom and film shading add surface detail. Lightweight graphics reduce distant scenery, atmosphere, shadows and postprocessing; reduced motion holds the camera and scenery steady. The five compressed models total **3,446,248 bytes**, about **3.3 MiB**. Six original **1672 × 941** WebP background images add distant scenery behind the live district props. High-graphics captures of all six districts and all five fighters passed without errors or missing assets. Frame rate depends on the device.

Six original synthesized district scores have separate melodies, harmony, bass, percussion and instrumentation. Each develops over a 28-bar arrangement with an intro, verse, lift, breakdown, reprise and finale. Music builds as the rival weakens, becomes muffled as your health falls, and adds a heartbeat. Finishers have 30 separate sound palettes and build toward a short silence before impact. Mute, volume, music, graphics, reduced motion and cinematic prompts are in settings.

Progress, inventory, records, unlocked weapon colours, and settings save on this device. Daily runs use a shared UTC seed. Clearing browser storage removes local progress. There are no accounts, ads, purchases, or energy timers.

## Optional calculus

Open **Calculus** inside Options. Derivatives explain heat change. Limits show the approach to the heavy attack's heat boundary. Integrals collect a changing impact rate into total damage. Nyx's paper attacks collect glowing Riemann slices in the arena.

The normalized pulse is `f(t) = 6D t(1−t)` on `[0,1]`, with exact integral `D`. Compare 8, 24, and 64 midpoint slices. Heat and charge projections share the combat engine's calculations, including district, upgrade, and boss effects. Learning never blocks combat.

## Development

Requires Node.js 24.5+ and npm.

```bash
npm ci
npm run dev
```

The development launcher starts Vite and the optional encounter service. `API_PORT` changes the service's default port of 3001. A production server is available with `npm run build` and `npm start`.

```bash
npm run build:static
npm test
```

Build before testing: the HTTP checks exercise production assets. With Chromium and a running app:

```bash
node scripts/browser-smoke.mjs
node scripts/training-smoke.mjs
node scripts/cinematic-smoke.mjs
node scripts/offline-smoke.mjs
npm run simulate
npm run proof
npm run capture:attacks
```

`TEST_URL` selects the server. `BROWSER_HEADED=1` optionally uses a desktop display instead of headless Chromium. Browser checks exercise trusted mouse and touch gestures, actual audio output, five-character selection, earned actions, inventory, saving, focus, progression, mobile layouts, training, mathematics, and finisher timing. Reports and screenshots go in ignored `artifacts/`. Offline checks require a production static build.

The clean install, final production build, final **`VITE_BASE_PATH=/rps/` static build** and **all 80 tests passed**. The simulation completed **3,000 seeded runs** across three policies with **zero softlocks**. The real-game cinematic browser pass completed **seven checks** covering successful and missed prompts, delayed impact, exact charge rewards, continued play and guarded intro controls. High-graphics review covered the title, all five fighters and all six districts. Encounter checks covered all six bosses, their twelve phase transitions and all six elites. These browser runs recorded zero errors or missing assets.

The final production `/rps/` offline browser run passed **eight checks** with zero JavaScript exceptions: all five models and six backgrounds cached, offline entry/fonts/scripts/arena, real music output, mute/resume, fullscreen, frozen-scene redraw and resume after a paused desktop resize, gallery navigation preserving the offline game entry, and an earned attack with saved progress. The audio context ran with a measured output peak of **0.046446386**. The production no-WebGL fallback passed **six checks**: earned touch combat and all five route types reaching the next fight with full health and usable controls.

The attack proof compares all **2,775 pairs of 75 sequences**. The complete actual-game capture passed with **75 sequences, 330 frames, zero errors and zero missing assets**. Captures use trusted game controls with a stepped presentation clock, warming the trail renderer over the **60 ms before each fixed beat**. The refreshed gallery contains five **1280 × 3645** PNG contact sheets with WebP copies, 30 finisher world shots, 12 desktop high-graphics shots and 12 boss/elite shots. Four affected sequences were recaptured after scene-visibility and crystal-transparency fixes, and the gallery was assembled from the latest frames. `CAPTURE_SAMPLE` accepts comma-separated sequence IDs for a local sample without replacing the full public gallery. Lightweight graphics make software-rendered verification practical. The development fixture hook is removed from production builds. Numeric path separation checks choreography variety, not artistic quality.

The [content bible](docs/content-bible.md) records the established roster, bosses, perks and previous timelines. The [cinematic upgrade report](docs/cinematic-upgrade.md) describes the current attack catalog, artwork, sound and verification status. The [complete change manifest](docs/changed-files-upgrade.md) lists 125 changed files relative to preview commit `e9b77c608e8f704e5e07758121966ecd46a77f2d`, with a link to the source comparison. The [earlier rebuild report](docs/rebuild-report.md) remains available as preview history.

## GitHub Pages

The repository's `.github/workflows/pages.yml` builds, tests, and publishes changes on `main`. Pages uses **GitHub Actions** as its source. The URL is https://count-halflight.github.io/rps/.

Publication uses the **Publish game** workflow. [Check the latest deployment](https://github.com/count-halflight/rps/actions/workflows/pages.yml) for its status and exact release commit.

The Pages build uses `VITE_BASE_PATH=/rps/` for scripts, fonts, models, art, the manifest, and offline caching. Check it locally with:

```bash
VITE_BASE_PATH=/rps/ npm run build:static
VITE_BASE_PATH=/rps/ npm run preview
```

Static hosting needs no API key. The service worker caches the game, district backgrounds and all five fighters. Opening the proof gallery cannot overwrite the cached game entry. Wait for the first download before going offline. Updated caches activate after older game tabs close.

## Optional rival stories

The Node service can generate short stories through OpenRouter. Combat works without it. GitHub Pages uses local stories.

Set `OPENROUTER_API_KEY` in secure server settings or an ignored `.env` file. Never put it in browser code. Only `openrouter/free` and model IDs ending in `:free` are accepted. Missing credentials, quotas, malformed output, and provider failures fall back to local stories. No provider call is required to play.

## Art and source

- `src/game/engine.js`: seeded exchanges, earned item actions, progression, save recovery.
- `src/game/fighters.js`: five character kits, hand-specific moves, inventory.
- `src/game/cinematics.js`: weapon-specific movement and finishing sequences.
- `src/game/attackCatalog.js`, `poseKeys.js`, `cameraRigs.js`: authored beat, pose, root-motion, and camera data.
- `src/game/qte.js`, `src/components/CinematicQte.jsx`: timed input windows, prompt display and bounded charge rewards.
- `src/components/cinematicWorld.js`, `alternateCinematicSets.js`: original three-dimensional finisher sets, planets, black hole, mechanical chamber and alternate constructions.
- `src/game/rivals.js`, `perks.js`, `routes.js`: consistent encounters, boss phases, reward effects, and room choices.
- `src/components/Arena.jsx`, `environments.js`, `riggedFighter.js`: animation, scenery, rigged human characters and weapon geometry.
- `src/components/poseRig.js`, `wardrobe.js`, `combatEffects.js`, `filmRenderer.js`: joint solving, original costume geometry, contact effects, and material/postprocessing passes.
- `src/game/audio.js`, `audioProfile.js`: six original score charts, layered synthesized music and separate finisher sound palettes.
- `src/arcade.css`: arcade health plates, control dock, fighter roster, title menu and encounter composition.
- `scripts/build_fighters.py`: Blender 4.3+ character build script. `npm run build:models` builds and compresses all fighters with pinned gltfpack. Meshopt decoding ships with Three.js; the bone names and cloth UVs are preserved.
- `assets/source/makehuman/`: CC0 anatomical mesh, skeleton, weights and morph targets from the [official MakeHuman source](https://github.com/makehumancommunity/makehuman/tree/master/makehuman/data/targets/macrodetails). Clothing details, hair, accessories, and choreography were added for this project.
- `public/art/afterlight-cover.png`: title artwork generated for this project.
- `public/art/arena-{rain,foundry,vault,market,garden,docks}.webp`: six original image-generated district backgrounds, totaling **4,091,132 bytes**. See [the original environment-art notice](public/licenses/Original-Environment-Art.md).

The code is [MIT licensed](LICENSE). MakeHuman's anatomical mesh, skeleton, weights and morph targets are CC0, credited to Data Collection AB, Joel Palmius, Jonas Hauquier and original author Manuel Bastioni. Source target files retain their release notices. Anton, Barlow Condensed, and Chakra Petch are self-hosted under the SIL Open Font License. Dependency and art notices are in `public/licenses/`.

Adaptive graphics lowers pixel density and disables shadows on slower devices. Lightweight mode can be selected manually. Reduced motion removes camera movement, reduces actor travel, shortens sequences and skips timed prompts. Combat remains playable without WebGL. Desktop visuals are the priority for this upgrade, with basic phone and touch compatibility retained. Browser testing here uses software rendering; physical phone GPU performance has not been measured.

Bosses and minibosses use original district-specific geometry assemblies on the shared anatomical skeleton. They are not separately sculpted anatomical assets. Worlds and costumes use procedural surfaces; the project does not contain photogrammetry, motion capture, recorded voice acting, or a commercial game soundtrack.

Further visual work can refine facial expressions, contact poses and camera staging. This upgrade remains a stylized playable game; no final art score or commercial-hyperrealism claim is assigned to it.
