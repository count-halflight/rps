# Trinity: afterlight

A free, single-player cyberpunk combat game built with React and Three.js. Rock, paper, and scissors become a kinetic gauntlet, a phase shield, and twin pulse blades. Read your rival's signal, manage your frame, and descend through an endless procedural circuit.

## Play

Select a weapon and press **Engage**. A successful counter prevents incoming damage and builds a damage chain. Signals show their actual probability of predicting the next attack; they can be wrong.

On a phone, tap the three weapon cards and the full-width Engage button. The optional **Tactics** panel contains stances, scanning, and repairs. All gameplay works with touch.

**Training is optional.** Enter from the opening screen or field guide. Three guided drills teach the counter cycle and overdrive, then Cinder provides a tutorial apex encounter. Training preserves your main run and records; leaving or reloading returns to your saved circuit.

Each weapon has its own cinematic technique and finishing attack. When a counter could finish a weakened rival, the music builds, briefly cuts, and the result remains hidden until impact. A blocked attempt uses the same opening. Reduced motion shortens the sequence and removes camera movement.

The soundtrack accelerates as the rival weakens. Low player integrity muffles the music and introduces a heartbeat. Sound starts only after it is enabled by the player; volume, ambient music, and mute controls are in settings.

## Learn through the fight

Open **Signal lab** inside Tactics for optional calculus explanations. Derivatives show the selected protocol's actual heat rate. Limits show the approach to the 75-heat overdrive boundary. Integrals collect a pulse's changing impact rate into total damage. Veil's cinematic constructs that area with glowing Riemann slices.

The normalized pulse uses `f(t) = 6D t(1−t)` on `[0,1]`, whose exact integral is `D`. Compare 8, 24, and 64 midpoint slices to see the approximation converge. Heat and charge projections share the combat engine's calculation, including cooling, augments, anomalies, and thermal apex effects. The mathematics is optional and never blocks an attack.

| Control        | Action                                  |
| -------------- | --------------------------------------- |
| 1 / 2 / 3      | Select Seismic / Veil / Razor           |
| Space or Enter | Engage, when a button is not focused    |
| Escape         | Pause or close a menu                   |
| Tab / Enter    | Navigate and activate interface buttons |

## The circuit

Six districts have different scenery and rules: cooling rain, furnace heat, an inverted counter cycle, extra bounties, restorative draws, and distorted signals. Later floors combine those rules with additional anomalies. Rivals use aggressive, methodical, or adaptive patterns.

Every fifth floor contains an apex frame with one of six abilities. Clear a floor to salvage an augment. Manage charge and heat, spend credits on a repair, and decide when a guaranteed deep scan is more useful than overdrive. The circuit has no final floor; enemy integrity and damage continue scaling.

Your current run, records, settings, and seven earned frame finishes save on this device. The archive also contains a daily circuit with a shared UTC seed, matching encounters and salvage for every player, and your personal best for the day. Clearing browser storage removes them. There are no accounts, ads, purchases, energy timers, or paid assets.

## Run locally

Requires **Node.js 24.5 or newer** and npm.

```bash
npm ci
npm run dev
```

The development command starts Vite and the local encounter service together. The service watches backend changes. Use `API_PORT` to change its default port of 3001; Vite arguments can be passed after `--`.

```bash
npm run build
npm start
```

The production server serves `dist/` and the optional encounter API on port 3001. `PORT` changes the port; `HOST=0.0.0.0` allows access from other devices. HTTPS is required for home-screen installation and offline caching outside loopback development. A static host can also serve `dist/`; the game uses local dossiers when the API is unavailable.

The production build creates an installable web app and caches the game, models, fonts, and all six arenas. Wait for the initial download to finish before going offline. Updates become active after older game tabs close.

## Free static hosting

GitHub Pages is configured through `.github/workflows/pages.yml`. In the repository's **Settings → Pages**, select **GitHub Actions** as the source. The **Publish game** workflow builds, tests, and deploys updates from `main`. The game URL is `https://count-halflight.github.io/rps/`. If the initial workflow ran before Pages was enabled, rerun it from the Actions tab.

