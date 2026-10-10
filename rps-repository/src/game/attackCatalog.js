import { fighterFor } from './fighters.js';

// Authored sequence rows: duration, impact, wind-up, contact, root path,
// camera rig, effect recipe and reaction. Sharing anatomical pose vocabulary
// does not share a timeline: each row has its own ordered beats and rhythm.
const rows={
 echo:{
 rock:[
  [2050,.53,'pommelCoil','pommelHit','jabStep','shoulder','pommel-spark','guardBreak'],
  [2700,.59,'lowCoil','lowCut','groundSlide','ground','low-dust','trip'],
  [3250,.61,'crossHigh','crossHit','leapCut','highRight','cross-ribbon','stagger'],
 ],
 paper:[
  [2300,.51,'feintLeft','backCut','sideLeft','reverse','ghost-left','spin'],
  [2850,.57,'crossGuard','mirrorHit','sideRight','overhead','mirror-ribbon','stagger'],
  [3500,.63,'wideBlades','stormHit','spiralRush','wideLow','storm-ribbon','wallBounce'],
 ],
 scissors:[
  [1900,.50,'drawLow','drawHit','drawDash','blade','draw-line','stagger'],
  [2600,.58,'lowCoil','riseCut','risingStep','lowLeft','rise-ribbon','launch'],
  [3600,.65,'crossHigh','flurryHit','doubleDash','orbit','flurry-ribbon','spin'],
 ],
 final:[
  [5600,.64,'pommelCoil','breakerHit','breakerDash','tightLow','breaker-ribbon','guardBreak'],
  [6200,.66,'wideBlades','mirrorFinal','mirrorDash','reverseHigh','mirror-afterimage','wallBounce'],
  [6800,.68,'crossHigh','thousandHit','flurryDash','heroOrbit','thousand-ribbon','spin'],
 ]},
 cinder:{
 rock:[
  [1850,.52,'boxingCoil','straightHit','punchStep','fist','straight-spark','stagger'],
  [2500,.57,'bodyCoil','bodyHit','bodyStep','waist','body-dust','guardBreak'],
  [3400,.64,'slamHigh','slamHit','furnaceLeap','highDrop','furnace-crater','slam'],
 ],
 paper:[
  [2250,.54,'palmCoil','palmHit','palmStep','palm','palm-wave','stagger'],
  [2750,.60,'shoulderCoil','shoulderHit','shoulderDash','lowFront','shoulder-dust','wallBounce'],
  [3550,.65,'groundCoil','groundHit','groundLeap','topDown','ground-crater','trip'],
 ],
 scissors:[
  [2150,.55,'hookCoil','hookHit','hookArc','sideClose','hook-spark','spin'],
  [2900,.62,'upperCoil','upperHit','upperRise','lowRise','upper-spark','launch'],
  [3750,.66,'boxingCoil','rushHit','tripleRush','tracked','rush-sparks','guardBreak'],
 ],
 final:[
  [5900,.65,'slamHigh','craterHit','craterLeap','groundHero','crater-cloud','slam'],
  [6100,.67,'palmCoil','dischargeHit','dischargeRush','frontHero','discharge-wave','wallBounce'],
  [6600,.70,'upperCoil','furnaceHit','furnaceVault','highHero','furnace-cloud','launch'],
 ]},
 nyx:{
 rock:[
  [2450,.55,'staffPoint','boltCast','stationary','staff','prism-bolt','stagger'],
  [2850,.59,'staffLow','trapCast','retreat','highLeft','crystal-trap','trip'],
  [3650,.65,'staffRaise','shatterCast','floatRise','crystal','shatter-burst','guardBreak'],
 ],
 paper:[
  [2550,.56,'waveCoil','waveCast','floatBack','frontWave','light-wave','stagger'],
  [3050,.62,'areaCoil','areaCast','orbitFloat','graph','integral-bloom','launch'],
  [3900,.68,'gravityCoil','gravityCast','gravityRise','highWide','gravity-well','spin'],
 ],
 scissors:[
  [2350,.53,'splitCoil','splitCast','sideFloat','diagonal','split-beam','guardBreak'],
  [2950,.60,'orbitCoil','orbitCast','orbitBack','orbitHigh','orbit-shards','spin'],
  [3800,.66,'horizonCoil','horizonCast','horizonFloat','horizon','zero-horizon','wallBounce'],
 ],
 final:[
  [6000,.66,'staffRaise','shatterFinal','crystalRise','prismHero','crystal-supernova','guardBreak'],
  [6700,.69,'areaCoil','integralFinal','areaRise','integralHero','integral-collapse','slam'],
  [7000,.72,'gravityCoil','singularityFinal','voidRise','voidHero','singularity-collapse','launch'],
 ]},
 vex:{
 rock:[
  [2350,.57,'bowHeavy','heavyRelease','bowPlant','arrow','heavy-arrow','guardBreak'],
  [2850,.63,'bowLow','pierceRelease','bowKneel','railShot','piercing-arrow','stagger'],
  [3650,.68,'bowSky','meteorRelease','bowSkyStep','sky','meteor-rain','slam'],
 ],
 paper:[
  [2450,.55,'bowWide','volleyRelease','bowSide','threeQuarter','volley-fan','stagger'],
  [3000,.62,'bowAcross','ricochetRelease','bowTurn','bank','ricochet-arrow','spin'],
  [3750,.67,'bowSplit','scatterRelease','bowLeap','fanWide','scatter-fan','guardBreak'],
 ],
 scissors:[
  [1950,.51,'bowQuick','quickRelease','bowBack','quiver','quick-arrow','stagger'],
  [2900,.61,'bowFlip','flipRelease','backflip','flip','flip-arrow','launch'],
  [3950,.70,'bowStar','starRelease','bowSpiral','stars','starfall-fan','wallBounce'],
 ],
 final:[
  [6200,.68,'bowSky','meteorFinal','skyVault','skyHero','meteor-storm','slam'],
  [6500,.70,'bowAcross','pinFinal','pinPivot','pinHero','sky-pin','guardBreak'],
  [6900,.73,'bowStar','starFinal','starVault','starHero','starfall-storm','spin'],
 ]},
 kuro:{
 rock:[
  [2250,.54,'spearCoil','thrustHit','spearStep','shaft','thrust-line','stagger'],
  [2850,.61,'vaultCoil','vaultHit','glaiveVault','vault','vault-dust','slam'],
  [3700,.67,'splitterCoil','splitterHit','splitterLeap','splitter','sky-ribbon','guardBreak'],
 ],
 paper:[
  [2550,.57,'sweepCoil','sweepHit','sweepSlide','ankle','sweep-ribbon','trip'],
  [3000,.63,'turnCoil','turnHit','turningStep','turn','tide-ribbon','spin'],
  [3900,.69,'wheelCoil','wheelHit','wheelRush','wheel','wheel-ribbon','wallBounce'],
 ],
 scissors:[
  [2400,.56,'cleaveCoil','cleaveHit','cleaveDash','edge','cleave-ribbon','guardBreak'],
  [3150,.65,'riseCoil','riseHit','glaiveRise','rise','rising-ribbon','launch'],
  [4050,.71,'gateCoil','gateHit','gateVault','gate','gate-ribbon','slam'],
 ],
 final:[
  [6100,.67,'hammerCoil','hammerFinal','hammerVault','hammerHero','storm-hammer','slam'],
  [6700,.71,'wheelCoil','tempestFinal','tempestSpin','tempestHero','tempest-ribbons','spin'],
  [7200,.75,'gateCoil','gateFinal','heavenVault','gateHero','heaven-rift','launch'],
 ]},
};
const finalTitles={echo:['Fault sever','Mirror execution','Thousand cuts'],cinder:['Orbit breaker','Chain ignition','Crater maker'],nyx:['Prism prison','Event horizon','Integral collapse'],vex:['Meteor rain','Astral pin','Eclipse arrow'],kuro:['Thunder burial','Heaven’s gate','Iron cyclone']};

