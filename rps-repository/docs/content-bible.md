# Trinity: afterlight rebuild

## Playtest audit

The old attack evaluator shared a root lunge, broad weapon rotations, floating rings and almost the same camera path. Naming those paths differently did not make them look different. Unbent elbows, unplanted feet, distant fighters and effects detached from weapon tips hid contact. The original arena kept the same city geometry visible in every district. The dossier selected names separately from the model selector, causing the Vex/glaive mismatch. Bosses changed arithmetic but had no separate model, entrance or visible phase.

The rebuild uses one encounter definition for names, weapons, models and tells; authored beat timelines for attacks; modular district kits; and explicit reward and route states. Saves are versioned. A new opponent always restores full health. A continued unfinished fight keeps its damage.

## Visual direction

Original stylized PBR: wet metal, woven cloth, readable human faces and costume silhouettes. Amber lamps against cool nights, with district-specific light. Blades leave trails along their edges; impacts happen on the target. No floating combat rings except deliberately authored magic. Cinematic close-ups must show a face or a weapon grip, rather than cropped backs.

Character acceptance: footwear touches the floor, hands wrap the grip, no skin pokes through clothing, five readable silhouettes. Cinematic acceptance: anticipation, actual travel/contact, a readable reaction and recovery; a unique shot and rhythm for each move. Boss acceptance: six silhouettes, entrance, phases, visible telegraph, transformation and reward. Performance is measured; 60 fps is a target, not a claim based on desktop screenshots.

## Named rivals

| District | Rival | Weapon | Personality | Costume |
|---|---|---|---|---|
| Rail | Tern Vale | Twin blades | Aggressor | Yellow rain cape, respirator |
| Rail | Iona Switch | Glaive | Patient | Indigo officer coat, plated shoulders |
| Rail | Pel Rusk | Impact wraps | Bluffer | Rust bomber, welding mask |
| Rail | Sev Halden | Bow | Methodical | Teal hood, signal antenna |
| Foundry | Bryn Ash | Impact wraps | Aggressor | Orange apron, forged bracers |
| Foundry | Nera Flint | Staff | Gambler | Smoke veil, brass rings |
| Foundry | Corin Weld | Glaive | Patient | Heavy shoulder shell, dark coat |
| Foundry | Dey Ember | Twin blades | Mimic | Cropped coat, copper face marks |
| Vault | Elian Fold | Staff | Mimic | White hood, prism collar |
| Vault | Orra Glass | Bow | Bluffer | Mirrored visor, violet coat |
| Vault | Tess Refract | Twin blades | Methodical | Split cape, crystal shoulders |
| Vault | Varo Null | Glaive | Patient | High collar, dark halo |
| Market | Lio Thread | Bow | Gambler | Red scarf, quilted vest |
| Market | Mara Quill | Twin blades | Bluffer | Rose hood, silver face stripe |
| Market | Osen Bell | Impact wraps | Aggressor | Gold jacket, lantern belt |
| Market | Yara Moss | Staff | Mimic | Long green cape, bead collar |
| Garden | Aven Reed | Glaive | Methodical | Moss mantle, antenna crown |
| Garden | Edda Coil | Staff | Patient | Blue cable shawl, green lenses |
| Garden | Sol Fen | Bow | Mimic | Leaf hood, bioluminescent quiver |
| Garden | Piri Root | Impact wraps | Gambler | Olive armour, cable bracers |
| Docks | Rell Brine | Impact wraps | Aggressor | Navy diving coat, brass collar |
| Docks | Sera Wake | Bow | Patient | White storm hood, rope harness |
| Docks | Thane Keel | Glaive | Methodical | Heavy dock coat, anchor plates |
| Docks | Olli Drift | Twin blades | Bluffer | Blue scarf, weathered mask |

Personalities choose seeded next tells and unequal throw weights. Mimics copy the last hand. Bluffers have low tell reliability. Patient fighters anticipate a repeated hand. The tell UI names the personality.