The Pages build uses `VITE_BASE_PATH=/rps/`, including model loading, arena images, the app manifest, and offline caching. To check that build locally, run `VITE_BASE_PATH=/rps/ npm run build:static` and `VITE_BASE_PATH=/rps/ npm run preview`, then open the preview's `/rps/` path. Root-domain hosting keeps its default `/` base.

The repository includes root configuration for Netlify and Vercel. Import the `count-halflight/rps` repository into an existing hosting account. Both configurations build `rps-repository` and publish its static output. Static hosting uses local rival stories and needs no API key.

For a manual upload, run `npm run build:static`, sign into [Netlify Drop](https://app.netlify.com/drop), and drag the `dist/` folder onto the page. If using the prepared ZIP, extract it first and upload the folder containing `index.html`. Netlify provides the public HTTPS game link. This route does not require GitHub access or an API key. To keep the normal server build intact while preparing an upload, use `npm run build:static -- --outDir artifacts/static`.

## Optional free AI transmissions

Combat never requires an API key. The Node service can generate short rival names, backstories, and taunts through OpenRouter. Generated text cannot change combat rules.

Set `OPENROUTER_API_KEY` in secure server environment settings, or copy `.env.example` to an ignored `.env` file and set it there. Never prefix it with `VITE_` or put it in browser code.

The default route is `openrouter/free`. Only that route or model IDs ending in `:free` are accepted. Paid models are rejected. Availability and free-tier quotas depend on OpenRouter; timeouts, invalid responses, missing credentials, and provider errors fall back to local stories immediately or after the bounded request timeout. Requests are limited, deduplicated, and cached. Players can turn live dossiers off in settings.

## Checks

```bash
npm run build
npm test
npm run balance
```

Tests cover both counter cycles, stances, heat, scanning, repairs, progression, save recovery, apex abilities, the HTTP service, and free-only AI fallback behavior. The balance script simulates 1,500 seeded runs with three strategies and writes its report to `artifacts/`.

With Chromium installed and the app running:

```bash
node scripts/browser-smoke.mjs
```

`TEST_URL` selects a production or development server. `CHROMIUM_PATH` selects a Chromium executable. The browser check uses an isolated profile and verifies real controls, persistence, modal focus, mobile tactics, graphics settings, and layouts from 320px to 1440px. Screenshots and reports go in ignored `artifacts/`. `node scripts/offline-smoke.mjs` checks the production cache and combat without a network connection. `node scripts/browser-soak.mjs` plays continuously for 60 minutes by default, cycling through phone, tablet, and desktop layouts; use `SOAK_MINUTES` to change its duration.

`node scripts/training-smoke.mjs` checks the touch tutorial, saved-run preservation, calculus controls, all three finishers, and a blocked final attempt. A browser mutation observer verifies that the result stays hidden until impact, including when software rendering delays screenshots.

## Source and assets

- `src/game/engine.js`: deterministic combat, procedural encounters, augments, and save recovery.
- `src/components/`: React controls, dialogs, and the Three.js arena.
- `src/game/audio.js`: original Web Audio combat sounds and six generative ambient motifs.
- `server/`: optional server-side encounter generation and production static hosting.
- `scripts/build_models.py`: original articulated hard-surface geometry, approximately 76,000 triangles per detailed frame. Rebuild with Blender 4.3+ using `blender --background --python scripts/build_models.py`. Set `SAVE_BLEND=1` to keep an editable Blender source file in `artifacts/source/`.
- `public/assets/`: six original generated arena illustrations, compressed as WebP.

Graphics use environment lighting, shadows, metallic materials, articulated animation, and additive combat effects. Adaptive quality reduces rendering cost on slower devices; lightweight mode loads a reduced mesh and disables shadows. Reduced motion follows device preferences or can be selected explicitly. A procedural frame remains available if the detailed model fails to load. The game remains playable if WebGL is unavailable.

Project code is [MIT licensed](LICENSE). Chakra Petch and Rajdhani are self-hosted under the SIL Open Font License. Project, font, and runtime dependency notices are included in `public/licenses/` and in the upload build. React and Three.js use MIT licenses; Lucide uses the ISC license.