// Positions are local to the original combat line. Every finisher has its own
// actor blocking, victim blocking, contacts and world transition. A move through
// space still returns to the same patch of the arena for the last impact.
const key=(at,pose,root,extra={})=>({at,pose,root,...extra});
const victim=(at,x,y,z=0,extra={})=>typeof z==='object'?{at,x,y,z:0,...z}:{at,x,y,z,...extra};
export const FINISHER_STAGING={
 'echo.rock.final':{kind:'fracture',duration:8000,impact:.79,
  actor:[key(.25,'lowCoil',[1.6,-.22,.75]),key(.31,'lowCut',[3.0,-.18,.55]),key(.39,'pommelCoil',[3.7,.2,-.85]),key(.46,'pommelHit',[3.18,.25,-.6]),key(.55,'crossHigh',[2.9,1.65,.5]),key(.62,'riseCut',[3.05,1.28,.15]),key(.70,'knifeFall',[2.65,2.5,-.15]),key(.79,'breakerHit',[3.25,-.18,0]),key(.89,'breakerHit',[3.45,-.16,.15])],
  victim:[victim(.25,0,0),victim(.31,.18,.12),victim(.46,.1,.7,-.35,{roll:.3}),victim(.62,.2,1.7),victim(.74,.16,2.0),victim(.79,0,0)],
  contacts:[[.31,'lowCut'],[.37,'pommelHit'],[.46,'pommelHit'],[.62,'riseCut']],
  cues:[{id:'break',key:'1',at:.32,end:.43,label:'Break the guard'},{id:'bury',key:'3',at:.57,end:.68,label:'Bring it down'}]},
 'echo.paper.final':{kind:'mirror',duration:8400,impact:.80,
  actor:[key(.26,'feintLeft',[2.35,.1,1.45]),key(.34,'backCut',[3.10,.08,1.10]),key(.42,'crossGuard',[4.85,.4,-1.2]),key(.49,'reverseCross',[4.9,.55,-.75]),key(.57,'wideBlades',[3.8,2.7,.7]),key(.64,'mirrorHit',[3.3,2.3,.15]),key(.73,'crossHigh',[2.8,1.0,-1.1]),key(.80,'mirrorFinal',[3.2,.1,0]),key(.91,'wideBlades',[3.6,.08,.25])],
  victim:[victim(.25,0,0),victim(.34,.1,.1,-.2),victim(.49,-.3,.45,.15,{roll:-.32}),victim(.64,.18,1.2,-.05),victim(.80,0,0)],
  contacts:[[.34,'backCut'],[.46,'mirrorHit'],[.49,'reverseCross'],[.64,'mirrorHit']],
  cues:[{id:'reflection',key:'2',at:.32,end:.43,label:'Cross the reflection'},{id:'close',key:'1',at:.56,end:.67,label:'Close the circle'}]},
 'echo.scissors.final':{kind:'blade-storm',duration:8800,impact:.79,
  actor:[key(.27,'drawLow',[1.9,-.12,-1.2]),key(.37,'drawHit',[3.1,.12,-.7]),key(.43,'crossHit',[4.7,.7,.85]),key(.49,'reverseCross',[4.8,.3,-.75]),key(.55,'riseCut',[3.3,1.4,1.1]),key(.61,'flurryHit',[2.9,1.85,-.7]),key(.67,'stormHit',[4.6,1.0,.8]),key(.72,'knifeFall',[3.25,2.8,0]),key(.79,'thousandHit',[3.15,.1,0]),key(.89,'crossGuard',[3.6,.05,.3])],
  victim:[victim(.26,0,0),victim(.37,.1,.4),victim(.43,-.12,.7),victim(.49,.2,.8,.22),victim(.55,.12,1.4,-.18),victim(.61,-.12,1.9),victim(.67,.08,1.3),victim(.79,0,0)],
  contacts:[[.37,'drawHit'],[.43,'crossHit'],[.49,'reverseCross'],[.55,'riseCut'],[.61,'flurryHit'],[.67,'stormHit']],
  cues:[{id:'chase',key:'3',at:.32,end:.43,label:'Keep them airborne'},{id:'crosscut',key:'2',at:.56,end:.67,label:'Cut through'}]},
 'cinder.rock.final':{kind:'crater',duration:8500,impact:.81,
  actor:[key(.25,'bodyCoil',[2.5,-.18,.35]),key(.31,'upperHit',[3.12,.2,0]),key(.40,'slamHigh',[2.4,1.7,.2]),key(.52,'slamHigh',[2.9,5.8,-.3]),key(.64,'divePunch',[3.2,5.3,.4]),key(.74,'slamHit',[3.15,2.5,0]),key(.81,'craterHit',[3.15,-.32,0]),key(.9,'groundCoil',[3.2,-.2,0])],
  victim:[victim(.25,0,0),victim(.31,.1,.25),victim(.40,.35,3.2,.1,{roll:-.5}),victim(.52,.45,6.2),victim(.64,.1,5.8,{roll:.8}),victim(.74,.1,2.7),victim(.81,0,0)],
  contacts:[[.31,'upperHit'],[.64,'divePunch']],
  cues:[{id:'lift',key:'1',at:.32,end:.43,label:'Follow the launch'},{id:'crater',key:'3',at:.56,end:.67,label:'Drive them down'}]},
 'cinder.paper.final':{kind:'inferno',duration:8300,impact:.80,
  actor:[key(.26,'boxingCoil',[2.8,-.1,.85]),key(.31,'bodyHit',[3.18,-.1,.55]),key(.40,'palmCoil',[4.7,.12,-.65]),key(.47,'palmHit',[4.62,.18,-.5]),key(.55,'hookCoil',[3.4,.7,1.0]),key(.61,'hookHit',[3.2,.65,.4]),key(.70,'palmCoil',[2.7,.1,0]),key(.8,'doublePalm',[3.15,.0,0]),key(.91,'boxingCoil',[3.45,.08,.15])],
  victim:[victim(.25,0,0),victim(.31,.15,.05,-.15),victim(.47,-.25,.18,.18),victim(.61,.25,.75,-.15,{roll:.6}),victim(.72,.0,.6),victim(.8,0,0)],
  contacts:[[.31,'bodyHit'],[.36,'bodyHit'],[.47,'palmHit'],[.61,'hookHit']],
  cues:[{id:'ignite',key:'2',at:.32,end:.43,label:'Ignite the chain'},{id:'vent',key:'1',at:.56,end:.67,label:'Open the furnace'}]},
 'cinder.scissors.final':{kind:'orbital',duration:9600,impact:.84,
  actor:[key(.24,'upperCoil',[2.3,-.25,.3]),key(.29,'upperHit',[3.13,.55,0]),key(.38,'upperHit',[3.1,6.3,.2]),key(.43,'airKick',[2.8,10.5,1.2],{kick:1}),key(.48,'boxingCoil',[4.6,12.6,-.75]),key(.52,'airKick',[4.8,12.2,-.9],{kick:1}),key(.57,'upperCoil',[2.4,15.2,.8]),key(.61,'airKick',[3.2,14.3,.55],{kick:1}),key(.68,'slamHigh',[3.4,15.0,-.25]),key(.74,'divePunch',[3.0,10.2,0]),key(.80,'slamHit',[3.15,3.8,.1]),key(.84,'craterHit',[3.15,-.3,0]),key(.91,'groundCoil',[3.35,-.23,.2])],
  victim:[victim(.24,0,0),victim(.29,.12,.5),victim(.38,.2,7.3,{roll:-.8}),victim(.43,.3,10.6,-.15,{roll:-.5}),victim(.48,-.35,13.0,.2),victim(.52,-.2,12.7,{roll:.8}),victim(.57,.4,15.5,.2),victim(.61,.1,14.8,-.1,{roll:-.7}),victim(.68,.25,14.3),victim(.74,.05,9.4,.1,{roll:.45}),victim(.80,.0,3.7),victim(.84,0,0)],
  contacts:[[.29,'upperHit'],[.43,'airKick'],[.52,'airKick'],[.61,'airKick']],world:{name:'space',from:.40,to:.69},
  cues:[{id:'orbit',key:'3',at:.32,end:.43,label:'Chase into orbit'},{id:'reentry',key:'1',at:.56,end:.67,label:'Send them home'}]},
 'nyx.rock.final':{kind:'prism',duration:8200,impact:.80,
  actor:[key(.25,'staffLow',[-.45,.12,.6]),key(.33,'trapCast',[-.2,.25,.5]),key(.43,'staffRaise',[.3,1.3,-.8]),key(.49,'shatterCast',[.1,1.6,-.55]),key(.58,'splitGuard',[-.25,1.4,.65]),key(.65,'shatterCast',[.2,1.8,.4]),key(.72,'staffRaise',[.1,1.1,.0]),key(.80,'shatterFinal',[.1,.6,0]),key(.91,'staffPoint',[.05,.2,0])],
  victim:[victim(.25,0,0),victim(.33,0,.8),victim(.43,.18,2.5),victim(.49,-.15,2.7,.15,{roll:.25}),victim(.58,.18,2.9,-.1,{roll:-.25}),victim(.65,0,3.0),victim(.74,0,1.5),victim(.80,0,0)],
  contacts:[[.33,'trapCast'],[.49,'shatterCast'],[.65,'shatterCast']],
  cues:[{id:'prison',key:'1',at:.32,end:.43,label:'Seal the prism'},{id:'shatter',key:'2',at:.56,end:.67,label:'Shatter every face'}]},
 'nyx.paper.final':{kind:'integral',duration:8600,impact:.81,
  actor:[key(.25,'areaCoil',[-.3,.2,-.5]),key(.34,'areaCast',[.1,.55,-.4]),key(.44,'waveCast',[-.2,1.3,.7]),key(.54,'areaCast',[.2,1.7,.2]),key(.63,'voidPinch',[-.15,1.45,-.6]),key(.73,'areaCoil',[.1,1.2,.25]),key(.81,'integralFinal',[.2,.6,0]),key(.90,'staffLow',[.25,.22,0])],
  victim:[victim(.25,0,0),victim(.34,0,.5),victim(.44,-.1,1.6,.1),victim(.54,.1,2.4,-.1),victim(.63,0,2.8),victim(.74,0,1.6),victim(.81,0,0)],
  contacts:[[.34,'areaCast'],[.44,'waveCast'],[.54,'areaCast'],[.63,'voidPinch']],
  cues:[{id:'partition',key:'2',at:.32,end:.43,label:'Split the area'},{id:'sum',key:'3',at:.56,end:.67,label:'Collapse the sum'}]},
 'nyx.scissors.final':{kind:'singularity',duration:9400,impact:.81,
  actor:[key(.24,'gravityCoil',[-.25,.35,-.45]),key(.33,'gravityCast',[-.1,1.25,-.7]),key(.43,'orbitCast',[.3,2.1,-1.2]),key(.54,'voidPinch',[-.25,2.5,-.7]),key(.63,'singularityFinal',[.1,2.7,-.5]),key(.73,'voidPinch',[.3,2.2,-.8]),key(.81,'singularityFinal',[.15,1.1,0]),key(.90,'staffPoint',[.25,.4,0])],
  victim:[victim(.24,0,0),victim(.33,.2,1.1),victim(.43,.1,3.3,-.7,{roll:.4}),victim(.54,-.8,4.6,-1.5,{roll:-.65}),victim(.63,.55,3.0,-2.0,{roll:.35,stretch:[.68,1.6,.68]}),victim(.73,.15,.7,-2.1,{roll:.1,stretch:[.28,3.4,.32]}),victim(.78,.0,5.6,-2.0,{stretch:[.1,.2,.1]}),victim(.81,0,0,0,{stretch:[1,1,1]})],
  contacts:[[.33,'gravityCast'],[.54,'voidPinch'],[.73,'voidPinch']],world:{name:'void',from:.36,to:.79},anchor:[2.1,6.2,-2.0],
  cues:[{id:'horizon',key:'3',at:.32,end:.43,label:'Open the horizon'},{id:'collapse',key:'2',at:.56,end:.67,label:'Collapse the star'}]},
 'vex.rock.final':{kind:'meteor',duration:8400,impact:.81,
  actor:[key(.25,'bowSky',[-.45,.12,.3]),key(.34,'meteorRelease',[-.35,.4,.3]),key(.45,'bowFlip',[-1.1,2.8,-.5],{roll:-.45}),key(.53,'meteorRelease',[-.6,3.0,-.5]),key(.63,'bowHeavy',[-.3,1.9,.5]),key(.72,'starAim',[-.15,.8,.25]),key(.81,'meteorFinal',[.1,.25,0]),key(.90,'bowQuick',[.2,.0,0])],
  victim:[victim(.25,0,0),victim(.34,.12,.7),victim(.45,-.15,1.9),victim(.53,.2,2.5,.2),victim(.63,-.1,1.5,-.15,{roll:.55}),victim(.74,.0,.9),victim(.81,0,0)],
  contacts:[[.34,'meteorRelease'],[.53,'meteorRelease'],[.63,'heavyRelease']],
  cues:[{id:'mark',key:'1',at:.32,end:.43,label:'Mark the target'},{id:'rain',key:'2',at:.56,end:.67,label:'Call the storm'}]},
 'vex.paper.final':{kind:'constellation',duration:8800,impact:.80,
  actor:[key(.25,'bowAcross',[-.5,.25,.8]),key(.34,'ricochetRelease',[-.4,.35,.75]),key(.43,'reverseShot',[-.65,1.2,-1.05]),key(.49,'pinFinal',[-.55,1.4,-.8]),key(.58,'bowWide',[-.3,2.1,.75]),key(.65,'scatterRelease',[-.15,1.9,.3]),key(.72,'bowHeavy',[.0,.8,0]),key(.8,'pinFinal',[.15,.25,0]),key(.91,'bowAcross',[.25,.1,-.2])],
  victim:[victim(.25,0,0),victim(.34,.1,.5,.1),victim(.43,-.3,1.4,-.2),victim(.49,.18,1.8,.2,{roll:.3}),victim(.58,-.2,2.7),victim(.65,.0,2.8),victim(.74,0,1.4),victim(.8,0,0)],
  contacts:[[.34,'ricochetRelease'],[.49,'pinFinal'],[.65,'scatterRelease']],
  cues:[{id:'constellation',key:'2',at:.32,end:.43,label:'Join the stars'},{id:'pin',key:'1',at:.56,end:.67,label:'Pin the center'}]},
 'vex.scissors.final':{kind:'eclipse',duration:9000,impact:.82,
  actor:[key(.25,'bowStar',[-.55,.35,-.4]),key(.34,'starRelease',[-.4,1.15,-.25]),key(.44,'starAim',[-.7,4.0,.3]),key(.54,'meteorRelease',[-.5,5.8,-.5]),key(.64,'bowStar',[-.2,5.5,.2]),key(.73,'starAim',[.1,2.7,-.2]),key(.82,'starFinal',[.2,.6,0]),key(.91,'bowQuick',[.25,.1,0])],
  victim:[victim(.25,0,0),victim(.34,0,1.4),victim(.44,.2,4.0),victim(.54,-.15,5.5,-.3,{roll:.4}),victim(.64,.0,6.0),victim(.74,.1,3.0),victim(.82,0,0)],
  contacts:[[.34,'starRelease'],[.54,'meteorRelease'],[.64,'starRelease']],world:{name:'space',from:.43,to:.72},
  cues:[{id:'eclipse',key:'3',at:.32,end:.43,label:'Draw the eclipse'},{id:'release',key:'2',at:.56,end:.67,label:'Release the arrow'}]},
 'kuro.rock.final':{kind:'thunder',duration:8200,impact:.79,
  actor:[key(.25,'glaiveHook',[1.8,-.1,-.7]),key(.33,'thrustHit',[2.4,.05,-.4]),key(.44,'vaultCoil',[2.05,1.0,.65]),key(.52,'riseHit',[2.5,2.3,.45]),key(.61,'hammerCoil',[2.2,4.9,-.25]),key(.71,'hammerCoil',[2.35,3.3,0]),key(.79,'hammerFinal',[2.4,-.23,0]),key(.89,'spearCoil',[2.7,-.1,.1])],
  victim:[victim(.25,0,0),victim(.33,.18,.3),victim(.44,-.15,1.2,.1),victim(.52,.2,3.2),victim(.61,.0,5.1),victim(.71,0,3.2,{roll:.65}),victim(.79,0,0)],
  contacts:[[.33,'thrustHit'],[.52,'riseHit']],
  cues:[{id:'thunder',key:'1',at:.32,end:.43,label:'Catch the thunder'},{id:'burial',key:'3',at:.56,end:.67,label:'Strike the ground'}]},
 'kuro.paper.final':{kind:'turbine',duration:9200,impact:.82,
  actor:[key(.25,'sweepCoil',[1.7,-.22,.75]),key(.33,'sweepHit',[2.45,-.18,.45]),key(.41,'glaiveHook',[4.7,.5,-.65]),key(.47,'turnHit',[4.7,.7,-.35]),key(.55,'galeSpiral',[3.3,1.6,1.2]),key(.62,'tempestFinal',[2.8,1.8,.5]),key(.70,'wheelCoil',[2.65,1.5,-.8]),key(.76,'wheelHit',[2.6,1.25,-.15]),key(.82,'tempestFinal',[2.65,.15,0]),key(.91,'spearCoil',[2.9,.1,.25])],
  victim:[victim(.25,0,0),victim(.33,.15,.4),victim(.41,-.35,1.6,-.1,{roll:.45}),victim(.47,.2,2.1,.15,{roll:1.0}),victim(.55,-.35,2.8,-.2,{roll:-1.0}),victim(.62,.35,2.9,.2,{roll:.6}),victim(.70,-.2,2.5,-.1,{roll:-.5}),victim(.76,.2,2.2),victim(.82,0,0)],
  contacts:[[.33,'sweepHit'],[.47,'turnHit'],[.62,'tempestFinal'],[.76,'wheelHit']],
  cues:[{id:'chamber',key:'2',at:.32,end:.43,label:'Close the chamber'},{id:'cyclone',key:'3',at:.56,end:.67,label:'Spin the blades'}]},
 'kuro.scissors.final':{kind:'rift',duration:9400,impact:.82,
  actor:[key(.25,'gateCoil',[1.2,-.15,-.5]),key(.33,'riseHit',[2.5,.45,0]),key(.43,'galeSpiral',[2.2,4.1,.5]),key(.53,'cleaveHit',[4.6,6.1,-.85]),key(.62,'gateCoil',[2.8,7.6,.5]),key(.72,'gateCoil',[2.4,4.4,-.2]),key(.82,'gateFinal',[2.5,-.15,0]),key(.91,'spearCoil',[2.8,-.08,.15])],
  victim:[victim(.25,0,0),victim(.33,.1,.7),victim(.43,.15,4.3),victim(.53,-.2,6.5,-.1,{roll:.55}),victim(.62,.0,7.5),victim(.72,.2,4.2),victim(.82,0,0)],
  contacts:[[.33,'riseHit'],[.53,'cleaveHit'],[.62,'gateHit']],world:{name:'void',from:.43,to:.70},
  cues:[{id:'gate',key:'3',at:.32,end:.43,label:'Cross the gate'},{id:'return',key:'1',at:.56,end:.67,label:'Tear it closed'}]},
};

