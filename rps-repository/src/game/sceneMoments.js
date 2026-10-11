import {POSE_KEYS} from './poseKeys.js';
import {echoPose,blendEchoPoses} from './sequences/echo/poses.js';
import {clamp,mix,vector,smooth,segment,blendValue} from './sequences/math.js';
import {physicalClock} from './sequences/timeDirector.js';

// Ancillary floor staging is separate from the 65 attack IDs. Times are
// unscaled seconds; every returned pose/root/camera is pure and scrub-safe.
export const ANATOMICAL_HEIGHTS=Object.freeze({echo:1.72,cinder:1.90,nyx:1.82,vex:1.70,kuro:1.88,bulwark:2.20});
const neutralHands={cinder:[[.23,1.56,.32],[-.23,1.56,.32]],nyx:[[.30,1.20,.25],[-.25,1.39,.27]],vex:[[.30,1.40,.27],[-.22,1.44,.14]],kuro:[[.28,1.28,.34],[-.27,1.36,.32]]};
const body=(character,key='neutral',extra={})=>{
 const p=echoPose('ECHO_IDLE'),hands=neutralHands[character];
 return {...p,...(hands?{handL:hands[0],handR:hands[1]}:{}),...(POSE_KEYS[key]||{}),openHand:character==='nyx',grip:character==='echo'?'reverse':'forward',
  ...extra,face:{...p.face,...extra.face}};
};
const echo=(key,extra={})=>({...echoPose(key),...extra,face:{...echoPose(key).face,...extra.face}});
const node=(t,pose,pos,yaw,camera,extra={})=>({t,pose,root:{pos,yaw,ease:'smooth'},camera,...extra});
const shot=(type,pos,look,fov=38)=>({shot:type,pos,look,fov});
const event=(id,at,end,extra={})=>({id,at,end,...extra});
const step=(pose,left,extra={})=>({...pose,footL:left?[.15,.30,.36]:[.15,.11,.12],footR:left?[-.15,.11,-.16]:[-.15,.29,.34],footLock:left?[0,1]:[1,0],...extra});
const home=shot('ESTABLISH',[0,2.9,9.8],[0,1.42,0],35);

