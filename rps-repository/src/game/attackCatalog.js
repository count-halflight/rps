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
const finalTitles={echo:['Bladebreaker','Mirror blades','Thousand cuts'],cinder:['Crater','Discharge','Furnace fall'],nyx:['Shatter','Integral collapse','Singularity'],vex:['Meteor rain','Sky pin','Starfall'],kuro:['Storm hammer','Tempest','Heaven’s gate']};
export const ATTACK_CATALOG=[];
for(const [character,kit]of Object.entries(rows))for(const [handIndex,weapon]of ['rock','paper','scissors'].entries()){
 for(let variant=0;variant<4;variant++){
  const final=variant===3,[duration,impact,wind,contact,path,camera,vfx,reaction]=final?kit.final[handIndex]:kit[weapon][variant];
  const id=`${character}.${weapon}.${final?'final':variant}`;
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
  ATTACK_CATALOG.push({id,character,weapon,variant:Math.min(variant,2),final,duration,impact,wind,contact,path,camera,vfx,reaction,beats,title:final?finalTitles[character][handIndex]:fighterFor(character).moves[weapon][variant],description:`${wind} → ${path} → ${contact}; ${reaction}; ${camera} shot.`});
 }
}
export function sequenceFor(character,weapon,variant=0,final=false){return ATTACK_CATALOG.find(a=>a.id===`${character}.${weapon}.${final?'final':variant%3}`);}
const bossRows=[
 {id:'morrow.signature',character:'cinder',weapon:'rock',title:'Rail hammer',duration:4500,impact:.68,wind:'hammerCoil',contact:'hammerFinal',path:'hammerVault',camera:'railBoss',vfx:'rail-hammer',reaction:'guardBreak'},
 {id:'varda.signature',character:'cinder',weapon:'paper',title:'Furnace dive',duration:4600,impact:.69,wind:'slamHigh',contact:'furnaceHit',path:'furnaceVault',camera:'kilnBoss',vfx:'furnace-cloud',reaction:'slam'},
 {id:'irid.signature',character:'kuro',weapon:'scissors',title:'Refraction cut',duration:4400,impact:.66,wind:'splitterCoil',contact:'gateFinal',path:'mirrorDash',camera:'prismBoss',vfx:'prism-rift',reaction:'spin'},
 {id:'vesra.signature',character:'nyx',weapon:'paper',title:'Lantern snare',duration:4900,impact:.72,wind:'areaCoil',contact:'gravityCast',path:'areaRise',camera:'lanternBoss',vfx:'lantern-snare',reaction:'launch'},
 {id:'senn.signature',character:'kuro',weapon:'rock',title:'Root launch',duration:4800,impact:.70,wind:'groundCoil',contact:'riseHit',path:'glaiveRise',camera:'rootBoss',vfx:'root-launch',reaction:'launch'},
 {id:'orven.signature',character:'cinder',weapon:'scissors',title:'Anchor fall',duration:5100,impact:.74,wind:'slamHigh',contact:'craterHit',path:'craterLeap',camera:'tideBoss',vfx:'tide-crater',reaction:'wallBounce'},
];

export const BOSS_SEQUENCES=bossRows.map(s=>({...s,beats:[{id:'anticipation',at:.13,pose:s.wind,root:s.path,camera:s.camera,vfx:['charge'],sfx:['boss-hum'],ease:'outCubic'},{id:'approach',at:.30,pose:s.wind,root:s.path,camera:s.camera+':travel',vfx:[s.vfx],sfx:['dash-whoosh'],ease:'inQuint'},{id:'contact',at:s.impact-.018,pose:s.contact,root:s.path,camera:s.camera+':contact',vfx:[s.vfx],sfx:['weapon-whoosh'],ease:'inQuint'},{id:'impact',at:s.impact,pose:s.contact,root:s.path,camera:s.camera+':impact',vfx:[s.vfx,'contact-sparks'],sfx:['boss-hit'],hitStop:110,reaction:s.reaction,ease:'hold'},{id:'follow-through',at:s.impact+.11,pose:s.contact,root:s.path,camera:s.camera+':follow',vfx:[s.vfx],sfx:[],reaction:s.reaction,ease:'outCubic'},{id:'recovery',at:1,pose:'neutral',root:s.path,camera:'establish',vfx:[],sfx:[],ease:'smooth'}]}));