## Minibosses and bosses

Minibosses appear at floor remainder 3, at 1.25 times normal scale, with a distinct costume, second health segment, clear mechanic and better rewards.

| District | Miniboss | Mechanic | Boss | Ability | Signature / arena change |
|---|---|---|---|---|---|
| Rail | Halvek, switch guard | Armoured safe attacks | Morrow, rail keeper | Armour | Rail hammer / emergency train lights |
| Foundry | Enna, furnace hand | Rising heat | Varda, kiln widow | Overheating | Furnace dive / molten channels open |
| Vault | Isren, glass marshal | Copies last tell | Irid, prism cartographer | Counterreader | Refraction cut / reversed orbit |
| Market | Ouma, night broker | Life steal | Vesra, lantern sovereign | Life steal | Lantern snare / stalls darken |
| Garden | Cale, root keeper | Stronger below half health | Senn, antenna regent | Second wind | Root launch / pollen pulse |
| Docks | Dres, flood runner | Unreliable tells | Orven, tide captain | Jammer | Anchor fall / tide rises |

Bosses use individually built costume, armour, headgear, and weapon geometry over the common human rig. Their anatomical bodies are shared with the playable roster; they are not six separately sculpted anatomical models. Phase thresholds are 65% and 30%. A phase transition announces its change before play resumes. Signature danger is forecast in the tell UI; bracing and scanning remain useful. Every boss has a district-bound unique reward.

## Reward and route flow

RPS → action/item → cinematic → defeat or next hand. Victory → choose one of three seeded rewards → choose a door → encounter intro → fight. Doors lead to normal, elite, rest, shop or event rooms. Every room offers an explicit Continue path and cannot softlock. Boss floors and scheduled miniboss floors remain mandatory. Daily routes and rewards use the daily seed.

Perks are finite stacks with explicit effects. Thirty-two perks cover damage, guarding, charge, cooling, items, scans and bounty, with combinations such as warm batteries (heat→charge), precise heavy attacks (scan→damage), and coolant rewards (guard→cooling).

## Attack bible

The move table below is the authoring source for 45 normal attacks and 15 final attacks. Every timeline records pose keys, root path, weapon path, camera, VFX, sound, hit stop and defender reaction. Captured proof includes fixed-beat screenshots and pairwise pose/camera distances; exact equality alone is insufficient.

| Perk | Effect |
|---|---|
| Keen edge | Attacks deal 2 extra base damage. |
| Brace lining | Bracing prevents 2 more damage. |
| Heat sink | Clear 3 extra heat each turn. |
| Spare cell | Build 3 extra charge each turn. |
| Deep pockets | Earn 15% more victory credits. |
| First spark | Deal 6 extra damage on the opening turn. |
| Closing edge | Deal 5 extra damage below 30% rival health. |
| Warm current | Build 5 extra charge above 50 heat. |
| Cold steel | Deal 3 extra damage below 25 heat. |
| Clear lens | Scans cost 5 less charge. |
| Measured hit | A scanned attack deals 6 extra base damage. |
| Hard shell | Prevent 1 damage from every hit. |
| Air gap | Heavy attacks generate 4 less heat. |
| Fresh wrap | Medkits restore 8 extra health. |
| Field stitch | Every third used medkit is preserved. |
| Quick contact | Quick attacks build 3 extra charge. |
| Safe current | Safe attacks build 4 extra charge. |
| Chain link | Each hit streak step adds 1 more damage. |
| Clean vent | Winning hits clear 2 extra heat. |
| Comeback | Deal 6 extra damage below 40% health. |
| Patient cell | Draws build 4 extra charge. |
| Patchwork | Draws restore 3 health. |
| Counter coil | Losing an exchange builds 4 charge. |
| Steady guard | Bracing prevents 8% more incoming damage. |
| Red vent | Clear 4 extra heat above 70 heat. |
| Giant slayer | Deal 3 extra damage to bosses. |
| Hazard pay | Elite victories award 20% more credits. |
| Coolant bank | Coolant clears 10 extra heat. |
| Battery bank | Batteries restore 10 extra charge. |
| Scan memory | A scan refunds 5 charge after an attack. |
| Route forager | Rest rooms grant an extra supply. |
| Slip step | Brace on every fourth exchange to avoid the hit. |
| Rail pass | Morrow’s reward: prevent 2 incoming damage. |
| Furnace heart | Varda’s reward: clear 10 extra heat. |
| Prism memory | Irid’s reward: scanned attacks refund 10 charge. |
| Night dividend | Vesra’s reward: earn 5 extra credits on winning actions. |
| Root pulse | Senn’s reward: winning hits restore 5 health. |
| Tide compass | Orven’s reward: increase tell reliability by 15 points. |