const ENTRANCES=[
 {id:'entrance.echo',character:'echo',kind:'entrance',duration:2300,title:'Twin blades',taunt:'Try to keep up.',hitTimes:[1.66],reviewTimes:[0,.24,.46,.7,.95,1.18,1.42,1.66,1.83,2,2.16,2.3],beats:[
  node(0,echo('SHEATH_GUARD'),[3.2,0,-.50],-.14,shot('DOLLY',[3.4,1.9,8.2],[4.0,1.4,-.25],40)),
  node(.24,step(echo('DASH_LEFT'),true),[2.15,-.035,-.62],-.22,shot('DOLLY',[2.8,1.80,7.9],[3.15,1.35,-.35],40),{fx:[event('AFTERIMAGE',.22,.66,{count:2,opacity:.22,anchor:'actor'})]}),
  node(.46,step(echo('DASH_RIGHT'),false),[1.30,-.04,-.34],.18,shot('WHIP-PAN',[2.4,1.85,7.5],[2.6,1.37,-.18],39)),
  node(.70,echo('LANDING'),[.32,-.16,.10],.08,shot('DOLLY',[2.0,1.65,7.45],[2.0,1.30,0],38)),
  node(.95,echo('ECHO_IDLE'),[0,0,0],0,shot('TWO-SHOT',[1.6,1.9,7.35],[1.30,1.42,0],36)),
  node(1.18,echo('CUT_HIGH',{handL:[.33,1.15,.22],handR:[-.29,1.95,.13],headYaw:.28,weaponSweep:2.1,expression:'smirk',face:{smirk:.60}}),[0,0,0],-.10,shot('LOW-HERO',[2.6,1.14,7.0],[1.60,1.46,0],35)),
  node(1.42,echo('DRAW_FOLLOW',{handL:[.31,1.15,.2],handR:[-.31,1.72,.19],headYaw:.3,weaponSweep:3.1,expression:'smirk',face:{smirk:.60}}),[0,0,0],-.12,shot('LOW-HERO',[2.3,1.20,7.1],[1.60,1.47,0],35),{fx:[event('TRAIL_RIBBON',1.18,1.70,{opacity:.28,anchor:'weapon'})]}),
  node(1.66,echo('SHEATH_CLICK',{bladeState:'drawn',drawProgress:1,handR:[-.28,1.36,.24],weaponSweep:.15}),[0,0,0],0,shot('TWO-SHOT',[1.7,1.85,7.75],[1.25,1.44,0],36),{sfx:[event('blade-catch',1.66,1.75)]}),
  node(2.3,echo('ECHO_IDLE'),[0,0,0],0,home),
 ]},
 {id:'entrance.cinder',character:'cinder',kind:'entrance',duration:2300,title:'Impact wraps',taunt:'Your move.',hitTimes:[.42,.80,1.10,1.75],reviewTimes:[0,.22,.42,.62,.8,1.1,1.35,1.56,1.75,1.88,2.07,2.3],beats:[
  node(0,body('cinder','boxingCoil',{torsoYaw:-.20}),[2.65,0,.48],.16,shot('FLOOR-LEVEL',[3.1,.70,9.0],[3.5,1.12,.18],44)),
  node(.22,step(body('cinder','bodyCoil'),true),[2.18,-.07,.35],.10,shot('FLOOR-LEVEL',[2.8,.65,8.7],[3.1,1.10,.12],43)),
  node(.42,body('cinder','boxingCoil',{torsoPitch:.28}),[1.63,-.13,.2],.05,shot('LOW-HERO',[2.6,.93,8.45],[2.75,1.27,.08],42),{fx:[event('DUST_RING',.42,.68,{size:.65,anchor:'feet',opacity:.30})],sfx:[event('heel-thud',.42,.50)]}),
  node(.62,step(body('cinder','boxingCoil'),false),[1.12,-.04,.1],-.08,shot('LOW-HERO',[2.1,1.1,8.1],[2.35,1.32,.04],41)),
  node(.80,body('cinder','boxingCoil',{torsoPitch:.20}),[.55,-.12,.05],0,shot('LOW-HERO',[1.85,1.1,7.8],[1.95,1.35,0],40),{fx:[event('DUST_RING',.8,1.05,{size:.7,anchor:'feet',opacity:.3})],sfx:[event('heel-thud',.8,.88)]}),
  node(1.10,body('cinder','boxingCoil'),[0,-.08,0],0,shot('LOW-HERO',[2.4,1.05,7.5],[1.6,1.45,0],38),{sfx:[event('heel-thud',1.10,1.18)]}),
  node(1.35,body('cinder','palmCoil',{handL:[.31,1.49,.46],handR:[-.30,1.49,.45],openHand:true,face:{smirk:.65},headYaw:.15}),[0,0,0],-.12,shot('LOW-HERO',[2.4,1.07,7.4],[1.6,1.48,0],37)),
  node(1.56,body('cinder','boxingCoil',{handL:[.32,1.42,.15],handR:[-.32,1.41,.15],torsoYaw:.14}),[0,0,0],0,shot('LOW-HERO',[2.25,1.10,7.6],[1.6,1.47,0],38)),
  node(1.75,body('cinder','rushHit',{handL:[.07,1.44,.47],handR:[-.07,1.44,.46],torsoPitch:.19,face:{smirk:.55,grit:.25}}),[0,-.07,0],0,shot('LOW-HERO',[2.18,1.1,7.7],[1.6,1.46,0],39),{fx:[event('EMBERS',1.75,2.1,{count:24,opacity:.4,anchor:'hands'}),event('SPARKS',1.75,1.94,{count:10,opacity:.45,anchor:'hands'})],sfx:[event('fist-clap',1.75,1.86)]}),
  node(2.3,body('cinder','boxingCoil'),[0,0,0],0,home),
 ]},
 {id:'entrance.nyx',character:'nyx',kind:'entrance',duration:2300,title:'Prism staff',taunt:'Watch the light.',hitTimes:[1.86],reviewTimes:[0,.26,.55,.83,1.1,1.35,1.56,1.7,1.86,2,2.15,2.3],beats:[
  node(0,body('nyx','staffPoint',{footLock:[0,0],footL:[.13,.19,.14],footR:[-.13,.19,-.13]}),[2.70,.12,-.68],-.20,shot('ORBIT',[4.0,3.5,9.0],[3.6,1.53,-.35],41)),
  node(.55,body('nyx','staffLow',{torsoYaw:.10,footLock:[0,0]}),[1.60,.18,-.43],-.10,shot('ORBIT',[3.4,3.0,8.8],[2.8,1.55,-.20],40)),
  node(1.10,body('nyx','staffPoint',{footLock:[0,0],face:{smirk:.25}}),[.50,.12,-.14],0,shot('ORBIT',[2.5,2.6,8.2],[1.98,1.51,-.05],39)),
  node(1.35,body('nyx','staffRaise',{handR:[-.19,1.91,.12],headYaw:.15,face:{smirk:.48}}),[0,.08,0],-.05,shot('ORBIT',[2.7,2.72,7.6],[1.6,1.58,0],37)),
  node(1.70,body('nyx','orbitCast',{handL:[.33,1.48,.33],handR:[-.15,1.75,.45],weaponSweep:1.20,headYaw:.12,footLock:[0,0]}),[0,.04,0],.10,shot('ORBIT',[1.8,2.7,7.5],[1.6,1.52,0],37),{fx:[event('PRISM_BEAM',1.35,2.02,{opacity:.32,axis:'fan',count:3,anchor:'weapon'})],sfx:[event('prism-turn',1.35,1.94)]}),
  node(1.86,body('nyx','staffLow',{torsoPitch:.18}),[0,-.06,0],0,shot('LOW-HERO',[1.55,1.30,8.0],[1.5,1.35,0],38),{fx:[event('SHOCKRING',1.86,2.2,{size:.5,opacity:.22,anchor:'feet'})],sfx:[event('staff-tap',1.86,1.96)]}),
  node(2.3,body('nyx','staffPoint'),[0,0,0],0,home),
 ]},
 {id:'entrance.vex',character:'vex',kind:'entrance',duration:2300,title:'Arc bow',taunt:'Take your time.',hitTimes:[1.73],reviewTimes:[0,.23,.46,.7,.94,1.16,1.38,1.58,1.73,1.95,2.13,2.3],beats:[
  node(0,body('vex','bowQuick'),[3.1,0,.75],.38,shot('DOLLY',[3.5,2.15,8.3],[3.9,1.35,.4],40)),
  node(.23,step(body('vex','bowQuick'),true),[2.25,-.025,.59],.23,shot('DOLLY',[3,2.08,8.1],[3.3,1.36,.28],40)),
  node(.46,step(body('vex','bowAcross'),false),[1.50,-.04,.30],.38,shot('DOLLY',[2.6,2.04,7.9],[2.8,1.35,.16],39)),
  node(.94,body('vex','bowQuick',{handL:[.42,1.23,.25],handR:[-.27,1.25,.20]}),[0,0,0],.40,shot('TWO-SHOT',[2.6,1.9,7.6],[1.60,1.42,0],36)),
  node(1.16,body('vex','bowQuick',{handL:[.36,1.26,.25],handR:[.06,1.47,.45],headPitch:.25,headYaw:-.18,face:{smirk:.55}}),[0,0,0],.26,shot('OTS',[2.35,2.0,7.1],[1.6,1.48,0],34)),
  node(1.58,body('vex','bowQuick',{handL:[.36,1.25,.26],handR:[-.11,1.51,.35],headPitch:-.04,face:{smirk:.7},draw:.25}),[0,0,0],.12,shot('OTS',[2.28,1.98,7.2],[1.6,1.48,0],35)),
  node(1.73,body('vex','bowHeavy',{draw:.4,face:{smirk:.4}}),[0,0,0],.10,shot('TWO-SHOT',[1.86,2.05,7.8],[1.45,1.47,0],36),{fx:[event('ARROW_TRAIL',1.73,2.1,{opacity:.22,anchor:'weapon',length:.6})],sfx:[event('bow-nock',1.73,1.90)]}),
  node(2.3,body('vex','bowQuick'),[0,0,0],0,home),
 ]},
 {id:'entrance.kuro',character:'kuro',kind:'entrance',duration:2300,title:'Storm glaive',taunt:'Hold your ground.',hitTimes:[1.93],reviewTimes:[0,.22,.44,.66,.88,1.10,1.3,1.57,1.75,1.93,2.13,2.3],beats:[
  node(0,body('kuro','spearCoil'),[2.4,0,-.38],-.06,shot('LOW-HERO',[3.2,1.05,9.4],[3.5,1.48,-.18],42)),
  node(.44,step(body('kuro','spearCoil'),true),[1.67,-.055,-.22],.04,shot('LOW-HERO',[2.8,1.14,9],[2.8,1.43,-.1],42)),
  node(.88,step(body('kuro','spearCoil'),false),[.76,-.075,-.08],-.05,shot('LOW-HERO',[2.4,1.20,8.7],[2.25,1.43,-.03],41)),
  node(1.10,body('kuro','spearCoil'),[0,0,0],0,shot('LOW-HERO',[2.2,1.26,8.4],[1.60,1.48,0],40)),
  node(1.30,body('kuro','thrustHit',{headYaw:.04,torsoPitch:.07,face:{browDown:.60}}),[0,0,0],0,shot('LOW-HERO',[2.25,1.23,8.3],[1.4,1.45,0],40)),
  node(1.75,body('kuro','hammerCoil',{torsoPitch:-.10,face:{browDown:.65},footLock:[1,1]}),[0,0,0],.03,shot('LOW-HERO',[2.2,1.18,9.1],[1.6,1.91,0],43),{fx:[event('ARC_LIGHTNING',1.5,1.92,{opacity:.32,anchor:'weapon',size:.4})]}),
  node(1.93,body('kuro','spearCoil',{torsoPitch:.18}),[0,-.04,0],0,shot('FLOOR-LEVEL',[1.9,1.04,8.6],[1.55,1.36,0],41),{fx:[event('DUST_RING',1.93,2.2,{opacity:.24,size:.6,anchor:'feet'})],sfx:[event('glaive-plant',1.93,2.03)]}),
  node(2.3,body('kuro','spearCoil'),[0,0,0],0,home),
 ]},
];

