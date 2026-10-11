# Ultra: first slice review

This review records the actual rendered work. The slice is not accepted yet and has not been published.

## Implemented

- Production Cinematic Lab with pause, scrubbing, looping, slow playback, rig overlays and twelve-frame PNG exports.
- Four canonical Echo sequences with a pure pose/camera clock, authored contacts, timing ramps, reactions and reduced playback.
- Anatomical actor measurements, facial morphs, weapon grips and planted-foot IK.
- Three physical Black Tide layouts with water, stone, iron, abbey architecture and health-driven lights.
- Separate deterministic rival presentation and six boss wardrobes; combat generation and saves remain unchanged.
- Authored attack audio with cancellable scheduling, a 500 ms finisher silence and an independent Afterlight music stem.

## First rendered pass

Frames: `artifacts/ultra/lab/ECHO-{S0,S2,SF,AF}-contact-sheet.png`.

The first capture completed with zero JavaScript exceptions and zero failed asset requests. It exposed problems that unit tests could not: the Lab opponent lacked its boss flag; arbitrary legacy root scales made it tower over Echo; the anticipation pose barely changed silhouette; bright overlapping motion copies obscured hits; district blackout extinguished actor lighting; uniform contact-sheet samples missed the instant draw; and paving/water had uniform repeated surface marks.

| Criterion | First pass | Evidence |
| --- | ---: | --- |
| Character presence | 3 | Incorrect relative scale; weak face and hair |
| Animation weight and timing | 4 | Loaded poses too close to idle |
| Camera | 4 | Actor overlap and clipped oversized opponent |
| VFX clarity | 3 | Bright motion copies obscure contact; delayed cut hidden |
| Variety | 6 | Different staging exists, but does not read clearly |
| Boss presence | 2 | Lab fixture fails to equip the boss wardrobe |
| Finale spectacle | 2 | Several Afterlight frames are black |
| UI polish | Pending | Main game HUD requires a separate rendered review |
| Readability | 4 | Silhouette and contact visibility problems |
| Performance | Pending | 127 whole-frame draws at initial Medium pose; cinematic peaks not yet measured |

The weakest point is Afterlight visibility. Actor lighting, capture timing and mirror contrast must be verified in the next rendered pass. Revised source also addresses scale, planted anticipation, spectral shading, body-front cut placement, sliced-surface batching, arena material contrast and meaningful capture samples. These changes have not been awarded visual scores merely because tests pass.

## Second rendered pass

Frames: `artifacts/ultra/lab-v2/ECHO-{S0,S2,SF,AF}-contact-sheet.png`. The frozen production build uses corrected1.72m Echo and2.20m Bulwark heights, revised harbour materials, bounded slice rendering and revised spectral effects. It completed with zero runtime exceptions and zero asset failures. The unintended black frames are fixed; the9s black frame is the authored silence/cut.

| Criterion | Second pass | Remaining visible issue |
| --- | ---: | --- |
| Character presence | 4 | Protruding eyes, ragged neckline and grimacing inhale |
| Animation weight and timing | 5 | Finale defender floats at the opening |
| Camera | 5 | Grounded shots still make the fighters too small |
| VFX clarity | 4 | Spectral copies remain noisy and filament-like |
| Variety | 6 | Four distinguishable scenarios need stronger individual contact |
| Boss presence | 4 | The source fighter and inherited weapon dominate its armour |
| Finale spectacle | 5 | Mostly empty lattice; reflected epilogue avatar draws through ground |
| UI polish | Pending | Main HUD review remains outstanding |
| Readability | 5 | Scene now stays visible, but contact hierarchy remains weak |
| Performance | Pending | Medium peaks139/142/147/151 draws; Afterlight exceeds the150-call target |

Medium peak counts correspond toS0/S2/SF/AF, including every auxiliary render and postprocess pass. High and Light have not been verified. Geometry, close framing, authored expressions, closed armour, mirror surfaces and reflection masking are being revised. The first slice still fails acceptance; no criterion has been raised to8 without rendered evidence. Nine ancillary floor scenes now have pure staging and authored audio, separate from the65 attack registry.

## Fourth rendered pass

Frames: `artifacts/ultra/lab-v4/ECHO-{S0,S2,SF,AF}-contact-sheet.png`. Medium peaks are 127/135/141/137 whole-frame draws; the four draw budgets now pass. There are zero runtime exceptions and zero failed assets. This is a rendering-budget result, not a frame-rate or art-approval claim.

The curved knight armor hides its inherited weapon and source face. Echo's eye placement and grounded finale opening have improved. Camera framing is closer, and the physical dock arches now have profiled stone construction. The remaining weaknesses are visible: a stiff collar and sparse cap-like hair; uniform paving and flat practical lamps; ghost effects which still resemble filaments; white mirror hotspots; and two unintended black Afterlight frames at 6.35 and 8.62 seconds. The 9-second black frame is intentional. The black frames in this new capture require a shader/postprocessing check as well as clearer subject lighting.

