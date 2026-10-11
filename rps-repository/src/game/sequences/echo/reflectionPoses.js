import {echoPose,blendEchoPoses} from './poses.js';
import {clamp,smooth} from '../math.js';
import {ECHO_REFLECTION_BLADE_ANCHORS} from './reflectionBladeAnchors.js';

// These are physical full-body poses for the reflected attackers. The offline
// atlas and the pure director share this exact vocabulary and phase ordering.
// Each short blade points into the contact plane in a reverse grip.
const authored=(base,extra)=>{
  const pose={...echoPose(base),...extra,footLock:[0,0],floorY:0,
    grip:'reverse',bladeState:'drawn',drawProgress:1,
    expression:'focus',face:{blink:0,browDown:.34,smirk:0,grit:.12,hurt:0,shout:0}};
  return blendEchoPoses(pose,pose,0);
};
const rows=[
  ['drawHit',0,.62,.20,
    authored('DRAW_COIL',{handL:[.20,1.08,.04],handR:[-.29,1.09,.04],torsoYaw:-.78,torsoPitch:.62,footL:[.15,.23,.37],footR:[-.18,.37,-.31],weaponPitch:-.25}),
    authored('DRAW_FLASH',{handL:[-.10,1.28,.72],handR:[.29,1.10,.20],torsoYaw:.62,torsoPitch:.26,weaponPitch:-1.42,weaponSweep:.10,footL:[.17,.18,.40],footR:[-.14,.28,-.29]}),
    authored('DRAW_FOLLOW',{handL:[.46,1.31,.35],handR:[-.40,1.37,.25],torsoYaw:1.22,torsoPitch:.35,weaponPitch:-1.13,footL:[.16,.29,.22],footR:[-.18,.16,-.34]})],
  ['lowCut',1,.46,.08,
    authored('DASH_LOW',{handL:[.38,1.24,.05],handR:[-.30,.88,.12],torsoYaw:.64,torsoPitch:.82,weaponPitch:-.28,footL:[.18,.20,.34],footR:[-.18,.35,-.25]}),
    authored('CUT_LOW',{handL:[.31,1.20,.26],handR:[.05,.86,.67],torsoYaw:-.61,torsoPitch:.68,weaponPitch:-1.31,weaponSweep:-.14,footL:[.21,.17,.34],footR:[-.16,.29,-.27]}),
    authored('LANDING',{handL:[.36,1.22,.17],handR:[-.43,.95,.32],torsoYaw:-1.15,torsoPitch:.75,weaponPitch:-.82,footL:[.16,.29,.37],footR:[-.18,.17,-.26]})],
  ['crossHit',0,.64,.85,
    authored('AIR_TUCK',{handL:[.22,1.78,.04],handR:[-.22,1.76,.06],torsoYaw:-.24,torsoPitch:.46,weaponPitch:-.12,footL:[.18,.65,.37],footR:[-.17,.48,-.22]}),
    authored('CROSS_CUT',{handL:[-.13,1.28,.73],handR:[.16,1.32,.69],torsoYaw:.35,torsoPitch:.28,weaponPitch:-1.37,weaponSweep:.20,footL:[.17,.28,.39],footR:[-.17,.43,-.28]}),
    authored('DRAW_FOLLOW',{handL:[.48,1.14,.24],handR:[-.48,1.22,.28],torsoYaw:.92,torsoPitch:.53,weaponPitch:-1.03,footL:[.17,.45,.23],footR:[-.19,.24,-.35]})],
  ['reverseCross',1,.60,.24,
    authored('DASH_RIGHT',{handL:[.38,1.30,.08],handR:[-.34,1.67,.09],torsoYaw:1.08,torsoLean:.24,weaponPitch:-.30,footL:[.18,.39,.30],footR:[-.16,.17,-.29]}),
    authored('CUT_RIGHT',{handL:[.27,1.12,.22],handR:[.09,1.22,.71],torsoYaw:-.78,torsoPitch:.30,torsoLean:-.10,weaponPitch:-1.35,weaponSweep:-.22,footL:[.16,.29,.38],footR:[-.18,.20,-.28]}),
    authored('SPIN_CUT',{handL:[.39,1.31,.18],handR:[-.47,1.16,.30],torsoYaw:-1.35,torsoLean:-.26,weaponPitch:-1.02,footL:[.18,.16,.28],footR:[-.16,.42,-.19]})],
  ['riseCut',0,.68,.12,
    authored('CUT_LOW',{handL:[.13,.90,.25],handR:[-.33,1.22,.18],torsoPitch:.75,torsoYaw:-.75,weaponPitch:-.55,footL:[.18,.22,.40],footR:[-.18,.26,-.29]}),
    authored('CUT_HIGH',{handL:[-.08,1.46,.66],handR:[-.29,1.16,.24],torsoYaw:.46,torsoPitch:-.13,weaponPitch:-1.12,weaponSweep:.16,footL:[.16,.32,.31],footR:[-.15,.22,-.29]}),
    authored('AIR_TUCK',{handL:[.28,1.86,.33],handR:[-.26,1.61,.29],torsoYaw:1.15,torsoPitch:-.24,weaponPitch:-.57,footL:[.16,.58,.27],footR:[-.16,.41,-.28]})],
  ['mirrorHit',1,.58,.32,
    authored('DASH_LEFT',{handL:[.41,1.47,.10],handR:[-.34,1.07,.11],torsoYaw:-.83,torsoPitch:.32,weaponPitch:-.36,footL:[.18,.18,.34],footR:[-.17,.36,-.31]}),
    authored('CUT_RIGHT',{handL:[.31,1.36,.28],handR:[.01,1.15,.77],torsoYaw:.12,torsoPitch:.44,weaponPitch:-1.50,weaponSweep:.07,footL:[.16,.33,.41],footR:[-.18,.23,-.26]}),
    authored('DASH_RIGHT',{handL:[.39,1.24,.18],handR:[-.35,1.31,.15],torsoYaw:.68,torsoPitch:.58,torsoLean:.25,weaponPitch:-.74,footL:[.19,.24,.24],footR:[-.17,.42,-.26]})],
  ['stormHit',1,.66,.95,
    authored('AIR_TUCK',{handL:[.29,1.78,.02],handR:[-.09,1.97,.13],torsoYaw:.57,torsoPitch:-.17,weaponPitch:-.12,footL:[.18,.63,.36],footR:[-.17,.51,-.22]}),
    authored('CUT_RIGHT',{handL:[.31,1.27,.27],handR:[.10,1.25,.69],torsoYaw:-.43,torsoPitch:.57,weaponPitch:-1.16,weaponSweep:-.19,footL:[.18,.36,.42],footR:[-.17,.45,-.21]}),
    authored('CUT_LOW',{handL:[.34,1.19,.20],handR:[-.35,.96,.40],torsoYaw:-1.02,torsoPitch:.91,weaponPitch:-.66,footL:[.19,.30,.30],footR:[-.18,.19,-.31]})],
  ['thousandHit',0,.62,.40,
    authored('GUARD_CROSS',{handL:[-.03,1.71,.25],handR:[.08,1.72,.29],torsoYaw:-.62,torsoPitch:.22,weaponPitch:-.46,footL:[.18,.26,.33],footR:[-.16,.36,-.32]}),
    authored('CROSS_CUT',{handL:[-.07,1.29,.76],handR:[.13,1.35,.72],torsoYaw:.18,torsoPitch:.38,weaponPitch:-1.43,weaponSweep:.28,footL:[.19,.22,.35],footR:[-.17,.35,-.27]}),
    authored('SPIN_CUT',{handL:[.43,1.31,.19],handR:[-.43,1.42,.27],torsoYaw:1.37,torsoPitch:.34,weaponPitch:-1.05,footL:[.16,.38,.25],footR:[-.17,.24,-.24]})],
];
export const REFLECTION_CONTACT_U=.43;
export const REFLECTION_REFERENCE_HEIGHT=2.10;
export const ECHO_REFLECTION_POSES=Object.freeze(rows.flatMap(([family,primaryBlade,targetHeightRatio,elevation,...poses],index)=>
  poses.map((pose,phase)=>Object.freeze({id:`${family}.${['pre','contact','follow'][phase]}`,family,index:index*3+phase,phase,pose}))));
export const ECHO_REFLECTION_FAMILIES=Object.freeze(rows.map(([id,primaryBlade,targetHeightRatio,elevation],index)=>Object.freeze({
  id,index,primaryBlade,contactFraction:.5,contactU:REFLECTION_CONTACT_U,targetHeightRatio,elevation,
  tangent:index%2?-.34:.34,entryRadius:3.25+(index%3)*.12,
  targetBone:['spine01','spine04','spine01','spine02','head','spine02','head','spine01'][index],
  surfaceOffset:.14,bladeAnchor:ECHO_REFLECTION_BLADE_ANCHORS[index],
})));

export function reflectionPoseBanks(index,progress){
  const family=((index%8)+8)%8,u=clamp(progress),contact=REFLECTION_CONTACT_U;
  const phase=u<contact?0:1,poseBankA=family*3+phase,poseBankB=poseBankA+1;
  const poseBlend=phase===0?smooth(.10,contact,u):smooth(.59,1,u);
  return {poseBankA,poseBankB,poseBlend,pose:blendEchoPoses(ECHO_REFLECTION_POSES[poseBankA].pose,ECHO_REFLECTION_POSES[poseBankB].pose,poseBlend)};
}
