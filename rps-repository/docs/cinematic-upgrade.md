# Trinity: afterlight cinematic upgrade

This validated, stylized playable upgrade expands the previous preview with new character tailoring, scenery, an arcade interface, multi-hit choreography, timed prompts and separate three-dimensional finishing sets. The clean install, final production and `/rps/` static builds, and all 80 automated tests passed. The complete 75-sequence, 330-frame capture and cinematic, high-graphics art, encounter, offline and no-WebGL browser checks passed. All local checks are complete.

[Play the game](https://count-halflight.github.io/rps/) · [Desktop screenshots](https://count-halflight.github.io/rps/proof/#desktop) · [Finisher gallery](https://count-halflight.github.io/rps/proof/#finishers) · [125-file change manifest](changed-files-upgrade.md). The manifest links the complete source comparison against `e9b77c608e8f704e5e07758121966ecd46a77f2d`. Publication uses the **Publish game** GitHub Actions workflow; [check the latest deployment](https://github.com/count-halflight/rps/actions/workflows/pages.yml) for its status and release commit.

The earlier [rebuild report](rebuild-report.md) is retained as preview history. Its screenshots and art scores describe that version. No art score or commercial-hyperrealism claim is assigned to the current upgrade. Its look remains stylized cinematic combat.

## Gameplay and timing

The earned-action loop remains intact: choose rock, paper or scissors, reveal the hand, then choose one of three attacks or an item when you win. A loss gives the rival an attack; a draw deals no damage. Full health at the start of each new opponent, items, charge, heat, defensive bracing, scans, seeded floors, route choices, saves, optional training and optional calculus are preserved.

The prism vault reverses the counter cycle. Its dock explicitly states **Rock beats paper · Paper beats scissors · Scissors beats rock**, and the individual hand buttons show the current matchup.

The catalog contains **75 attacks: 45 normal attacks and 30 finishers**. Each fighter has nine normal moves and two finishing sequences for each hand. Finisher selection uses the run's floor and turn, allowing both sequences to appear without a separate menu or purchase.

Normal attacks have one timed prompt; finishers have two. Use the displayed **1**, **2** or **3**, or tap the prompt target before the ring closes. Only a correct input inside an open prompt window awards **3 charge**, capped by the normal charge limit and applied once when the attack completes. Inputs before a cue opens are ignored; inputs at or after its closing deadline earn no charge. A wrong key inside the active window or an unanswered cue counts as a miss. A miss softens the attack's follow-up without changing the damage, hand result or knockout already earned.

**Settings → Cinematic prompts** disables timed input and plays the complete sequence automatically. Reduced motion, tutorial fights and rival attacks skip prompts. Automatic scenes do not grant a hidden prompt charge bonus. Attack motion, UI prompts, impact reveal and completion use the same monotonic presentation clock.

## Normal attack roster

These names remain on the three earned attack buttons for each hand.

| Fighter | Rock | Paper | Scissors |
| --- | --- | --- | --- |
| Echo | Pommel strike; Low sweep; Crosscut | Blade feint; Mirror step; Blade storm | Quick draw; Rising cut; Thousand cuts |
| Cinder | Straight punch; Body blow; Furnace fall | Palm strike; Shoulder check; Groundbreak | Hook; Uppercut; Three-hit rush |
| Nyx | Prism bolt; Crystal trap; Shatter | Light wave; Integral bloom; Singularity | Split beam; Orbit cast; Zero horizon |
| Vex | Heavy arrow; Piercing shot; Meteor rain | Volley; Ricochet; Scattershot | Quick shot; Backflip shot; Starfall |
| Kuro | Thrust; Vault strike; Sky splitter | Low sweep; Turning tide; Storm wheel | Cleaving cut; Rising slash; Heaven’s gate |

Movement includes changing approach directions, individual secondary contacts, air chases, strikes from behind, defender launches and directed camera cuts. Weapon ribbons keep a fixed **160 ms** history instead of a fixed number of frames, so their time span remains consistent across frame rates. The final damage number remains hidden until the main impact. Nyx's calculus visualization still supports the optional Riemann-slice explanation.

## Finisher roster

The primary set uses the actual post-swap hand mapping in `attackCatalog.js`. Times below are full-motion durations; reduced motion shortens the scenes. Contact counts include the final blow and describe authored visual contacts, rather than separate damage rolls.

| Fighter | Hand | Primary finisher | Set | Duration | Contacts |
| --- | --- | --- | --- | --- | --- |
| Echo | Rock | Fault sever | Fractured ground | 8.0 s | 5 |
| Echo | Paper | Mirror execution | Mirrors and afterimages | 8.4 s | 5 |
| Echo | Scissors | Thousand cuts | Blade storm | 8.8 s | 7 |
| Cinder | Rock | Orbit breaker | Space, planet collisions and reentry | 9.6 s | 5 |
| Cinder | Paper | Chain ignition | Furnace chain | 8.3 s | 5 |
| Cinder | Scissors | Crater maker | Airborne dive and crater | 8.5 s | 3 |
| Nyx | Rock | Prism prison | Crystal enclosure | 8.2 s | 4 |
| Nyx | Paper | Event horizon | Black-hole pull and stretched silhouette | 9.4 s | 4 |
| Nyx | Scissors | Integral collapse | Partitioned area collapse | 8.6 s | 5 |
| Vex | Rock | Meteor rain | Meteor barrage | 8.4 s | 4 |
| Vex | Paper | Astral pin | Constellation | 8.8 s | 4 |
| Vex | Scissors | Eclipse arrow | Space and eclipse | 9.0 s | 4 |
| Kuro | Rock | Thunder burial | Lightning and ground impact | 8.2 s | 3 |
| Kuro | Paper | Heaven’s gate | Rift crossing | 9.4 s | 4 |
| Kuro | Scissors | Iron cyclone | Mechanical blade chamber | 9.2 s | 5 |

The additional set adds 15 different constructions and actor paths.

| Fighter | Hand | Alternate finisher | Set | Duration |
| --- | --- | --- | --- | --- |
| Echo | Rock | Clockbreaker | Frozen clock and released blades | 8.8 s |
| Echo | Paper | Gravity guillotine | Suspended falling blade | 9.0 s |
| Echo | Scissors | Thread maze | Closing thread lattice | 8.6 s |
| Cinder | Rock | Rail cannon | Accelerating rail chamber | 9.5 s |
| Cinder | Paper | Sun in your hands | Held solar core and detonation | 9.3 s |
| Cinder | Scissors | Magnetic collapse | Orbiting metal and compression | 8.9 s |
| Nyx | Rock | Crystal cathedral | Closing crystal pillars | 9.1 s |
| Nyx | Paper | Paper universe | Folding panels and compressed silhouette | 9.4 s |
| Nyx | Scissors | Gravity engine | Orbiting planets and gravity pull | 10.0 s |
| Vex | Rock | Tidal arrow | Moving water crest | 9.0 s |
| Vex | Paper | Astral tether | Meteor tether | 9.5 s |
| Vex | Scissors | Star lance | Celestial lance and gates | 9.8 s |
| Kuro | Rock | Chrono blade | Reversed clock and fractures | 9.0 s |
| Kuro | Paper | Serpent coil | Animated energy serpent | 9.3 s |
| Kuro | Scissors | Aurora plunge | Aurora curtains and ice | 9.6 s |

Orbit breaker includes an uppercut, air kicks through separate planet bodies, a curved Earth horizon and a return to the original arena for the last impact. Event horizon uses a tilted accretion disc, a dark core and staged opponent stretching. Iron cyclone uses a physical chamber and rotating blades. Fault sever has its own concrete ground construction: pavement banks separate around the attack's fracture, distinct from the mirrored enclosure used by Mirror execution. These are stylized, non-gory sequences. Finishers restore the fight's original district after the temporary set.

## Characters, scenery and interface

The original five human rigs retain their different proportions, skin tones and weapon kits. The model build now adds cut outer garments with thickness, spine-weighted tailoring, layered hair locks, distinct hairstyles, eye catchlights, detailed boots, and practical accessories. Covered body polygons are removed where a coat needs to replace them, reducing clothing intersections during poses. District rivals use original practical costume assemblies over those rigs.

The five Meshopt-compressed GLBs total **3,446,248 bytes**, approximately **3.3 MiB**. MakeHuman's CC0 mesh, skeleton, weights and morph targets remain the anatomical source. The new tailoring, hair and accessories are original project work. Bone names and cloth UVs remain available for animation and surface detail.

The six live district kits include moving traffic, working foundry mechanisms, prisms, lanterns, wind-blown plants, harbour water and cranes. Original Canvas textures provide floor markings and material detail. Six independent **1672 × 941** backgrounds add distant curved scenery behind those live props. They are original images generated for Trinity through the image generation tool, without downloading another game's artwork. The WebPs preserve the native image dimensions without cropping or resizing, use quality 94, and total **4,091,132 bytes**. The earlier atlas is removed from public assets and runtime caching; source PNGs remain in ignored development artifacts. Provenance and the project notice are recorded in [Original-Environment-Art.md](../public/licenses/Original-Environment-Art.md). High-graphics captures of all six districts passed without errors or missing assets.

| District scene | Asset |
| --- | --- |
| Rain alley | `public/art/arena-rain.webp` |
| Foundry cathedral | `public/art/arena-foundry.webp` |
| Prism observatory | `public/art/arena-vault.webp` |
| Lantern arcade | `public/art/arena-market.webp` |
| Overgrown conservatory | `public/art/arena-garden.webp` |
| Night cargo port | `public/art/arena-docks.webp` |

The interface uses beveled cyan and coral health plates, a central floor badge, a compact physical control dock, weapon crests, numbered fighter roster plates, large character identities and cinematic introduction bands. Existing readable names, keyboard controls, fullscreen, settings and dialogs remain accessible. Desktop composition is the visual priority; basic portrait phone and landscape touch layouts are retained.

## Original sound

Six district charts use separate melody, harmony, groove and instrument choices.

| District | Score |
| --- | --- |
| Rain district | Rain on the line |
| Foundry | Red furnace |
| Prism vault | Glass orbits |
| Lantern market | Lantern runners |
| Signal garden | Roots in the wires |
| Harbour | Undertow |

Each arrangement spans **28 bars**: intro 2, verse 6, lift 4, breakdown 4, reprise 8 and finale 4. Later cycles vary the phrasing. Synthesized instruments and noise generate the sound locally; there are no downloaded commercial songs or ongoing audio service costs.

All 30 finishers have separate procedural sound palettes, with different pitch families, tails, stereo placement and scheduled actions. Enemy weakness increases intensity. Low player health lowers the music filter and adds a heartbeat. Finisher buildup leads into a brief music pause before the final impact. Mute, music and volume remain adjustable.

## Phase changelog

| Phase | Delivered change |
| --- | --- |
| Character art | Rebuilt five compressed human assets with tailored garment edges, layered hair, eyes, boots and distinct accessories; reduced body and coat intersections. |
| Living districts | Expanded live district dressing and original surface maps; replaced the preliminary atlas with six native-resolution background images. |
| Attack choreography | Expanded to 75 timelines with directed camera work, multiple contacts, airborne motion and separate opponent flinches; fixed weapon trail history to 160 ms independent of frame rate. |
| Finishing sets | Added 30 physical constructions, including planet collisions, black-hole stretching, the rotating chamber and 15 alternate finales; scoped crater effects to ground impacts and gave Fault sever its own concrete ground set. Corrected Vex arena-shot planet visibility and reduced Crystal cathedral occlusion. |
| Timed interaction | Added one prompt per normal attack and two per finisher, exact charge rewards, automatic playback and guarded combat inputs during cinematics. |
| Sound | Authored six district score charts and 30 finisher palettes while retaining health-driven intensity, muffle, heartbeat and pre-impact silence. |
| Arcade interface | Replaced thin dashboard-style cards with health plates, the control dock, fighter crests and large identities; made prism-cycle rules explicit. |
| Verification | Passed the clean install, final production/static builds and all 80 tests, 3,000 seeded policy runs, seven cinematic checks, high-graphics character/district captures, all boss/elite checks, the full 330-frame capture, eight production offline checks and six production no-WebGL fallback checks. All local checks are complete. |

## Verification status

The following checks have passed for the integrated source available at this stage:

- **All 80 automated tests passed**, including deterministic combat, saves, QTE deadlines, charge, accessibility modes, attack timing, world construction and regressions for contact flinches, crater effects and cinematic control locking. Additional checks cover offline-worker navigation and asset caching, frame-rate-independent combat effects, the separate Fault sever construction, scene visibility and crystal material settings.
- **3,000 seeded policy runs**: 1,000 seeds each for random, tactical and perfect-counter policies, with **zero softlocks** across progression, routes, rooms, saves and bounded resources.
- **Seven real-game cinematic browser checks passed**: entrances finish on schedule and cannot be paused with Escape; orbital, singularity and turbine scenes complete with touch or keyboard success; wrong and unanswered prompts preserve an earned knockout; a normal attack gives its exact 3-charge reward; and all 30 finisher cue windows close before impact. Delayed damage and exact charge rewards were verified in the played scenes. Zero JavaScript errors and missing assets were recorded.
- **High-graphics art review passed** for the title, all five fighter selections and all six district render captures, with full starting health checked in each district. Zero JavaScript errors and missing assets were recorded.
- **Encounter browser checks passed** for all six bosses, their two phase transitions each, and all six elites. Zero JavaScript errors and failed asset requests were recorded.
- **75 sequences and 2,775 pair comparisons** at a near-identity threshold of `0.18`. Minimum combined sampled pose/camera distance is **0.3980089822195978**, with **zero collisions**.
- **24 interface geometry checks**: title, selection, normal combat and reversed-cycle combat at 1280 × 720, 768 × 1024, 390 × 844, 320 × 568, 844 × 390 and 667 × 375. Zero JavaScript exceptions and failed requests were recorded during these WebGL-disabled layout checks.
- **Final npm and static checks passed**: the clean `npm ci --cache /tmp/trinity-npm-cache` install added 25 packages in 5 seconds; fresh `npm run build` and the `VITE_BASE_PATH=/rps/` static build completed; `npm test` passed all 80 tests. These checks cover the latest trail, ground-set, scene-visibility, crystal-material and cached-entry regressions.
- **Complete actual-game capture passed** with 75 sequences, 330 frames, zero JavaScript errors and zero missing assets. The latest gallery includes all fixed-beat and midway finishing shots, including the four sequences recaptured after the bounded visual fixes.
- **Eight production `/rps/` offline browser checks passed**, with zero JavaScript exceptions: all five models and six backgrounds cached; actual offline entry, fonts, scripts and arena; real music output; mute/resume; actual fullscreen; paused desktop resize redrawing the frozen scene and resuming correctly; proof-gallery navigation preserving the cached game entry; and an earned attack with saved progress. The audio context was running with a measured output peak of **0.046446386**.
- **Six production `/rps/` no-WebGL fallback checks passed**: touch input completed an earned attack without 3D rendering, and normal, elite, rest, shop and event routes each reached the next fight with full health and usable controls.

Numeric distance verifies separation between sampled paths; it cannot judge art quality, shot composition or whether an attack feels satisfying. The layout check deliberately disables WebGL and does not validate rendered character or environment artwork.

All local verification is complete. Publication runs through the **Publish game** workflow; [the latest deployment](https://github.com/count-halflight/rps/actions/workflows/pages.yml) records its status and exact commit.

The completed capture used actual hand and attack controls with a manually stepped development-only presentation clock. Before each review beat, it sampled **60 ms of recent motion** to warm the trail history while keeping the requested beat time exact. It covers **75 attacks and 330 frames**: four beats per sequence plus a midway world shot per finisher. Five original **1280 × 3645** PNG contact sheets and five WebP copies, 30 finisher world images, the capture manifest and the complete pair-distance report have been assembled from the latest actual frames. The public gallery also contains 12 high-graphics desktop shots and 12 boss/elite shots. Sample runs write local sample records and preserve the public gallery.

The three primary Vex finishing sequences were recaptured after removing stray planet bodies from their arena shots. Nyx's alternate rock sequence, Crystal cathedral, was recaptured with crystal opacity `0.28`, front-face rendering and disabled depth writes to reduce enclosure occlusion. The gallery was rebuilt using these corrected frames.

Offline-worker tests verify that only the game root or game entry navigation can refresh the cached entry. The proof gallery's HTML cannot replace it. The final production browser run verified this behavior, the cached assets and actual offline playback in the `/rps/` build.

## Reproduce and source map

```bash
npm ci
npm run build
npm test
npm run proof
```

With the development server running:

```bash
node scripts/cinematic-smoke.mjs
npm run capture:attacks
```

For a sample without replacing the complete gallery:

```bash
CAPTURE_SAMPLE=cinder.rock.final,nyx.paper.final,kuro.scissors.final npm run capture:attacks
```

| Files | Purpose |
| --- | --- |
| `src/game/attackCatalog.js`, `cinematics.js`, `poseKeys.js` | Normal and finishing contacts, actor and opponent paths, cameras, world transitions and prompt cues |
| `src/game/qte.js`, `src/App.jsx` | Timed input resolution, exact completion and saved charge reward |
| `src/components/CinematicQte.jsx`, `cinematicQte.css` | Keyboard and touch prompt display |
| `src/components/cinematicWorld.js`, `alternateCinematicSets.js` | Finishing sets, planet bodies, black hole, mechanical chamber and alternate constructions |
| `scripts/build_fighters.py`, `public/models/` | Original tailoring, hair and compressed human rigs |
| `src/components/riggedFighter.js`, `wardrobe.js` | Rig integration and district costume assemblies |
| `src/components/environments.js`, `filmRenderer.js`, `public/art/arena-*.webp` | Live scenery, material and film treatment, six native-resolution district backgrounds |
| `src/arcade.css`, `style.css`, `CharacterSelect.jsx`, `EncounterIntro.jsx` | Arcade composition, fighter selection and introductions |
| `src/game/audio.js`, `audioProfile.js` | Original score charts and procedural combat palettes |
| `scripts/cinematic-smoke.mjs`, `capture-choreography.mjs`, `contact-sheets.py`, `choreography-proof.mjs` | Actual-game timing checks, rendered evidence and numeric path comparison |
| `tests/qte.test.js`, `qte-integration.test.js`, `audio-score.test.js`, `cinematic-world.test.js`, `combat-effects.test.js`, `offline-worker.test.js` | Deadline, integration, music, world, effect timing and cached-entry regression checks |

No new runtime dependency or paid service is required. Static gameplay makes no OpenRouter calls and requires no API key. Existing source, dependency and font notices remain in `public/licenses/`.

## Known limitations and future visual upgrades

Characters use authored procedural poses and joint solving rather than captured human animation. Clothing has authored secondary motion; it is not a general fabric simulation. The space, gravity and time constructions are stylized scenes. Bosses share the anatomical skeleton and use district costume assemblies rather than separately sculpted bodies. Mobile hardware frame rate remains unmeasured.

Rendered checks covered the five fighter selections, district depth, full starting health and the three reference finishing sequences. The complete attack gallery documents all 75 timelines. Further art refinement should focus on readable faces and silhouettes, costume intersections through contact poses, impact framing, attack rhythm and clear fighting lanes. The final static build, offline playback and no-WebGL progression checks passed.

Five specific visual upgrades remain suitable for a later art pass:

1. Sculpt stronger facial forms and add expression correctives for the close-up windups, reactions and victory poses.
2. Add collision-aware cloth and hair motion around shoulders, wrists and weapon grips while retaining a lightweight presentation option.
3. Author localized wetness, wear and contact decals for each district so rain, machinery and footsteps affect the visible surfaces consistently.
4. Refine individual contact poses and camera curves through frame-by-frame review, with cleaner hand closure, silhouettes and shot transitions.
5. Sculpt distinct boss heads and body shapes so their identities extend beyond the existing district costumes and signature sets.

These are further art refinements. The requested orbital launch, black-hole sequence, rotating chamber, multi-hit attacks and timed prompts are implemented, and the three reference sequences passed integrated browser playtests. Complete gallery capture, both builds, offline playback and no-WebGL progression passed. Publication status is available from the workflow linked above.
