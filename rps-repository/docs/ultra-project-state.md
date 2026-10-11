# Trinity: Afterlight project state

Updated 11 October 2026, 09:34 UTC. Working branch: `feature/afterlight-ultra`. The user has authorized publishing the current playable preview, explicitly postponing the remaining rebuild and visual acceptance. The final frozen preview passed all 231 tests, `npm run build:static` and the native graphics smoke check. Only the final offline smoke check and deployment remain for this preview.

**Attack authoring: 4 of 65 canonical sequences implemented, about 6% complete and 94% remaining.** This is an authored-definition count, not accepted art or overall project completion. The former repeated 80% and 4–6 hour estimates were manual guesses and have been withdrawn. The first visual slice still needs review, followed by 61 attacks and the remaining character and environment work. Substantial hours of work remain; no reliable publication deadline is claimed.

Nine entrance and Bulwark scenes plus eight reveal, clash, item and defeat moments are integrated separately. The Lab previews all 21 clips. The final frozen preview suite passed 231 of 231 tests with no failures, and the final static production build passed. Earlier V6 asset-failure checks also passed six native recovery checks. A 3,000-run simulation passed with no softlocks and full starting health for every new fight. Six native browser checks verify earned healing, scanning, chosen brace on a draw, winning-hand attack selection and fatal-loss/defeat staging against exact engine results. Each result commits once, with zero runtime or failed-asset errors. The initial draw probe exceeded its short timeout in the software renderer; the repeat with a realistic browser-command deadline passed.

The final native graphics smoke rendered six actual format-2 HalfFloat shader/contact frames with zero runtime exceptions and zero failed assets. In that smoke, whole-frame draw maxima were High 136, Medium 130 and Light 117. This verifies the current preview's sampled graphics paths, without granting art acceptance or a hardware frame-rate claim.

The earlier sixth production capture rendered all four sequences with zero runtime or failed-asset errors. Medium peaks for S0/S2/SF/AF were 127/134/140/137 whole-frame draws. The separate AF probe verified High 143, Medium 137 and Light 124 draws, including postprocessing and shadow passes. All remain below the 150-call target. The unintended black frames at 6.35 and 8.62 seconds are fixed at all three tiers; the authored 9.0-second blackout remains. These are draw-budget checks on software graphics, not evidence of 60 fps on a physical phone.

Actual trusted-click audio, with district music enabled, has been captured to `artifacts/ultra/audio-native-v5/ECHO-AF.webm`. Its maximum level is -16.8 dB, versus -26.9 dB in the earlier recording. The graph runs and the capture has zero runtime or failed-asset errors. No listening approval is claimed from level measurements alone.

The V6 art review remains below acceptance: character presence 5.5/10, AF animation 5.5/10 and camera 6.5/10, environment 6/10, SF readability around 7/10. No score is raised merely because tests pass. That review exposed reflected blade poses passing above the wounded boss. V7 now contains authored anticipation/contact/follow-through pose banks and calibrated blade contacts, plus the costume, Docks and HUD changes described below. Their native art review is still pending. A paused Lab no longer redraws identical frames continuously. Six native failure/retry checks confirm that blocked High assets disable Lab playback and export, cached Medium restores them, unblocked retry loads High, and playback/manual captures continue. Combat fallback remains playable.

The user no longer requests screenshots; inline delivery failed, and no public screenshot upload is planned. Old proof galleries are explicitly labelled as release 8a253c7 archives and do not count toward the 65 new canonical attacks.

Next steps:

1. Finish the final offline smoke check against the frozen preview.
2. Publish through GitHub Pages and verify the deployment workflow and exact published commit.

These are the only remaining steps for the authorized preview. First-slice visual acceptance and the remaining fighters, arenas and 61 canonical attacks are deferred to continued development.

## Preview scope override

The user explicitly requested: “wtvs done till now is ok just publish if no errors are there.” This overrides the art gate for this preview only. The full 65-attack scope and visual review remain unfinished. V7 includes the fitted Echo costume, 24 authored reflection pose banks with calibrated blade contacts, revised Docks flagstones, gothic HUD and six district ambience textures. Native art approval is not claimed. Next session should continue from this preview after checking the exact published commit.

Preview quality exception: Light reflection meshes allow at most 3,000 triangles per authored pose, preserving phase topology and blade contacts. The original 2,000-triangle art target remains deferred; reflection draw count stays one.

Final preview offline smoke passed all eight checks. Publication is the only remaining preview step.