| Criterion | Fourth pass | Evidence |
| --- | ---: | --- |
| Character presence | 4.5 | Better eyes; neck, hair and jacket silhouette remain weak |
| Animation weight and timing | 5 | Grounded opening, but limited visible body weight |
| Camera | 5.5 | Closer framing; dark mirrors obscure several shots |
| VFX clarity | 4 | Thin spectral lines and bright pane rectangles dominate |
| Variety | 6 | Four separate sequences, all still Echo blade scenarios |
| Boss presence | 5.5 | Closed curved knight armor, still a simple head silhouette |
| Finale spectacle | 3 | Two unintended black captures and indistinct dome action |
| UI polish | 6 | Actual game HUD is readable; portraits and composition need refinement |
| Readability | 4.5 | Finishers lose their focal fighter during district extinction |
| Performance | Pending | Medium draw budget passes; High/Light and practical frame-rate need review |

The first slice remains unaccepted. No remaining attack definitions or other character/district rebuilds have been counted as completed. A trusted browser click also captured real Afterlight audio in `artifacts/ultra/audio-native/ECHO-AF.webm`: the graph runs, has nonzero audio and no runtime or asset errors. Its maximum recorded level of -26.9 dB is quiet, so the authored mix needs adjustment before the listening check is accepted.

## Performance conditions

The renderer now counts the entire frame, including postprocessing and auxiliary renders. The software GPU used here is Chromium SwiftShader. Its frame times are useful for comparisons in this environment, not as desktop or phone performance claims. The previous release measured approximately 458 actual GL draws per frame in the same baseline test. New cinematic peaks and High/Light tiers still require measurement.

## Verify

`npm test`

`npm run build`

`npm run dev`, then open `http://localhost:5173/#/lab`.

The canonical registry contains four implemented IDs and a separate 65-ID target manifest. Remaining definitions are deliberately unavailable until authored; the manifest is not a claim that all 65 animations exist. Other fighters and districts retain released geometry until this first slice passes its review.


## Fifth rendered pass

Actual frames: `artifacts/ultra/lab-v5/ECHO-{S0,S2,SF,AF}-contact-sheet.png`.
Whole-tier AF probes: `artifacts/ultra/tier-probe-v5/report.json`.

All four Medium captures completed with zero runtime and failed-asset errors, peaking at 127/134/140/137 submitted draws. AF quality probes peak at High143, Medium137 and Light124. Both formerly unintended black frames,6.35 and8.62seconds, now show actual pixels at every tier; only the authored9.0second blackout is fully black. This resolves a rendering failure without granting visual acceptance or a physical-device frame-rate claim.

| Criterion | V5 score | Evidence |
| --- | ---: | --- |
| Character presence | 5 | Continuous neckline, actual skin and seated eyes; plain dark clothing and molded hairline remain weak |
| Animation weight and timing | 6.5 | S0 6.5, S2/SF7, AF5.5; grounded loading and distinct crossings, but AF contact payoff is obscured |
| Camera | 6.5 | Ground cameras improve; distant AF barrage receives5.5 |
| VFX clarity | 6.5 | SF reflects real actors; late synthetic filament cloud obscures the real separated rival |
| Variety | 6.5 | Four authored sequences read differently;61 canonical definitions remain |
| Boss presence | 5.5 | Shield/armor silhouette reads; repeated pale boss mirror images compete with the attacker |
| Finale spectacle | 6 | No unintended black frames, but a wall of static pale reflections dominates active strikes |
| UI polish | 6 | Latest main HUD review remains required; Lab polish is not game UI acceptance |
| Readability | 6.5 | Actual actors and reflection imagery visible; SF main contact still too dark |
| Performance | Pending | All measured draw budgets pass; software rendering cannot establish60fps hardware performance |

The weakest point is still visual character presence and the AF contact hierarchy. The next source candidate targets the hairline, subdued boss imagery, stronger active Echo copies, two action-motivated camera cuts, SF subject lighting and a cleaner recovery silhouette. No score is raised before the next actual review.

Native combat verification passed six checks against exact engine outputs, including one medkit use, one scan charge spend without a turn, chosen brace during a draw, winning-hand selection, a fatal commit and no extra defeat commit. Trusted audio recording with district music measures -16.8dB peak versus the prior -26.9dB. These technical checks do not establish art or listening acceptance.


## Sixth rendered pass

Actual frames: `artifacts/ultra/lab-v6/ECHO-{S0,S2,SF,AF}-contact-sheet.png`.
All four Medium sheets completed with zero runtime exceptions and failed assets, peaking at 127/134/140/137 draws.

Character presence is 5.5/10: the hairline now reaches the forehead, but still reads as a coated cap and the torso merges into a near-black mass. The environment is 6/10: floor mottling is visible, but regular grain and slab courses still dominate. Animation/camera scores are S0 6.5/7, S2 7/7, SF 7/7 and AF 5.5/6.5. SF’s contact no longer blacks out the actor and its recovery is quieter, with readability around7/10. AF’s closer contact cuts expose the genuine remaining fault: elevated active reflections miss the wounded boss. The atlas uses legacy pose rows while the pure sequence authors full Echo poses, so visual contact is not established.

The first-slice gate still fails. V7 will use authored reflection anticipation/contact/follow-through banks with measured blade anchoring, improve the actual Echo costume and stone geometry/material relationship, and refine the main HUD. The remaining61 definitions remain gated.

Six native asset-recovery checks passed in `artifacts/ultra/quality-recovery-v6/report.json`: initial loading, blocked High fallback with disabled Lab controls, cached Medium recovery, unblocked retry to High, playback with paused-frame caching, and manual export-clock rendering. The old failure status clears on recovery; failed selected assets cannot enable stale frame exports. The first playback probe checked too soon under software rendering; a state-based wait verifies actual advancement.
