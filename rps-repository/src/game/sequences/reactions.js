import {clamp,smooth} from './math.js';
const base=()=>({x:0,y:0,z:0,yaw:0,roll:0,torsoPitch:0,torsoYaw:0,torsoLean:0,headPitch:0,headYaw:0,handL:[.31,1.40,.27],handR:[-.31,1.39,.27],footL:[.14,.11,.14],footR:[-.14,.11,-.14],expression:'calm',face:{hurt:0,grit:0,blink:0},opacity:1,stretch:[1,1,1]});
export const REACTIONS=Object.freeze(['FLINCH','STAGGER','DOUBLE-OVER','SKID','TRIP','LAUNCH','SLAM','SPIN-OUT','GUARD-BREAK','WALL-BOUNCE','PIN','FREEZE','CRUMPLE','KNEEL']);
export function reactionPose(name,age,strength=1,options={}) {
  const p=base();
  if(age<0)return p;
  const kick=1-smooth(.05,.38,age),settle=1-smooth(.35,1.10,age),travel=smooth(0,.38,age)*settle;
  const force=Math.min(1.15,strength)*(options.braced?.25:1);
  p.expression='hurt';p.face={hurt:.80*kick,grit:.60*kick,blink:.30*kick};p.headPitch=-.2*kick*force;
  if(name==='FLINCH'){p.torsoPitch=-.27*kick*force;p.torsoYaw=.14*kick*force;p.x=.08*travel*force;}
  if(name==='STAGGER'){p.torsoPitch=-.63*kick*force;p.x=.43*travel*force;p.footL=[.14,.11,.16-.16*travel];p.footR=[-.17,.16,.30*travel-.15];p.handL=[.43,1.65,.14];p.handR=[-.39,1.59,.19];}
  if(name==='DOUBLE-OVER'){p.torsoPitch=.88*kick*force;p.y=-.18*kick*force;p.handL=[.20,1.04,.42];p.handR=[-.22,1.03,.45];p.headPitch=.22*kick;}
  if(name==='SKID'){p.x=.95*travel*force;p.torsoPitch=-.45*kick*force;p.footL=[.14,.11,.35];p.footR=[-.15,.11,-.41];p.handL=[.37,1.58,.16];p.handR=[-.36,1.6,.16];}
  if(name==='TRIP'){p.y=-.35*kick*force;p.roll=-.49*kick*force;p.torsoPitch=-.45*kick*force;p.footL=[.19,.38,.49];p.footR=[-.17,.41,-.06];p.handL=[.43,1.61,.16];p.handR=[-.44,1.6,.2];}
  if(name==='LAUNCH'){p.y=Math.sin(Math.PI*smooth(0,.78,age))*Math.min(options.tier===2?.5:2.8,2.1*force);p.x=.7*travel*force;p.roll=-.28*kick;p.torsoPitch=-.65*kick;p.footL=[.15,.42,.18];p.footR=[-.15,.58,-.12];}
  if(name==='SLAM'){p.y=-.38*kick*force;p.torsoPitch=.86*kick*force;p.handL=[.29,1.02,.53];p.handR=[-.29,1.03,.5];p.footL=[.18,.27,.32];p.footR=[-.19,.18,-.22];}
  if(name==='SPIN-OUT'){p.torsoYaw=1.6*travel*force;p.yaw=1.1*travel*force;p.x=.3*travel*force;p.z=.32*Math.sin(travel*Math.PI)*force;p.roll=-.12*kick;}
  if(name==='GUARD-BREAK'){p.handL=[.52,1.90,.13];p.handR=[-.50,1.91,.13];p.torsoPitch=-.85*kick*force;p.x=.25*travel*force;}
  if(name==='WALL-BOUNCE'){p.x=.92*Math.sin(Math.PI*smooth(0,.78,age))*force;p.torsoPitch=-.68*kick*force;p.roll=-.15*kick;p.z=-.14*travel;}
  if(name==='PIN'){p.handL=[.48,1.55,.10];p.handR=[-.48,1.55,.10];p.torsoPitch=-.18;p.face.grit=.6;p.footL=[.21,.11,.23];p.footR=[-.22,.11,-.23];}
  if(name==='FREEZE'){p.torsoPitch=-.28;p.torsoYaw=.14;p.handL=[.40,1.68,.21];p.handR=[-.40,1.62,.17];p.face={hurt:.8,grit:.7,blink:.1};}
  if(name==='CRUMPLE'){const c=smooth(.04,.78,age);p.y=-.78*c;p.torsoPitch=.82*c-.33*kick;p.headPitch=.3*c;p.handL=[.26,1.10,.44];p.handR=[-.24,1.12,.42];p.footL=[.17,.49,.21];p.footR=[-.17,.15,-.27];p.face.hurt=.60;}
  if(name==='KNEEL'){const c=clamp(age/.35);p.y=-.76*c;p.torsoPitch=.44*c;p.headPitch=.31*c;p.handL=[.27,1.10,.40];p.handR=[-.27,1.09,.39];p.footL=[.16,.43,.25];p.footR=[-.16,.14,-.3];p.face.hurt=.55;}
  if(options.braced){p.handL=[-.05,1.70,.43];p.handR=[.08,1.68,.45];p.torsoPitch=.13*force;p.expression='grit';p.face={grit:.6*kick,browDown:.6};}
  return p;
}
