// Wrist and foot targets are metres in the skinned model's space. Every pose
// includes the complete body, face, blade grip and foot-lock state.
import {blendValue,quaternion,slerp} from '../math.js';
const neutral = {
  handL:[.28,1.39,.24],handR:[-.29,1.37,.23],footL:[.14,.11,.14],footR:[-.14,.11,-.14],
  torsoPitch:0,torsoYaw:0,torsoLean:0,headPitch:0,headYaw:0,weaponPitch:.15,weaponSweep:0,
  roll:0,draw:0,openHand:false,grip:'reverse',bladeState:'drawn',drawProgress:1,
  expression:'calm',face:{blink:0,browUp:0,browDown:0,smirk:.05,grit:0,hurt:0,shout:0},footLock:[1,1],opacity:1,
};
const pose = (data) => ({...neutral,...data,face:{...neutral.face,...data.face}});
export const ECHO_POSES = Object.freeze({
  ECHO_IDLE:pose({}),
  SHEATH_GUARD:pose({handL:[.29,1.03,.08],handR:[-.30,1.02,.07],torsoYaw:-.08,bladeState:'sheathed',drawProgress:0}),
  EYES_LOCK:pose({handL:[.29,1.03,.08],handR:[-.30,1.02,.07],torsoYaw:-.12,headYaw:0,headPitch:-.06,bladeState:'sheathed',drawProgress:0,expression:'focus',face:{blink:0,browDown:.75,smirk:.02}}),
  DRAW_COIL:pose({handL:[.23,1.04,.04],handR:[-.29,1.08,.01],torsoPitch:.92,torsoYaw:-.90,torsoLean:-.16,headPitch:-.15,headYaw:.22,footL:[.19,.11,.36],footR:[-.20,.11,-.36],bladeState:'sheathed',drawProgress:0,face:{blink:0,browDown:.82,grit:.15}}),
  DRAW_FLASH:pose({handL:[-.10,1.44,.68],handR:[.13,1.48,.67],torsoYaw:.88,torsoPitch:.19,weaponSweep:1.48,weaponPitch:.15,footL:[.13,.11,.48],footR:[-.12,.25,-.39],bladeState:'drawing',drawProgress:1,face:{browDown:.70},footLock:[1,0]}),
  DRAW_FOLLOW:pose({handL:[.47,1.28,.23],handR:[-.46,1.43,.28],torsoYaw:1.15,torsoPitch:.17,weaponSweep:2.4,footL:[.12,.11,.32],footR:[-.15,.11,-.38],face:{browDown:.50}}),
  RESHEATH:pose({handL:[.27,1.12,.12],handR:[-.27,1.13,.10],torsoYaw:.42,headYaw:-.35,weaponPitch:-.35,bladeState:'drawing',drawProgress:.20,face:{smirk:.28}}),
  SHEATH_CLICK:pose({handL:[.29,1.02,.06],handR:[-.30,1.02,.08],torsoYaw:.10,headYaw:-.55,bladeState:'sheathed',drawProgress:0,expression:'smirk',face:{smirk:.48}}),
  DASH_LOAD:pose({handL:[.35,1.17,.02],handR:[-.34,1.29,-.07],torsoPitch:.80,torsoYaw:-.48,headPitch:-.12,footL:[.16,.11,.30],footR:[-.17,.11,-.39],face:{blink:0,browDown:.75}}),
  DASH_LOW:pose({handL:[.38,1.10,.02],handR:[-.35,1.12,.05],torsoPitch:.63,torsoYaw:.14,footL:[.14,.20,.25],footR:[-.14,.34,-.31],footLock:[0,0],face:{browDown:.65}}),
  DASH_LEFT:pose({handL:[.43,1.61,.10],handR:[-.38,1.20,.13],torsoYaw:-.95,torsoLean:-.35,footL:[.15,.11,.23],footR:[-.17,.29,-.28],footLock:[1,0],face:{browDown:.6}}),
  DASH_RIGHT:pose({handL:[.40,1.20,.11],handR:[-.43,1.63,.08],torsoYaw:.93,torsoLean:.30,footL:[.15,.27,.30],footR:[-.14,.11,-.24],footLock:[0,1],face:{browDown:.6}}),
  CUT_LEFT:pose({handL:[-.08,1.52,.66],handR:[-.33,1.19,.26],torsoYaw:1.07,torsoPitch:.22,weaponSweep:1.58,footL:[.14,.11,.43],footR:[-.15,.13,-.30],face:{browDown:.7,grit:.22}}),
  CUT_RIGHT:pose({handL:[.31,1.25,.27],handR:[.08,1.61,.67],torsoYaw:-1.02,torsoPitch:.19,weaponSweep:-1.55,footL:[.14,.16,.27],footR:[-.14,.11,-.36],face:{browDown:.7,grit:.22}}),
  CUT_HIGH:pose({handL:[.09,1.91,.55],handR:[-.12,1.70,.57],torsoYaw:.53,torsoPitch:-.20,weaponPitch:-.90,weaponSweep:.48,footL:[.14,.23,.19],footR:[-.14,.11,-.27],face:{browDown:.68}}),
  CUT_LOW:pose({handL:[.10,.97,.60],handR:[-.11,1.12,.59],torsoYaw:.88,torsoPitch:.79,weaponPitch:.72,weaponSweep:1.12,footL:[.18,.11,.35],footR:[-.16,.11,-.25],face:{browDown:.70}}),
  CROSS_CUT:pose({handL:[-.10,1.51,.68],handR:[.11,1.52,.66],torsoYaw:.48,torsoPitch:.13,weaponPitch:.33,weaponSweep:1.47,footL:[.17,.11,.27],footR:[-.16,.11,-.28],face:{browDown:.82,grit:.3}}),
  SPIN_CUT:pose({handL:[.45,1.42,.04],handR:[-.46,1.45,.06],torsoYaw:1.45,torsoLean:.17,weaponSweep:2.5,footL:[.12,.21,.15],footR:[-.13,.11,-.18],footLock:[0,1],face:{browDown:.6}}),
  AIR_TUCK:pose({handL:[.37,1.85,.13],handR:[-.32,1.73,.19],torsoPitch:.25,torsoYaw:-.50,footL:[.14,.63,.27],footR:[-.14,.44,-.24],footLock:[0,0],face:{browDown:.55}}),
  LANDING:pose({handL:[.32,1.13,.24],handR:[-.29,1.12,.26],torsoPitch:.56,torsoYaw:.25,footL:[.18,.11,.33],footR:[-.19,.11,-.20],face:{browDown:.45}}),
  GUARD_CROSS:pose({handL:[-.05,1.70,.43],handR:[.08,1.68,.45],torsoYaw:.14,torsoPitch:.10,weaponPitch:.52,weaponSweep:.80,footL:[.15,.11,.21],footR:[-.16,.11,-.27],face:{browDown:.50,grit:.2}}),
  HURT_HIGH:pose({handL:[.42,1.79,.24],handR:[-.40,1.78,.22],torsoPitch:-.67,torsoYaw:.30,headPitch:-.28,footL:[.14,.11,.12],footR:[-.15,.14,-.30],expression:'hurt',face:{hurt:.85,grit:.35,blink:.35}}),
  KNEEL:pose({handL:[.31,1.09,.40],handR:[-.31,1.05,.37],torsoPitch:.63,headPitch:.34,footL:[.18,.45,.20],footR:[-.15,.14,-.32],footLock:[0,1],expression:'hurt',face:{hurt:.5,browDown:.4}}),
  AFTERLIGHT_KNEEL:pose({handL:[.28,1.02,.09],handR:[-.29,1.03,.08],torsoPitch:.60,torsoYaw:-.1,headPitch:.23,footL:[.19,.11,.43],footR:[-.17,.11,-.26],footLock:[1,1],bladeState:'sheathed',drawProgress:0,expression:'calm',face:{blink:0,browDown:.12,smirk:.02}}),
  AFTERLIGHT_RISE:pose({handL:[.29,1.04,.10],handR:[-.30,1.05,.08],torsoPitch:.32,headPitch:.10,footL:[.17,.11,.31],footR:[-.16,.11,-.24],footLock:[1,1],bladeState:'sheathed',drawProgress:0,expression:'calm',face:{blink:0,browDown:.08,grit:0,hurt:0,shout:0}}),
  AFTERLIGHT_EYE_LOCK:pose({handL:[.29,1.03,.08],handR:[-.30,1.02,.07],torsoYaw:-.08,headYaw:-.34,headPitch:-.015,bladeState:'sheathed',drawProgress:0,expression:'calm',face:{blink:0,browDown:.10,smirk:.04,grit:0,hurt:0,shout:0}}),
  AFTERLIGHT_STILL:pose({handL:[.29,1.04,.08],handR:[-.28,1.05,.08],torsoYaw:.08,headPitch:-.04,bladeState:'sheathed',drawProgress:0,expression:'calm',face:{blink:0,browDown:.12,smirk:.08,grit:0,hurt:0,shout:0}}),
  AFTERLIGHT_TURN:pose({handL:[.28,1.01,.08],handR:[-.29,1.02,.09],torsoYaw:-.10,headYaw:-.68,bladeState:'sheathed',drawProgress:0,expression:'smirk',face:{smirk:.65,browDown:.1}}),
  WIN_BACK:pose({handL:[.28,1.03,.08],handR:[-.29,1.04,.07],headYaw:-.18,bladeState:'sheathed',drawProgress:0,face:{smirk:.30}}),
});
export function echoPose(name) {
  const p=ECHO_POSES[name];
  if(!p) throw new Error(`Unknown Echo pose: ${name}`);
  return structuredClone(p);
}
export function blendEchoPoses(a,b,t) {
  const left=typeof a==='string'?echoPose(a):a,right=typeof b==='string'?echoPose(b):b;
  const result=blendValue(left,right,t);
  result.boneQuaternions={
    spine01:slerp(quaternion(0,left.torsoYaw*.55,left.torsoLean*.3),quaternion(0,right.torsoYaw*.55,right.torsoLean*.3),t),
    spine02:slerp(quaternion(left.torsoPitch*.35),quaternion(right.torsoPitch*.35),t),
    head:slerp(quaternion(left.headPitch,left.headYaw),quaternion(right.headPitch,right.headYaw),t),
  };
  return result;
}
