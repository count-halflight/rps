# Trinity: afterlight

[Play on GitHub Pages](https://count-halflight.github.io/rps/)

A free React and Three.js fighting game by Halflight. Pick one of five fighters, win a rock, paper, scissors hand, then choose an attack or use an item. The rival attacks if you lose. Draws deal no damage. Endless floors change rivals, districts, boss abilities, and upgrades.

## Play

Press **Play**, choose a fighter, and confirm. **Continue** resumes a saved run. Use **New game · choose a fighter** to change fighters on a fresh run. A trusted Play gesture starts music unless sound is off.

Fullscreen is available on the title screen, in the arena, and in the pause menu, or by pressing **F**. Installed apps request fullscreen where supported.

On a phone, tap a hand, then tap an attack or **Items** after winning. Each fighter has three attacks for each won hand. Their weapons stay equipped throughout combat.

| Fighter | Weapon       | Starting health | Starting charge |
| ------- | ------------ | --------------- | --------------- |
| Echo    | Twin blades  | 100             | 20              |
| Cinder  | Impact wraps | 120             | 10              |
| Nyx     | Prism staff  | 90              | 40              |
| Vex     | Arc bow      | 95              | 30              |
| Kuro    | Storm glaive | 110             | 20              |

Quick attacks build 14 charge. Safe attacks deal less damage and build 22 charge. Heavy attacks cost 40 charge for double damage and lock at 75 heat. Medkits restore 35 health, coolant clears 40 heat, and batteries restore 35 charge. Items consume the winning action instead of dealing damage. Clear a floor to upgrade your fighter and receive one item, up to five per type.

**Options** contains a once-per-floor scan for 30 charge, defensive bracing, rules, and optional calculus. Brace halves incoming damage when you lose. The rival's tell is a forecast and can be wrong.

| Control        | Action                                                         |
| -------------- | -------------------------------------------------------------- |
| 1 / 2 / 3      | Select rock / paper / scissors; choose an attack after winning |
| Space or Enter | Reveal the selected hand when a button is not focused          |
| Escape         | Pause or close a menu                                          |
| F              | Toggle fullscreen                                              |
| Tab / Enter    | Navigate and activate buttons                                  |

**The tutorial is optional.** Three drills teach counters and heavy attacks, followed by a fight against Cinder. Your main run is preserved while you train.

## Arena and sound

The game uses full-screen duels with skinned human fighters, animated 3D scenery, and short action sequences. The five weapon kits have 45 normal movement paths and 15 finishing paths. Blade combinations, punches, staff casts, bow volleys, and glaive sweeps have different poses and trajectories. Finishers hide damage until impact.

Six districts have separate geometry and rules: a rainy rail crossing, pumping foundry, orbiting prism vault, lantern market, signal garden, and moving docks. Later floors add anomalies. Every fifth floor has a boss with one of six abilities. The prism vault reverses the counter cycle, so follow the matchup labels.

The original synthesized music has percussion, bass, chords, and a lead. It builds as the rival weakens, becomes muffled as your health falls, and adds a heartbeat. Finishers build toward a short silence before impact. Mute, volume, music, graphics, and reduced motion are in settings.

Progress, inventory, records, unlocked weapon colours, and settings save on this device. Daily runs use a shared UTC seed. Clearing browser storage removes local progress. There are no accounts, ads, purchases, or energy timers.

## Optional calculus

Open **Calculus** inside Options. Derivatives explain heat change. Limits show the approach to the heavy attack's heat boundary. Integrals collect a changing impact rate into total damage. Paper attacks and Nyx's staff casts show glowing Riemann slices in the arena.

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
node scripts/offline-smoke.mjs
```

`TEST_URL` selects the server. `BROWSER_HEADED=1` optionally uses a desktop display instead of headless Chromium. Browser checks exercise trusted mouse and touch gestures, actual audio output, five-character selection, earned actions, inventory, saving, focus, progression, mobile layouts, training, mathematics, and finisher timing. Reports and screenshots go in ignored `artifacts/`. Offline checks require a production static build.

## GitHub Pages

The repository's `.github/workflows/pages.yml` builds, tests, and publishes changes on `main`. Pages uses **GitHub Actions** as its source. The URL is https://count-halflight.github.io/rps/.

The Pages build uses `VITE_BASE_PATH=/rps/` for scripts, fonts, models, art, the manifest, and offline caching. Check it locally with:

```bash
VITE_BASE_PATH=/rps/ npm run build:static
VITE_BASE_PATH=/rps/ npm run preview
```

Static hosting needs no API key. The service worker caches the game and all five fighters. Wait for the first download before going offline. Updated caches activate after older game tabs close.

## Optional rival stories

The Node service can generate short stories through OpenRouter. Combat works without it. GitHub Pages uses local stories.

Set `OPENROUTER_API_KEY` in secure server settings or an ignored `.env` file. Never put it in browser code. Only `openrouter/free` and model IDs ending in `:free` are accepted. Missing credentials, quotas, malformed output, and provider failures fall back to local stories. No provider call is required to play.

## Art and source

- `src/game/engine.js`: seeded exchanges, earned item actions, progression, save recovery.
- `src/game/fighters.js`: five character kits, hand-specific moves, inventory.
- `src/game/cinematics.js`: weapon-specific movement and finishing sequences.
- `src/components/Arena.jsx`, `environments.js`, `riggedFighter.js`: animation, scenery, rigged human characters and weapon geometry.
- `src/game/audio.js`: original synthesized soundtrack and combat sounds.
- `scripts/build_fighters.py`: Blender 4.3+ character build script. Run `blender --background --python scripts/build_fighters.py`.
- `assets/source/makehuman/`: CC0 anatomical mesh, skeleton, and weights. Clothing details, hair, accessories, and choreography were added for this project.
- `public/art/afterlight-cover.png`: title artwork generated for this project.

The code is [MIT licensed](LICENSE). MakeHuman's anatomical mesh, skeleton, and weights are CC0, credited to Data Collection AB, Joel Palmius, and Jonas Hauquier. Anton, Barlow Condensed, and Chakra Petch are self-hosted under the SIL Open Font License. Dependency and art notices are in `public/licenses/`.

Adaptive graphics lowers pixel density and disables shadows on slower devices. Lightweight mode can be selected manually. Reduced motion removes camera movement, reduces actor travel, and shortens sequences. Combat remains playable without WebGL. Browser testing here uses software rendering; physical phone GPU performance has not been measured.