// The three reference stunts occupy the requested hands. The former sequences
// remain available on the other hand rather than being dropped from the kit.
for(const [left,right]of [['cinder.rock.final','cinder.scissors.final'],['nyx.paper.final','nyx.scissors.final'],['kuro.paper.final','kuro.scissors.final']]){
 [FINISHER_STAGING[left],FINISHER_STAGING[right]]=[FINISHER_STAGING[right],FINISHER_STAGING[left]];
}

export const BONUS_FINISHER_STAGING={
 'echo.rock.final-alt':{title:'Clockbreaker',kind:'timefracture',duration:8800,impact:.81,
  actor:[key(.26,'drawLow',[2.2,-.1,-.65]),key(.32,'drawHit',[3.0,.1,-.4]),key(.41,'crossHigh',[4.6,1.3,.8]),key(.49,'reverseCross',[4.75,1.1,.4]),key(.57,'wideBlades',[2.5,1.8,-1.2]),key(.65,'stormHit',[3.1,1.65,-.5]),key(.74,'pommelCoil',[3.8,.6,.75]),key(.81,'breakerHit',[3.1,.1,0]),key(.91,'drawLow',[3.4,.0,-.25])],
  victim:[victim(.26,0,0),victim(.32,.15,.8),victim(.41,.1,1.7,.2,{roll:-.4}),victim(.49,-.1,1.7,-.2,{roll:.35}),victim(.57,.05,1.7),victim(.65,.2,1.8),victim(.74,.1,.6),victim(.81,0,0)],
  contacts:[[.32,'drawHit'],[.49,'reverseCross'],[.65,'stormHit']],world:{name:'void',from:.42,to:.73},
  cues:[{id:'freeze',key:'2',at:.32,end:.43,label:'Stop the clock'},{id:'break',key:'3',at:.56,end:.67,label:'Break the second'}]},
 'echo.paper.final-alt':{title:'Gravity guillotine',kind:'guillotine',duration:9000,impact:.83,
  actor:[key(.25,'crossGuard',[2.4,.15,.65]),key(.33,'mirrorHit',[3.12,.2,.5]),key(.42,'riseCut',[3.3,2.7,-.3]),key(.50,'reverseCross',[4.8,2.9,.45]),key(.61,'knifeFall',[3.6,4.5,-.6]),key(.70,'crossHigh',[2.95,3.5,.4]),key(.77,'breakerHit',[3.15,1.0,0]),key(.83,'lowCut',[3.25,-.2,0]),key(.92,'wideBlades',[3.5,-.08,.15])],
  victim:[victim(.25,0,0),victim(.33,0,.5),victim(.42,.18,2.7,.1),victim(.5,-.12,3.0,-.1),victim(.61,.0,3.0),victim(.70,.0,2.6),victim(.77,.0,.8),victim(.83,0,0)],
  contacts:[[.33,'mirrorHit'],[.5,'reverseCross'],[.77,'breakerHit']],
  cues:[{id:'blade',key:'1',at:.32,end:.43,label:'Raise the blade'},{id:'release',key:'2',at:.56,end:.67,label:'Release the weight'}]},
 'echo.scissors.final-alt':{title:'Thread maze',kind:'threadmaze',duration:8600,impact:.81,
  actor:[key(.26,'wideBlades',[2.1,.15,1.4]),key(.32,'backCut',[3.2,.1,1.1]),key(.41,'wideBlades',[5.35,.4,-1.3]),key(.49,'mirrorHit',[4.8,.7,-.8]),key(.57,'crossGuard',[1.9,1.4,.8]),key(.63,'stormHit',[2.65,1.7,.4]),key(.73,'drawLow',[2.4,.5,-.4]),key(.81,'thousandHit',[3.15,.15,0]),key(.91,'wideBlades',[3.5,.1,.45])],
  victim:[victim(.26,0,0),victim(.32,.1,.55,.3),victim(.41,.8,1.2,.75),victim(.49,1.15,1.5,.5,{roll:-.4}),victim(.57,-.8,2.0,-.7,{roll:.45}),victim(.63,-.55,2.3,-.35),victim(.73,.1,1.0,.1),victim(.81,0,0)],
  contacts:[[.32,'backCut'],[.49,'mirrorHit'],[.63,'stormHit']],
  cues:[{id:'weave',key:'3',at:.32,end:.43,label:'Weave the trap'},{id:'snap',key:'1',at:.56,end:.67,label:'Snap every thread'}]},
 'cinder.rock.final-alt':{title:'Rail cannon',kind:'railcannon',duration:9500,impact:.85,
  actor:[key(.25,'bodyCoil',[2.2,-.2,-.4]),key(.32,'upperHit',[3.15,.25,0]),key(.43,'palmCoil',[2.85,.1,.15]),key(.49,'doublePalm',[3.2,.2,0]),key(.60,'boxingCoil',[2.35,.1,-.3]),key(.68,'straightHit',[3.3,.35,0]),key(.76,'slamHigh',[3.25,2.2,.15]),key(.85,'craterHit',[3.22,-.3,0]),key(.93,'boxingCoil',[3.55,-.1,.2])],
  victim:[victim(.25,0,0),victim(.32,.12,.75),victim(.43,1.5,1.3),victim(.49,4.8,1.5,0,{roll:-.35}),victim(.60,8.4,1.6,-.15,{roll:-.5}),victim(.68,5.5,1.9,.1),victim(.76,.2,2.1),victim(.85,0,0)],
  contacts:[[.32,'upperHit'],[.49,'doublePalm'],[.68,'straightHit']],
  cues:[{id:'load',key:'2',at:.32,end:.43,label:'Load the rail'},{id:'fire',key:'1',at:.56,end:.67,label:'Fire the cannon'}]},
 'cinder.paper.final-alt':{title:'Sun in your hands',kind:'suncore',duration:9300,impact:.83,
  actor:[key(.25,'palmCoil',[1.6,.1,.6]),key(.33,'palmHit',[3.1,.15,.25]),key(.43,'doublePalm',[2.6,.65,-.3]),key(.49,'upperHit',[3.3,1.2,.1]),key(.58,'slamHigh',[2.3,2.5,-.65]),key(.65,'dischargeHit',[3.1,2.8,-.2]),key(.75,'groundCoil',[3.0,1.4,.2]),key(.83,'doublePalm',[3.15,.1,0]),key(.92,'palmCoil',[3.4,.05,-.25])],
  victim:[victim(.25,0,0),victim(.33,.1,.6),victim(.43,.2,1.8),victim(.49,.25,2.8,.2),victim(.58,.1,4.2,-.1),victim(.65,.0,4.4),victim(.75,.1,2.0),victim(.83,0,0)],
  contacts:[[.33,'palmHit'],[.49,'upperHit'],[.65,'dischargeHit']],
  cues:[{id:'core',key:'1',at:.32,end:.43,label:'Hold the sun'},{id:'nova',key:'3',at:.56,end:.67,label:'Let it go nova'}]},
 'cinder.scissors.final-alt':{title:'Magnetic collapse',kind:'magnetic',duration:8900,impact:.82,
  actor:[key(.25,'hookCoil',[2.3,.1,-.75]),key(.33,'hookHit',[3.1,.1,-.45]),key(.41,'upperCoil',[4.7,.55,.8]),key(.47,'upperHit',[4.65,1.0,.45]),key(.57,'bodyCoil',[2.5,1.6,-1.0]),key(.63,'bodyHit',[3.25,1.8,-.35]),key(.74,'slamHigh',[3.0,2.8,.1]),key(.82,'furnaceHit',[3.1,.1,0]),key(.91,'boxingCoil',[3.5,.05,-.2])],
  victim:[victim(.25,0,0),victim(.33,.2,.7,.15),victim(.41,-.5,1.9,-.3),victim(.47,-.2,2.5),victim(.57,.35,2.9,.2,{roll:.4}),victim(.63,.05,2.7,0,{stretch:[.75,.75,.75]}),victim(.74,.0,1.4),victim(.82,0,0)],
  contacts:[[.33,'hookHit'],[.47,'upperHit'],[.63,'bodyHit']],
  cues:[{id:'magnet',key:'3',at:.32,end:.43,label:'Pull the iron'},{id:'collapse',key:'2',at:.56,end:.67,label:'Crush the field'}]},
 'nyx.rock.final-alt':{title:'Crystal cathedral',kind:'cathedral',duration:9100,impact:.83,
  actor:[key(.25,'staffLow',[-.5,.05,-.35]),key(.32,'trapCast',[-.2,.25,-.2]),key(.43,'staffRaise',[.25,1.3,.55]),key(.49,'shatterCast',[.4,1.7,.35]),key(.60,'splitGuard',[-.4,2.15,-.6]),key(.66,'shatterFinal',[.05,2.4,-.3]),key(.75,'staffRaise',[.2,1.3,.2]),key(.83,'shatterFinal',[.05,.45,0]),key(.92,'staffLow',[.15,.1,.25])],
  victim:[victim(.25,0,0),victim(.32,.0,.65),victim(.43,.0,1.75),victim(.49,.1,2.4,.1),victim(.60,-.1,3.65,-.1),victim(.66,.0,3.8),victim(.75,.0,1.85),victim(.83,0,0)],
  contacts:[[.32,'trapCast'],[.49,'shatterCast'],[.66,'shatterFinal']],
  cues:[{id:'raise',key:'2',at:.32,end:.43,label:'Raise the pillars'},{id:'close',key:'1',at:.56,end:.67,label:'Close the cathedral'}]},
 'nyx.paper.final-alt':{title:'Paper universe',kind:'origami',duration:9400,impact:.84,
  actor:[key(.25,'waveCoil',[-.25,.15,.65]),key(.33,'waveCast',[.1,.55,.4]),key(.44,'areaCoil',[-.5,1.1,-.65]),key(.52,'splitCast',[.1,1.55,-.3]),key(.62,'voidPinch',[-.1,1.85,.8]),key(.70,'areaCast',[.25,1.6,.3]),key(.77,'staffLow',[.05,.9,-.2]),key(.84,'integralFinal',[.2,.4,0]),key(.93,'waveCoil',[.15,.1,.2])],
  victim:[victim(.25,0,0),victim(.33,.15,.9),victim(.44,.4,1.6,.4,{roll:.45,stretch:[.9,.8,1.1]}),victim(.52,-.4,2.8,-.35,{roll:-.6,stretch:[.7,.6,1.4]}),victim(.62,.0,3.1,{stretch:[.4,.5,.4]}),victim(.70,.1,2.5,{roll:.25,stretch:[.28,.42,.3]}),victim(.77,.0,1.3,{stretch:[.55,.7,.55]}),victim(.84,0,0)],
  contacts:[[.33,'waveCast'],[.52,'splitCast'],[.70,'areaCast']],world:{name:'void',from:.42,to:.73},
  cues:[{id:'fold',key:'3',at:.32,end:.43,label:'Fold the world'},{id:'unfold',key:'2',at:.56,end:.67,label:'Unfold the strike'}]},
 'nyx.scissors.final-alt':{title:'Gravity engine',kind:'gravitywell',duration:10000,impact:.86,
  actor:[key(.25,'gravityCoil',[-.45,.2,-.65]),key(.32,'gravityCast',[-.3,.9,-.4]),key(.44,'orbitCast',[.15,2.7,.8]),key(.50,'voidPinch',[.4,3.4,.55]),key(.60,'singularityFinal',[-.4,3.7,-.8]),key(.67,'horizonCast',[-.1,3.3,-.35]),key(.77,'gravityCoil',[.2,2.2,.4]),key(.86,'singularityFinal',[.2,.5,0]),key(.94,'staffPoint',[.15,.1,0])],
  victim:[victim(.25,0,0),victim(.32,.2,.9),victim(.44,1.8,4.3,.9,{roll:.4}),victim(.50,-1.4,6.4,-.8,{roll:-.7}),victim(.60,1.5,7.0,.8,{roll:.65}),victim(.67,-1.2,5.8,-.6,{roll:-.6}),victim(.77,.15,3.0,.0),victim(.86,0,0)],
  contacts:[[.32,'gravityCast'],[.50,'voidPinch'],[.67,'horizonCast']],world:{name:'space',from:.42,to:.73},anchor:[2.1,5.5,-2],
  cues:[{id:'orbit',key:'1',at:.32,end:.43,label:'Turn the engine'},{id:'drop',key:'3',at:.56,end:.67,label:'Drop the orbit'}]},
 'vex.rock.final-alt':{title:'Tidal arrow',kind:'tidal',duration:9000,impact:.82,
  actor:[key(.25,'bowLow',[-.5,-.15,.5]),key(.32,'pierceRelease',[-.2,-.1,.3]),key(.42,'bowFlip',[-.9,1.1,-.7],{roll:-.6}),key(.49,'volleyRelease',[-.55,1.25,-.4]),key(.59,'bowWide',[-.4,1.8,.75]),key(.66,'heavyRelease',[-.2,1.65,.4]),key(.74,'bowLow',[-.35,.3,0]),key(.82,'heavyRelease',[.1,.05,0]),key(.91,'bowQuick',[.2,.1,.15])],
  victim:[victim(.25,0,0),victim(.32,.3,1.2),victim(.42,.9,2.4,.4,{roll:-.35}),victim(.49,.3,2.7,.3),victim(.59,-.5,2.9,-.2,{roll:.5}),victim(.66,-.2,2.3,-.1),victim(.74,.15,1.0),victim(.82,0,0)],
  contacts:[[.32,'pierceRelease'],[.49,'volleyRelease'],[.66,'heavyRelease']],
  cues:[{id:'tide',key:'3',at:.32,end:.43,label:'Draw the tide'},{id:'break',key:'1',at:.56,end:.67,label:'Break the wave'}]},
 'vex.paper.final-alt':{title:'Astral tether',kind:'tether',duration:9500,impact:.85,
  actor:[key(.25,'bowAcross',[-.25,.05,-.75]),key(.33,'ricochetRelease',[-.1,.3,-.5]),key(.44,'reverseShot',[-.7,1.5,1.0]),key(.51,'pinFinal',[-.25,2.0,.6]),key(.61,'bowAcross',[-.35,2.3,-.8]),key(.68,'ricochetRelease',[.15,2.1,-.4]),key(.77,'bowSky',[-.15,1.1,.2]),key(.85,'pinFinal',[.2,.1,0]),key(.93,'bowAcross',[.25,.1,-.25])],
  victim:[victim(.25,0,0),victim(.33,.0,1.0),victim(.44,1.5,3.5,2.8,{roll:-.6}),victim(.51,.9,4.7,1.8,{roll:-.35}),victim(.61,-1.3,3.8,-2.2,{roll:.55}),victim(.68,-.8,3.1,-1.4),victim(.77,.15,1.6,.2),victim(.85,0,0)],
  contacts:[[.33,'ricochetRelease'],[.51,'pinFinal'],[.68,'ricochetRelease']],
  cues:[{id:'tether',key:'1',at:.32,end:.43,label:'Set the tether'},{id:'swing',key:'2',at:.56,end:.67,label:'Swing the stars'}]},
 'vex.scissors.final-alt':{title:'Star lance',kind:'starlance',duration:9800,impact:.85,
  actor:[key(.25,'bowStar',[-.7,.2,.55]),key(.32,'starRelease',[-.45,.7,.3]),key(.44,'bowSky',[-.3,2.0,-.7]),key(.53,'meteorRelease',[-.15,2.5,-.35]),key(.63,'starAim',[-.6,2.8,.75]),key(.70,'starFinal',[-.25,2.6,.35]),key(.78,'bowHeavy',[.15,1.35,-.2]),key(.85,'starFinal',[.15,.3,0]),key(.93,'bowQuick',[.25,.1,.2])],
  victim:[victim(.25,0,0),victim(.32,.1,.9),victim(.44,.25,3.5,-.4),victim(.53,.0,6.0,-1.2),victim(.63,.1,7.7,-1.0),victim(.70,.0,7.2,-.7),victim(.78,.15,3.0,-.1),victim(.85,0,0)],
  contacts:[[.32,'starRelease'],[.53,'meteorRelease'],[.70,'starFinal']],world:{name:'space',from:.42,to:.73},
  cues:[{id:'lance',key:'2',at:.32,end:.43,label:'Raise the star lance'},{id:'fall',key:'3',at:.56,end:.67,label:'Let it fall'}]},
 'kuro.rock.final-alt':{title:'Chrono blade',kind:'chronoblade',duration:9000,impact:.81,
  actor:[key(.25,'spearCoil',[1.4,.05,.7]),key(.32,'thrustHit',[2.4,.1,.4]),key(.40,'riseCoil',[2.0,2.1,-.8]),key(.49,'riseHit',[2.8,2.5,-.5]),key(.57,'glaiveHook',[4.75,.15,.75]),key(.64,'turnHit',[4.65,.25,.4]),key(.74,'gateCoil',[2.6,2.6,-.15]),key(.81,'hammerFinal',[2.55,-.12,0]),key(.91,'spearCoil',[2.8,.0,.2])],
  victim:[victim(.25,0,0),victim(.32,.12,.65),victim(.4,.1,3.1),victim(.49,-.12,3.5,-.1),victim(.57,.0,.4,.15),victim(.64,.2,1.1),victim(.74,.0,2.3),victim(.81,0,0)],
  contacts:[[.32,'thrustHit'],[.49,'riseHit'],[.64,'turnHit']],world:{name:'void',from:.42,to:.73},
  cues:[{id:'rewind',key:'3',at:.32,end:.43,label:'Turn back the clock'},{id:'sever',key:'1',at:.56,end:.67,label:'Sever the moment'}]},
 'kuro.paper.final-alt':{title:'Serpent coil',kind:'serpent',duration:9300,impact:.83,
  actor:[key(.25,'glaiveHook',[1.75,-.1,-.75]),key(.33,'sweepHit',[2.55,-.08,-.4]),key(.43,'galeSpiral',[4.8,1.35,.8]),key(.50,'turnHit',[4.6,1.65,.4]),key(.61,'wheelCoil',[2.4,2.55,-1.1]),key(.67,'tempestFinal',[2.9,2.4,-.35]),key(.76,'hammerCoil',[2.5,1.4,.1]),key(.83,'hammerFinal',[2.55,-.2,0]),key(.92,'spearCoil',[2.85,-.08,-.2])],
  victim:[victim(.25,0,0),victim(.33,.2,.7),victim(.43,-.65,2.0,-.6,{roll:.5}),victim(.50,-.8,2.8,-.7,{roll:.7}),victim(.61,.85,3.7,.8,{roll:-.6}),victim(.67,.55,3.4,.5),victim(.76,.1,1.6,.1),victim(.83,0,0)],
  contacts:[[.33,'sweepHit'],[.50,'turnHit'],[.67,'tempestFinal']],
  cues:[{id:'coil',key:'1',at:.32,end:.43,label:'Coil the serpent'},{id:'bite',key:'2',at:.56,end:.67,label:'Strike the ground'}]},
 'kuro.scissors.final-alt':{title:'Aurora plunge',kind:'aurora',duration:9600,impact:.84,
  actor:[key(.25,'riseCoil',[1.4,-.1,.75]),key(.32,'riseHit',[2.45,.5,.4]),key(.43,'galeSpiral',[2.15,3.8,-.6]),key(.51,'cleaveHit',[4.6,4.8,.65]),key(.62,'gateCoil',[2.6,6.5,-.5]),key(.70,'galeSpiral',[2.7,5.0,.35]),key(.78,'gateHit',[2.55,2.1,.1]),key(.84,'gateFinal',[2.6,-.18,0]),key(.93,'spearCoil',[2.9,.0,.2])],
  victim:[victim(.25,0,0),victim(.32,.1,.9),victim(.43,.15,3.9),victim(.51,-.2,4.9,-.1,{roll:.4}),victim(.62,.15,5.8,.15),victim(.70,.0,4.7),victim(.78,.1,2.0),victim(.84,0,0)],
  contacts:[[.32,'riseHit'],[.51,'cleaveHit'],[.78,'gateHit']],
  cues:[{id:'lights',key:'2',at:.32,end:.43,label:'Follow the northern lights'},{id:'plunge',key:'3',at:.56,end:.67,label:'Dive through the sky'}]},
};
Object.assign(FINISHER_STAGING,BONUS_FINISHER_STAGING);