const bulwark=(key,extra={})=>body('kuro',key,{expression:'grit',face:{browDown:.75,grit:.35},...extra});
const bulwarkGuard=()=>bulwark('spearCoil',{handL:[.33,1.21,.35],handR:[-.27,1.56,.16],torsoPitch:.10,footL:[.22,.11,.26],footR:[-.23,.11,-.27]});
const gauntletGuard=()=>bulwark('boxingCoil',{handL:[.29,1.54,.34],handR:[-.28,1.52,.34],torsoPitch:.12,weaponMode:'gauntlets',footL:[.23,.11,.3],footR:[-.23,.11,-.3]});
const BOSS_MOMENTS=[
 {id:'bulwark.intro',character:'kuro',bossId:'bulwark',kind:'boss-intro',duration:5000,title:'BULWARK',subtitle:'Warden Ironveil',taunt:'The gate stays closed.',hitTimes:[.90,1.60,2.25],reviewTimes:[0,.45,.9,1.3,1.6,1.95,2.25,2.72,3.25,3.8,4.4,5],beats:[
  node(0,bulwarkGuard(),[2.60,0,-.20],-.08,shot('ESTABLISH',[2.8,2.0,12],[3.15,1.25,-.10],42),{lights:{drain:.82,blackout:.45,key:1},wardrobe:{phase:0,plateRotation:0,shieldSplit:0}}),
  node(.45,step(bulwarkGuard(),true),[2.08,-.06,-.12],-.05,shot('FLOOR-LEVEL',[2.9,.54,10.8],[2.75,1.08,-.07],45),{lights:{drain:.82,blackout:.45,key:1}}),
  node(.90,bulwark('spearCoil',{handL:[.31,1.17,.39],handR:[-.29,1.52,.17],torsoPitch:.34}),[1.56,-.18,-.09],-.03,shot('LOW-HERO',[2.55,.74,10.3],[2.55,1.22,-.05],44),{fx:[event('DUST_RING',.90,1.3,{anchor:'feet',size:1.2,opacity:.35})],sfx:[event('iron-step',.9,1.06)]}),
  node(1.30,step(bulwarkGuard(),false),[.85,-.05,-.05],.04,shot('LOW-HERO',[2.3,.88,9.9],[2.08,1.35,-.02],43)),
  node(1.60,bulwarkGuard(),[.25,-.16,0],0,shot('LOW-HERO',[2.1,.94,9.4],[1.70,1.40,0],43),{fx:[event('DUST_RING',1.6,1.95,{anchor:'feet',size:1.3,opacity:.35})],sfx:[event('iron-step',1.6,1.78)]}),
  node(1.95,bulwark('staffLow',{handL:[.35,1.28,.52],handR:[-.28,1.69,.08],torsoPitch:-.05}),[0,0,0],0,shot('LOW-HERO',[2.25,.96,7.3],[1.60,1.36,0],37)),
  node(2.25,bulwark('groundCoil',{handL:[.28,.99,.55],handR:[-.27,1.58,.16],torsoPitch:.55,footL:[.23,.11,.34],footR:[-.23,.11,-.34]}),[0,-.27,0],0,shot('FLOOR-LEVEL',[2.3,.66,7.0],[1.60,1.15,0],38),{fx:[event('SHOCKRING',2.25,2.9,{anchor:'feet',size:1.5,opacity:.35}),event('DUST_RING',2.25,3,{anchor:'feet',size:1.8,opacity:.32}),event('SPARKS',2.25,2.6,{anchor:'shield',count:24,opacity:.4})],sfx:[event('shield-plant',2.25,2.52)]}),
  node(2.72,bulwarkGuard(),[0,0,0],0,shot('LOW-HERO',[2.05,.97,6.8],[1.60,1.38,0],34),{wardrobe:{phase:0,plateRotation:.45,signatureWarning:true,shieldSplit:0}}),
  node(3.25,bulwark('splitGuard',{handL:[.35,1.33,.43],handR:[-.34,1.54,.14],torsoYaw:-.18,headPitch:-.04}),[0,0,0],-.07,shot('ORBIT',[3.3,1.4,6.9],[1.60,1.35,0],34),{wardrobe:{phase:0,plateRotation:1,signatureWarning:true,shieldSplit:0},fx:[event('LIGHT_PILLAR',2.72,3.85,{anchor:'actor',opacity:.18,size:1.2})]}),
  node(3.80,bulwarkGuard(),[0,0,0],0,shot('ORBIT',[.5,1.45,7.5],[1.60,1.45,0],35),{wardrobe:{phase:0,plateRotation:0,signatureWarning:false,shieldSplit:0}}),
  node(4.40,bulwarkGuard(),[0,0,0],0,shot('DOLLY',[.1,2.3,10.0],[.8,1.42,0],40),{lights:{drain:.35,blackout:0,key:1,relight:.65}}),
  node(5,bulwarkGuard(),[0,0,0],0,home,{lights:{drain:0,blackout:0,key:1,relight:1}}),
 ]},
 {id:'bulwark.phase1',character:'kuro',bossId:'bulwark',kind:'phase',duration:3000,title:'The shield splits',phase:1,hitTimes:[1.45],reviewTimes:[0,.22,.45,.7,.95,1.15,1.45,1.65,1.92,2.22,2.58,3],beats:[
  node(0,bulwarkGuard(),[0,0,0],0,shot('TWO-SHOT',[.9,2.2,8.4],[1.25,1.45,0],40),{wardrobe:{phase:0,brokenPlates:0,shieldSplit:0}}),
  node(.22,bulwark('guardBreak',{handL:[.39,1.73,.32],handR:[-.37,1.75,.18],torsoPitch:-.67,headPitch:-.15}),[.12,-.10,0],-.08,shot('DOLLY',[1.75,1.8,8.1],[1.62,1.42,0],39)),
  node(.70,bulwark('bodyCoil',{handL:[.37,1.20,.43],handR:[-.34,1.26,.43],torsoPitch:.69}),[0,-.25,0],0,shot('LOW-HERO',[2.05,1.00,8.0],[1.60,1.26,0],40),{wardrobe:{phase:0,plateRotation:.7,signatureWarning:true}}),
  node(1.15,bulwark('groundCoil',{handL:[.25,1.38,.55],handR:[-.25,1.38,.55],torsoPitch:.35}),[0,-.17,0],0,shot('LOW-HERO',[2.0,1.1,7.7],[1.60,1.36,0],39),{wardrobe:{phase:0,plateRotation:1,signatureWarning:true,shieldSplit:0}}),
  node(1.45,bulwark('doublePalm',{handL:[.46,1.45,.27],handR:[-.46,1.46,.27],torsoPitch:-.1,weaponMode:'gauntlets'}),[0,.02,0],0,shot('LOW-HERO',[1.9,1.15,8.3],[1.60,1.43,0],42),{wardrobe:{phase:1,brokenPlates:2,plateRotation:1,signatureWarning:false,shieldSplit:1},fx:[event('DEBRIS',1.45,2.7,{style:'armour',anchor:'actor',count:18,opacity:.5}),event('SHOCKRING',1.45,2,{anchor:'actor',size:1.1,opacity:.32}),event('SPARKS',1.45,1.85,{anchor:'hands',count:28,opacity:.5})],sfx:[event('shield-split',1.45,1.78)]}),
  node(1.92,bulwark('boxingCoil',{handL:[.37,1.65,.32],handR:[-.35,1.64,.32],weaponMode:'gauntlets',torsoYaw:.24}),[0,-.06,.10],.15,shot('ORBIT',[.85,1.55,8.9],[1.60,1.42,.04],40)),
  node(2.58,gauntletGuard(),[0,0,0],0,shot('DOLLY',[.5,2.4,9.35],[.8,1.42,0],39)),
  node(3,gauntletGuard(),[0,0,0],0,home),
 ]},
 {id:'bulwark.phase2',character:'kuro',bossId:'bulwark',kind:'phase',duration:3000,title:'The last plates fall',phase:2,hitTimes:[1.1,1.90],reviewTimes:[0,.20,.42,.70,.92,1.1,1.4,1.7,1.90,2.2,2.6,3],beats:[
  node(0,gauntletGuard(),[0,0,0],0,shot('TWO-SHOT',[1.2,2.3,8.5],[1.20,1.45,0],40),{wardrobe:{phase:1,brokenPlates:2,shieldSplit:1}}),
  node(.42,bulwark('bodyCoil',{handL:[.36,1.32,.43],handR:[-.36,1.29,.44],torsoPitch:.82,weaponMode:'gauntlets'}),[0,-.30,0],0,shot('LOW-HERO',[2.05,.91,7.8],[1.6,1.23,0],40),{wardrobe:{phase:1,signatureWarning:true,plateRotation:.65}}),
  node(.92,bulwark('slamHigh',{handL:[.45,1.91,.13],handR:[-.45,1.92,.13],torsoPitch:-.30,weaponMode:'gauntlets'}),[0,0,0],0,shot('LOW-HERO',[2.2,1.15,8.1],[1.6,1.55,0],41),{wardrobe:{phase:1,signatureWarning:true,plateRotation:1}}),
  node(1.10,bulwark('wideBlades',{handL:[.50,1.52,.18],handR:[-.50,1.54,.18],torsoPitch:-.14,weaponMode:'gauntlets',face:{browDown:.90,shout:.45}}),[0,.02,0],0,shot('LOW-HERO',[2.1,1.2,8.7],[1.6,1.5,0],43),{wardrobe:{phase:2,brokenPlates:6,signatureWarning:false,plateRotation:0,shieldSplit:1},fx:[event('DEBRIS',1.1,2.6,{style:'armour',anchor:'actor',count:36,opacity:.5}),event('SHOCKRING',1.1,1.85,{anchor:'actor',size:1.3,opacity:.32})],sfx:[event('armour-shed',1.10,1.48)]}),
  node(1.4,step(gauntletGuard(),true,{handR:[-.21,1.56,.42],torsoYaw:-.35,face:{grit:.8}}),[-.25,-.09,.28],-.24,shot('ORBIT',[2.2,1.8,8.9],[1.45,1.38,.12],41)),
  node(1.70,step(gauntletGuard(),false,{torsoYaw:.37,handL:[.20,1.52,.42]}),[.17,-.08,-.25],.22,shot('ORBIT',[.9,2.0,9.0],[1.55,1.39,-.06],40)),
  node(1.90,gauntletGuard(),[0,-.08,0],0,shot('LOW-HERO',[1.7,1.26,8.6],[1.6,1.4,0],40),{fx:[event('DUST_RING',1.9,2.24,{anchor:'feet',size:.8,opacity:.25})],sfx:[event('quick-brace',1.9,2.05)]}),
  node(3,gauntletGuard(),[0,0,0],0,home),
 ]},
 {id:'bulwark.plate-break',character:'kuro',bossId:'bulwark',kind:'plate-break',duration:3000,title:'Plate shattered',hitTimes:[.50],reviewTimes:[0,.18,.34,.5,.64,.83,1.10,1.45,1.8,2.15,2.58,3],beats:[
  node(0,bulwarkGuard(),[0,0,0],0,shot('TWO-SHOT',[1.1,2.0,8.3],[1.2,1.4,0],38)),
  node(.34,bulwark('guardBreak',{handL:[.38,1.79,.29],handR:[-.38,1.78,.26],torsoPitch:-.45,headPitch:-.12}),[.16,-.09,.03],-.12,shot('DOLLY',[2.15,1.73,7.8],[1.65,1.37,0],37),{wardrobe:{signatureWarning:true,plateRotation:1}}),
  node(.50,bulwark('guardBreak',{handL:[.45,1.87,.19],handR:[-.42,1.76,.20],torsoPitch:-.72,torsoYaw:.25,headPitch:-.19}),[.30,-.12,.03],-.15,shot('SNAP-ZOOM',[2.08,1.63,8.0],[1.65,1.37,0],40),{fx:[event('DEBRIS',.50,1.85,{style:'single-plate',anchor:'chest',count:9,opacity:.45}),event('SPARKS',.5,.80,{anchor:'chest',count:20,opacity:.5})],sfx:[event('plate-fracture',.5,.76)],wardrobe:{breakOne:true,signatureWarning:false,plateRotation:0}}),
  node(.83,bulwark('bodyCoil',{handL:[.29,1.16,.47],handR:[-.26,1.45,.18],torsoPitch:.58,headPitch:.16}),[.18,-.20,0],-.08,shot('LOW-HERO',[2.0,1.13,8.3],[1.62,1.32,0],39)),
  node(1.45,bulwark('spearCoil',{handL:[.26,1.22,.49],handR:[-.27,1.51,.2],torsoPitch:.17,headYaw:.18}),[.06,-.06,0],0,shot('DOLLY',[1.4,1.7,9.0],[1.5,1.4,0],38)),
  node(3,bulwarkGuard(),[0,0,0],0,home),
 ]},
];

