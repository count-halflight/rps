# Ultra audit and trigger table

Baseline: `8a253c78c9bf738b97f2244f7f9ab47bc3498607`. Scope: desktop-first presentation rebuild. Combat functions, level RNG call order and saved combat fields remain unchanged.

## Audit

The brief describes an older source version. F1 is partly corrected: the baseline has 75 authored timeline descriptors and directed multi-hit staging, but still shares interpolated pose/path vocabulary, lacks a pure scrubbable Lab, and misses the required T1–T5 grammar. F2 is partly corrected: 24 seeded district rivals already match their weapon kits; kit selection lacks the requested shuffle-bag and forty names. F3 is partly corrected: six bosses already have models, introductions, phases and signature warnings; the new named silhouettes and five Afterlight Finales are absent. F4 is partly corrected: six live kits and independent backdrops exist, including dock water; scenery still depends too heavily on image planes and needs layered three-dimensional structures and closer material detail. F5 remains: current finisher titles differ from the new Bible. F6 is partly corrected: thick tailored garments, hair, boots, eyes and support-hand IK exist, but expressive faces, convincing grip poses and individual personality need a further art pass. F7 remains a visual polish concern; flat light and reflective surfaces still lose contrast. F8 is partly corrected: encounter cards, ghost health trails and delayed damage exist; physical contact, reward staging and a finale director remain incomplete.

Decisions: the Bible defines sixty-five canonical sequences; previous alternate finishing constructions remain available as bonus content. New rival profiles are presentation-only and keep existing abilities, reliability and combat patterns. Visual boss notches may use 66/33 percent while combat retains its established 65/30 thresholds. No miniboss reward math changes. The current saved version-2 data already loads version 1. No paid service or new runtime dependency is required.

## Current normal triggers and target tiers

All rows below require an earned RPS win and the matching hand. The attack-button index selects Strike (0), Guard (1) or Overdrive (2). Existing controller routes lethal hits to a finisher; an ordinary Overdrive is not already a killing finisher. A lost hand uses the rival kit and turn modulo three for the presentation, without granting an earned-action picker.

| Target ID | Current title | Button | Current duration | Target |
| --- | --- | --- | --- | --- |
| ECHO-R0 | Pommel strike | Strike | 2050 ms | T1 |
| ECHO-R1 | Low sweep | Guard | 2700 ms | T2 |
| ECHO-R2 | Crosscut | Overdrive | 3250 ms | T3 |
| ECHO-P0 | Blade feint | Strike | 2300 ms | T1 |
| ECHO-P1 | Mirror step | Guard | 2850 ms | T2 |
| ECHO-P2 | Blade storm | Overdrive | 3500 ms | T3 |
| ECHO-S0 | Quick draw | Strike | 1900 ms | T1 |
| ECHO-S1 | Rising cut | Guard | 2600 ms | T2 |
| ECHO-S2 | Thousand cuts | Overdrive | 3600 ms | T3 |
| CINDER-R0 | Straight punch | Strike | 1850 ms | T1 |
| CINDER-R1 | Body blow | Guard | 2500 ms | T2 |
| CINDER-R2 | Furnace fall | Overdrive | 3400 ms | T3 |
| CINDER-P0 | Palm strike | Strike | 2250 ms | T1 |
| CINDER-P1 | Shoulder check | Guard | 2750 ms | T2 |
| CINDER-P2 | Groundbreak | Overdrive | 3550 ms | T3 |
| CINDER-S0 | Hook | Strike | 2150 ms | T1 |
| CINDER-S1 | Uppercut | Guard | 2900 ms | T2 |
| CINDER-S2 | Three-hit rush | Overdrive | 3750 ms | T3 |
| NYX-R0 | Prism bolt | Strike | 2450 ms | T1 |
| NYX-R1 | Crystal trap | Guard | 2850 ms | T2 |
| NYX-R2 | Shatter | Overdrive | 3650 ms | T3 |
| NYX-P0 | Light wave | Strike | 2550 ms | T1 |
| NYX-P1 | Integral bloom | Guard | 3050 ms | T2 |
| NYX-P2 | Singularity | Overdrive | 3900 ms | T3 |
| NYX-S0 | Split beam | Strike | 2350 ms | T1 |
| NYX-S1 | Orbit cast | Guard | 2950 ms | T2 |
| NYX-S2 | Zero horizon | Overdrive | 3800 ms | T3 |
| VEX-R0 | Heavy arrow | Strike | 2350 ms | T1 |
| VEX-R1 | Piercing shot | Guard | 2850 ms | T2 |
| VEX-R2 | Meteor rain | Overdrive | 3650 ms | T3 |
| VEX-P0 | Volley | Strike | 2450 ms | T1 |
| VEX-P1 | Ricochet | Guard | 3000 ms | T2 |
| VEX-P2 | Scattershot | Overdrive | 3750 ms | T3 |
| VEX-S0 | Quick shot | Strike | 1950 ms | T1 |
| VEX-S1 | Backflip shot | Guard | 2900 ms | T2 |
| VEX-S2 | Starfall | Overdrive | 3950 ms | T3 |
| KURO-R0 | Thrust | Strike | 2250 ms | T1 |
| KURO-R1 | Vault strike | Guard | 2850 ms | T2 |
| KURO-R2 | Sky splitter | Overdrive | 3700 ms | T3 |
| KURO-P0 | Low sweep | Strike | 2550 ms | T1 |
| KURO-P1 | Turning tide | Guard | 3000 ms | T2 |
| KURO-P2 | Storm wheel | Overdrive | 3900 ms | T3 |
| KURO-S0 | Cleaving cut | Strike | 2400 ms | T1 |
| KURO-S1 | Rising slash | Guard | 3150 ms | T2 |
| KURO-S2 | Heaven’s gate | Overdrive | 4050 ms | T3 |

## Current lethal triggers and target finishers

On a player lethal hit, the old selector chooses a primary or alternate finisher with `(floor((level-1)/3)+turn)%2`. Target: each normal kill uses the canonical hand finisher T4; each boss kill uses its fighter Afterlight Finale T5. A lethal rival hit leads into the Light-Out defeat sequence.

| Target ID | Current primary title | Current duration | Target tier |
| --- | --- | --- | --- |
| ECHO-RF | Fault sever | 8000 ms | T4 |
| ECHO-PF | Mirror execution | 8400 ms | T4 |
| ECHO-SF | Thousand cuts | 8800 ms | T4 |
| CINDER-RF | Orbit breaker | 9600 ms | T4 |
| CINDER-PF | Chain ignition | 8300 ms | T4 |
| CINDER-SF | Crater maker | 8500 ms | T4 |
| NYX-RF | Prism prison | 8200 ms | T4 |
| NYX-PF | Event horizon | 9400 ms | T4 |
| NYX-SF | Integral collapse | 8600 ms | T4 |
| VEX-RF | Meteor rain | 8400 ms | T4 |
| VEX-PF | Astral pin | 8800 ms | T4 |
| VEX-SF | Eclipse arrow | 9000 ms | T4 |
| KURO-RF | Thunder burial | 8200 ms | T4 |
| KURO-PF | Heaven’s gate | 9400 ms | T4 |
| KURO-SF | Iron cyclone | 9200 ms | T4 |