The choreography table is generated from the authored timeline catalog in `src/game/attackCatalog.js`; captured distances and contact sheets are published with the final verification artifacts.

| Fighter / hand / move | Choreography |
|---|---|
| echo / rock / Pommel strike | pommelCoil → jabStep → pommelHit; guardBreak; shoulder shot. |
| echo / rock / Low sweep | lowCoil → groundSlide → lowCut; trip; ground shot. |
| echo / rock / Crosscut | crossHigh → leapCut → crossHit; stagger; highRight shot. |
| echo / rock / Bladebreaker | pommelCoil → breakerDash → breakerHit; guardBreak; tightLow shot. |
| echo / paper / Blade feint | feintLeft → sideLeft → backCut; spin; reverse shot. |
| echo / paper / Mirror step | crossGuard → sideRight → mirrorHit; stagger; overhead shot. |
| echo / paper / Blade storm | wideBlades → spiralRush → stormHit; wallBounce; wideLow shot. |
| echo / paper / Mirror blades | wideBlades → mirrorDash → mirrorFinal; wallBounce; reverseHigh shot. |
| echo / scissors / Quick draw | drawLow → drawDash → drawHit; stagger; blade shot. |
| echo / scissors / Rising cut | lowCoil → risingStep → riseCut; launch; lowLeft shot. |
| echo / scissors / Thousand cuts | crossHigh → doubleDash → flurryHit; spin; orbit shot. |
| echo / scissors / Thousand cuts | crossHigh → flurryDash → thousandHit; spin; heroOrbit shot. |
| cinder / rock / Straight punch | boxingCoil → punchStep → straightHit; stagger; fist shot. |
| cinder / rock / Body blow | bodyCoil → bodyStep → bodyHit; guardBreak; waist shot. |
| cinder / rock / Furnace fall | slamHigh → furnaceLeap → slamHit; slam; highDrop shot. |
| cinder / rock / Crater | slamHigh → craterLeap → craterHit; slam; groundHero shot. |
| cinder / paper / Palm strike | palmCoil → palmStep → palmHit; stagger; palm shot. |
| cinder / paper / Shoulder check | shoulderCoil → shoulderDash → shoulderHit; wallBounce; lowFront shot. |
| cinder / paper / Groundbreak | groundCoil → groundLeap → groundHit; trip; topDown shot. |
| cinder / paper / Discharge | palmCoil → dischargeRush → dischargeHit; wallBounce; frontHero shot. |
| cinder / scissors / Hook | hookCoil → hookArc → hookHit; spin; sideClose shot. |
| cinder / scissors / Uppercut | upperCoil → upperRise → upperHit; launch; lowRise shot. |
| cinder / scissors / Three-hit rush | boxingCoil → tripleRush → rushHit; guardBreak; tracked shot. |
| cinder / scissors / Furnace fall | upperCoil → furnaceVault → furnaceHit; launch; highHero shot. |
| nyx / rock / Prism bolt | staffPoint → stationary → boltCast; stagger; staff shot. |
| nyx / rock / Crystal trap | staffLow → retreat → trapCast; trip; highLeft shot. |
| nyx / rock / Shatter | staffRaise → floatRise → shatterCast; guardBreak; crystal shot. |
| nyx / rock / Shatter | staffRaise → crystalRise → shatterFinal; guardBreak; prismHero shot. |
| nyx / paper / Light wave | waveCoil → floatBack → waveCast; stagger; frontWave shot. |
| nyx / paper / Integral bloom | areaCoil → orbitFloat → areaCast; launch; graph shot. |
| nyx / paper / Singularity | gravityCoil → gravityRise → gravityCast; spin; highWide shot. |
| nyx / paper / Integral collapse | areaCoil → areaRise → integralFinal; slam; integralHero shot. |
| nyx / scissors / Split beam | splitCoil → sideFloat → splitCast; guardBreak; diagonal shot. |
| nyx / scissors / Orbit cast | orbitCoil → orbitBack → orbitCast; spin; orbitHigh shot. |
| nyx / scissors / Zero horizon | horizonCoil → horizonFloat → horizonCast; wallBounce; horizon shot. |
| nyx / scissors / Singularity | gravityCoil → voidRise → singularityFinal; launch; voidHero shot. |
| vex / rock / Heavy arrow | bowHeavy → bowPlant → heavyRelease; guardBreak; arrow shot. |
| vex / rock / Piercing shot | bowLow → bowKneel → pierceRelease; stagger; railShot shot. |
| vex / rock / Meteor rain | bowSky → bowSkyStep → meteorRelease; slam; sky shot. |
| vex / rock / Meteor rain | bowSky → skyVault → meteorFinal; slam; skyHero shot. |
| vex / paper / Volley | bowWide → bowSide → volleyRelease; stagger; threeQuarter shot. |
| vex / paper / Ricochet | bowAcross → bowTurn → ricochetRelease; spin; bank shot. |
| vex / paper / Scattershot | bowSplit → bowLeap → scatterRelease; guardBreak; fanWide shot. |
| vex / paper / Sky pin | bowAcross → pinPivot → pinFinal; guardBreak; pinHero shot. |
| vex / scissors / Quick shot | bowQuick → bowBack → quickRelease; stagger; quiver shot. |
| vex / scissors / Backflip shot | bowFlip → backflip → flipRelease; launch; flip shot. |
| vex / scissors / Starfall | bowStar → bowSpiral → starRelease; wallBounce; stars shot. |
| vex / scissors / Starfall | bowStar → starVault → starFinal; spin; starHero shot. |
| kuro / rock / Thrust | spearCoil → spearStep → thrustHit; stagger; shaft shot. |
| kuro / rock / Vault strike | vaultCoil → glaiveVault → vaultHit; slam; vault shot. |
| kuro / rock / Sky splitter | splitterCoil → splitterLeap → splitterHit; guardBreak; splitter shot. |
| kuro / rock / Storm hammer | hammerCoil → hammerVault → hammerFinal; slam; hammerHero shot. |
| kuro / paper / Low sweep | sweepCoil → sweepSlide → sweepHit; trip; ankle shot. |
| kuro / paper / Turning tide | turnCoil → turningStep → turnHit; spin; turn shot. |
| kuro / paper / Storm wheel | wheelCoil → wheelRush → wheelHit; wallBounce; wheel shot. |
| kuro / paper / Tempest | wheelCoil → tempestSpin → tempestFinal; spin; tempestHero shot. |
| kuro / scissors / Cleaving cut | cleaveCoil → cleaveDash → cleaveHit; guardBreak; edge shot. |
| kuro / scissors / Rising slash | riseCoil → glaiveRise → riseHit; launch; rise shot. |
| kuro / scissors / Heaven’s gate | gateCoil → gateVault → gateHit; slam; gate shot. |
| kuro / scissors / Heaven’s gate | gateCoil → heavenVault → gateFinal; launch; gateHero shot. |