export const SCENE_MOMENTS=Object.freeze([...ENTRANCES,...BOSS_MOMENTS].map(s=>Object.freeze({...s,hitStop:s.bossId?110:45,origin:1.6,height:ANATOMICAL_HEIGHTS[s.bossId||s.character]})));
const moments=new Map(SCENE_MOMENTS.map(s=>[s.id,s]));
export const sceneMomentById=id=>moments.get(id);
export function sceneMomentPresentation(id,options={}){
 const s=sceneMomentById(id);if(!s)throw new Error(`Unknown scene moment: ${id}`);
 const duration=options.reduced||options.short?Math.min(s.duration,s.kind==='entrance'?1700:3000):s.duration;
 return {id:s.id,momentId:s.id,character:s.character,bossId:s.bossId||null,kind:s.kind,title:s.title,duration,bodyDuration:s.duration,origin:s.origin,height:s.height,...options};
}
export function evaluateSceneMoment(id,elapsedSeconds,options={}){
 const s=sceneMomentById(id);if(!s)throw new Error(`Unknown scene moment: ${id}`);
 const p=sceneMomentPresentation(id,options),progress=clamp(elapsedSeconds/(p.duration/1000)),time=progress*s.duration/1000;
 const physical=physicalClock(s,time,{reduced:options.reduced,durationScale:p.duration/s.duration});
 const motion=segment(s.beats,physical.physicalSeconds),actor=blendEchoPoses(motion.a.pose,motion.b.pose,motion.alpha),position=vector(motion.a.root.pos,motion.b.root.pos,motion.alpha);
 const {a,b,alpha}=segment(s.beats,time);
 const side=options.side==='player'?-1:1,sign=side*(options.mirrored?-1:1),actorSide=sign>0?'enemy':'player';
 Object.assign(actor,{x:position[0],y:position[1],z:position[2],yaw:mix(motion.a.root.yaw,motion.b.root.yaw,motion.alpha),poseId:`${s.id}:${s.beats.indexOf(motion.alpha<.5?motion.a:motion.b)}`,reduced:!!options.reduced});
 const root={pos:[sign*(s.origin+actor.x),actor.y,actor.z],yaw:-sign*Math.PI/2+actor.yaw*sign};
 const measuredHeight=options.actorHeight||s.height,heightCorrection=(measuredHeight-2.1)*.66;
 let camera=vector(a.camera.pos,b.camera.pos,alpha),target=vector(a.camera.look,b.camera.look,alpha),fov=mix(a.camera.fov,b.camera.fov,alpha),cameraShot=alpha<.5?a.camera.shot:b.camera.shot;
 const homeWeight=(a.camera===home?1-alpha:0)+(b.camera===home?alpha:0);
 const distanceScale=mix(.72,.65,homeWeight);
 camera[2]=target[2]+(camera[2]-target[2])*distanceScale;
 camera[0]*=sign;target[0]*=sign;camera[1]+=heightCorrection;target[1]+=heightCorrection;
 if(options.reduced){camera=[0,2.45+heightCorrection,7.0];target=[0,measuredHeight*.66,0];fov=40;cameraShot='TWO-SHOT';}
 const contacts=s.hitTimes||[],contactIndex=contacts.reduce((last,at,i)=>time>=at?i:last,-1),contactTime=contactIndex<0?contacts[0]||0:contacts[contactIndex];
 const impact=contactIndex<0?0:Math.max(0,1-Math.abs(time-contactTime)/.11),allWardrobes=s.beats.filter(beat=>beat.t<=time&&beat.wardrobe);
 const wardrobe={phase:options.phase||0,brokenPlates:options.brokenPlates||0,signatureWarning:false,plateRotation:0,shieldSplit:options.phase>0?1:0};
 for(const beat of allWardrobes)Object.assign(wardrobe,beat.wardrobe);
 if(s.kind==='plate-break'){
  wardrobe.phase=options.phase||0;wardrobe.shieldSplit=wardrobe.phase>0?1:0;
  wardrobe.brokenPlates=Math.min(6,(options.brokenPlates||0)+(time>=.5?1:0));wardrobe.breakOne=time>=.5&&(options.brokenPlates||0)<6;
 }
 if(s.kind==='boss-intro'&&options.phase>0){wardrobe.phase=options.phase;wardrobe.shieldSplit=1;wardrobe.brokenPlates=Math.max(wardrobe.brokenPlates,options.brokenPlates||0);}
 if(s.bossId==='bulwark')wardrobe.shieldPresentationYaw=.62+(s.kind==='boss-intro'?
  .16*smooth(1.95,2.25,physical.physicalSeconds)*(1-smooth(2.35,2.72,physical.physicalSeconds)):0);
 if(s.bossId)actor.weaponMode=wardrobe.phase>0?'gauntlets':'shield-hammer';
 const lastLights=at=>s.beats.filter(beat=>beat.t<=at&&beat.lights).at(-1)?.lights||{drain:0,blackout:0,key:1,relight:0};
 const lightsA=lastLights(a.t),lightsB=lastLights(b.t),lights=blendValue(lightsA,lightsB,alpha);
 const fx=s.beats.flatMap(beat=>beat.fx||[]).filter(f=>time>=f.at&&time<f.end).map(f=>({...f,phase:(time-f.at)/(f.end-f.at),age:time-f.at,opacity:Math.min(.6,f.opacity||.4),soft:true}));
 const cardStart=s.kind==='entrance'?.55:s.kind==='boss-intro'?2.5:.35,cardEnd=s.kind==='boss-intro'?3.15:s.kind==='entrance'?.85:.75;
 const cardProgress=smooth(cardStart,cardEnd,time)*(1-smooth(s.duration/1000-.45,s.duration/1000,time));
 return {id:s.id,momentId:s.id,kind:s.kind,progress,time,unscaledSeconds:elapsedSeconds,physicalSeconds:physical.physicalSeconds*p.duration/s.duration,timeScale:physical.timeScale,hitStopped:physical.hitStopped,origin:s.origin,actorSide,actor,root,
  camera,target,fov,roll:0,cameraShot,shot:time<.25?'anticipation':progress>.85?'recovery':'approach',
  bars:options.reduced?0:s.bossId?1:0,lights,fx,wardrobe,impact,contactAt:contactTime/(s.duration/1000),contactIndex,
  actorHeight:measuredHeight,actorEyeHeight:options.actorEyeHeight||measuredHeight*.925,
  card:{title:s.title,subtitle:s.subtitle||null,opacity:cardProgress},taunt:{text:s.taunt||null,opacity:cardProgress},
  sfx:s.beats.flatMap(beat=>beat.sfx||[]),finished:progress>=1,shake:options.reduced?0:impact*(s.bossId?.32:.1),flash:0,
 };
}
export function sceneMomentContactSheetTimes(id,count=12,options={}){
 const s=sceneMomentById(id);if(!s)throw new Error(`Unknown scene moment: ${id}`);
 const length=Math.max(1,Math.floor(count)),source=s.reviewTimes,p=sceneMomentPresentation(id,options),scale=p.duration/s.duration;
 if(length===12)return source.map(t=>t*scale);
 return Array.from({length},(_,i)=>source[Math.round(i*(source.length-1)/Math.max(1,length-1))]*scale);
}