// Light moves hit once. Safe moves have a counter-beat. Heavy moves use an
// authored setup contact, a directional change, then the damaging impact.
export const NORMAL_CONTACTS={
 'echo.rock.1':[[.33,'pommelHit']], 'echo.rock.2':[[.34,'lowCut'],[.46,'riseCut']],
 'echo.paper.1':[[.34,'backCut']], 'echo.paper.2':[[.32,'mirrorHit'],[.46,'stormHit'],[.55,'backCut']],
 'echo.scissors.1':[[.32,'drawHit']], 'echo.scissors.2':[[.31,'drawHit'],[.42,'crossHit'],[.53,'flurryHit']],
 'cinder.rock.1':[[.31,'straightHit']], 'cinder.rock.2':[[.32,'bodyHit'],[.47,'upperHit']],
 'cinder.paper.1':[[.33,'palmHit']], 'cinder.paper.2':[[.32,'shoulderHit'],[.48,'bodyHit']],
 'cinder.scissors.1':[[.32,'bodyHit']], 'cinder.scissors.2':[[.28,'straightHit'],[.39,'hookHit'],[.51,'upperHit']],
 'nyx.rock.1':[[.34,'boltCast']], 'nyx.rock.2':[[.32,'trapCast'],[.47,'splitCast']],
 'nyx.paper.1':[[.34,'waveCast']], 'nyx.paper.2':[[.33,'areaCast'],[.48,'gravityCast'],[.57,'waveCast']],
 'nyx.scissors.1':[[.31,'splitCast']], 'nyx.scissors.2':[[.32,'orbitCast'],[.46,'splitCast']],
 'vex.rock.1':[[.34,'quickRelease']], 'vex.rock.2':[[.34,'meteorRelease'],[.48,'heavyRelease']],
 'vex.paper.1':[[.33,'volleyRelease']], 'vex.paper.2':[[.32,'volleyRelease'],[.46,'ricochetRelease'],[.56,'scatterRelease']],
 'vex.scissors.1':[[.32,'quickRelease']], 'vex.scissors.2':[[.33,'quickRelease'],[.47,'flipRelease'],[.59,'starRelease']],
 'kuro.rock.1':[[.32,'thrustHit']], 'kuro.rock.2':[[.33,'vaultHit'],[.49,'riseHit']],
 'kuro.paper.1':[[.33,'sweepHit']], 'kuro.paper.2':[[.32,'sweepHit'],[.46,'turnHit'],[.57,'wheelHit']],
 'kuro.scissors.1':[[.34,'cleaveHit']], 'kuro.scissors.2':[[.34,'riseHit'],[.50,'turnHit'],[.60,'cleaveHit']],
};
export const ATTACK_CATALOG=[];
for(const [character,kit]of Object.entries(rows))for(const [handIndex,weapon]of ['rock','paper','scissors'].entries()){
 for(let variant=0;variant<4;variant++){
  const final=variant===3,[originalDuration,originalImpact,wind,contact,path,camera,vfx,reaction]=final?kit.final[handIndex]:kit[weapon][variant];
  const id=`${character}.${weapon}.${final?'final':variant}`;
  const staging=FINISHER_STAGING[id];
  const duration=staging?.duration??originalDuration,impact=staging?.impact??originalImpact;
  const contacts=staging?.contacts??NORMAL_CONTACTS[id]??[];
  const heavy=final||variant===2;
  const beats=[
   {id:'neutral',at:0,pose:'neutral',root:path,camera:'establish',vfx:[],sfx:[],ease:'smooth'},
   {id:'anticipation',at:.13,pose:wind,root:path,camera,vfx:final?['charge']:[],sfx:['weapon-hum'],ease:'outCubic'},
   {id:'approach',at:heavy?.30:.27,pose:wind,root:path,camera:`${camera}:travel`,vfx:vfx.includes('ghost')||vfx.includes('afterimage')?['afterimage']:[],sfx:['dash-whoosh'],ease:'inQuint'},
   {id:'contact',at:impact-.018,pose:contact,root:path,camera:`${camera}:contact`,vfx:[vfx],sfx:['weapon-whoosh'],ease:'inQuint'},
   {id:'impact',at:impact,pose:contact,root:path,camera:`${camera}:impact`,vfx:[vfx,'contact-sparks'],sfx:[`${fighterFor(character).style}-hit`],hitStop:final?110:variant===2?85:45,reaction,ease:'hold'},
   {id:'follow-through',at:impact+.11,pose:contact,root:path,camera:`${camera}:follow`,vfx:[vfx],sfx:[],reaction,ease:'outCubic'},
   {id:'recovery',at:1,pose:'neutral',root:path,camera:'establish',vfx:[],sfx:[],ease:'smooth'},
  ];
  for(const [at,pose]of contacts)beats.push({id:`combo-${at}`,at,pose,root:path,camera:`${camera}:combo`,vfx:[vfx,'contact-sparks'],sfx:[`${fighterFor(character).style}-hit`],reaction:pose.toLowerCase().includes('upper')||pose.includes('rise')?'launch':'stagger',ease:'outCubic'});
  beats.sort((a,b)=>a.at-b.at);
  ATTACK_CATALOG.push({id,character,weapon,variant:Math.min(variant,2),final,duration,impact,wind,contact,path,camera,vfx,reaction,contacts,beats,staging,title:final?finalTitles[character][handIndex]:fighterFor(character).moves[weapon][variant],description:`${wind} → ${path} → ${contact}; ${reaction}; ${camera} shot.`});
 }
}
export const BONUS_FINISHERS=Object.entries(BONUS_FINISHER_STAGING).map(([id,staging])=>{
 const base=ATTACK_CATALOG.find(s=>s.id===id.replace('-alt',''));
 const wind=staging.actor[0].pose,contact=staging.actor.find(p=>p.at===staging.impact).pose;
 const beats=[{id:'neutral',at:0,pose:'neutral',root:base.path,camera:'establish',vfx:[],sfx:[]},
  {id:'anticipation',at:.13,pose:wind,root:base.path,camera:base.camera,vfx:['charge'],sfx:['weapon-hum']},
  ...staging.actor.map((node,i)=>({id:`stage-${i}`,at:node.at,pose:node.pose,root:base.path,rootPosition:node.root,camera:`${base.camera}:directed`,vfx:[staging.kind],sfx:[]})),
  ...staging.contacts.map(([at,pose],i)=>({id:`combo-${i}`,at,pose,root:base.path,camera:`${base.camera}:contact`,vfx:[staging.kind,'contact-sparks'],sfx:[`${fighterFor(base.character).style}-hit`]})),
  {id:'impact',at:staging.impact,pose:contact,root:base.path,camera:`${base.camera}:impact`,vfx:[staging.kind,'contact-sparks'],sfx:[`${fighterFor(base.character).style}-hit`],hitStop:110,reaction:base.reaction},
  {id:'recovery',at:1,pose:'neutral',root:base.path,camera:'establish',vfx:[],sfx:[]}].sort((a,b)=>a.at-b.at);
 return{...base,id,wind,contact,finisherIndex:1,duration:staging.duration,impact:staging.impact,staging,contacts:staging.contacts,beats,vfx:`${staging.kind}-final`,title:staging.title,description:`${staging.title}: ${staging.contacts.length+1} contacts; ${staging.kind} world choreography.`};
});
ATTACK_CATALOG.push(...BONUS_FINISHERS);
export function sequenceFor(character,weapon,variant=0,final=false,finisherIndex=0){return ATTACK_CATALOG.find(a=>a.id===`${character}.${weapon}.${final?(finisherIndex%2?'final-alt':'final'):variant%3}`);}
const bossRows=[
 {id:'morrow.signature',character:'cinder',weapon:'rock',title:'Rail hammer',duration:4500,impact:.68,wind:'hammerCoil',contact:'hammerFinal',path:'hammerVault',camera:'railBoss',vfx:'rail-hammer',reaction:'guardBreak'},
 {id:'varda.signature',character:'cinder',weapon:'paper',title:'Furnace dive',duration:4600,impact:.69,wind:'slamHigh',contact:'furnaceHit',path:'furnaceVault',camera:'kilnBoss',vfx:'furnace-cloud',reaction:'slam'},
 {id:'irid.signature',character:'kuro',weapon:'scissors',title:'Refraction cut',duration:4400,impact:.66,wind:'splitterCoil',contact:'gateFinal',path:'mirrorDash',camera:'prismBoss',vfx:'prism-rift',reaction:'spin'},
 {id:'vesra.signature',character:'nyx',weapon:'paper',title:'Lantern snare',duration:4900,impact:.72,wind:'areaCoil',contact:'gravityCast',path:'areaRise',camera:'lanternBoss',vfx:'lantern-snare',reaction:'launch'},
 {id:'senn.signature',character:'kuro',weapon:'rock',title:'Root launch',duration:4800,impact:.70,wind:'groundCoil',contact:'riseHit',path:'glaiveRise',camera:'rootBoss',vfx:'root-launch',reaction:'launch'},
 {id:'orven.signature',character:'cinder',weapon:'scissors',title:'Anchor fall',duration:5100,impact:.74,wind:'slamHigh',contact:'craterHit',path:'craterLeap',camera:'tideBoss',vfx:'tide-crater',reaction:'wallBounce'},
];

export const BOSS_SEQUENCES=bossRows.map(s=>({...s,beats:[{id:'anticipation',at:.13,pose:s.wind,root:s.path,camera:s.camera,vfx:['charge'],sfx:['boss-hum'],ease:'outCubic'},{id:'approach',at:.30,pose:s.wind,root:s.path,camera:s.camera+':travel',vfx:[s.vfx],sfx:['dash-whoosh'],ease:'inQuint'},{id:'contact',at:s.impact-.018,pose:s.contact,root:s.path,camera:s.camera+':contact',vfx:[s.vfx],sfx:['weapon-whoosh'],ease:'inQuint'},{id:'impact',at:s.impact,pose:s.contact,root:s.path,camera:s.camera+':impact',vfx:[s.vfx,'contact-sparks'],sfx:['boss-hit'],hitStop:110,reaction:s.reaction,ease:'hold'},{id:'follow-through',at:s.impact+.11,pose:s.contact,root:s.path,camera:s.camera+':follow',vfx:[s.vfx],sfx:[],reaction:s.reaction,ease:'outCubic'},{id:'recovery',at:1,pose:'neutral',root:s.path,camera:'establish',vfx:[],sfx:[],ease:'smooth'}]}));
