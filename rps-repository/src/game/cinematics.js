import { fighterFor } from './fighters.js';
import { ATTACK_CATALOG, BOSS_SEQUENCES, sequenceFor } from './attackCatalog.js';
import { POSE_KEYS, ROOT_PATHS } from './poseKeys.js';
import { CAMERA_RIGS } from './cameraRigs.js';
export const ATTACKS = {
 rock:{name:'Faultline',finisher:'Citybreaker',color:'#83ffd6',moves:['Knuckle rush','Skyfall','Faultline']},
 paper:{name:'Phase bloom',finisher:'Zero horizon',color:'#d0bcff',moves:['Integral bloom','Gravity well','Ribbon snare']},
 scissors:{name:'Crossfade',finisher:'Last light',color:'#ffb35e',moves:['Crosscut','Ghost step','Rising crescent']},
};
const clamp=v=>Math.max(0,Math.min(1,v));
export const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const vec=(a,b,t)=>a.map((n,i)=>mix(n,b[i],t));
const ease=(t,kind)=>kind==='inQuint'?t**5:kind==='outCubic'?1-(1-t)**3:kind==='hold'?0:t*t*(3-2*t);
const DEFAULT={rock:'cinder',paper:'nyx',scissors:'echo'};
const extraContacts={
 'echo.rock.final':[[.37,'pommelHit'],[.49,'crossHit']],
 'echo.paper.final':[[.34,'mirrorHit'],[.46,'backCut'],[.56,'stormHit']],
 'echo.scissors.final':[[.37,'drawHit'],[.47,'crossHit'],[.57,'flurryHit']],
 'cinder.scissors.2':[[.35,'straightHit'],[.49,'hookHit']],
 'cinder.paper.final':[[.36,'bodyHit'],[.47,'palmHit'],[.57,'rushHit']],
 'cinder.scissors.final':[[.39,'bodyHit'],[.51,'upperHit']],
 'kuro.paper.2':[[.44,'sweepHit'],[.54,'turnHit']],
 'kuro.paper.final':[[.35,'sweepHit'],[.47,'turnHit'],[.59,'wheelHit']],
};
export function attackPresentation(weapon,finisher=false,reduced=false,variant=0,character=null,signature=null){
 const f=fighterFor(character||DEFAULT[weapon]);
 const s=BOSS_SEQUENCES.find(b=>b.id===signature)||sequenceFor(f.id,weapon,variant,finisher);
 return {finisher,reduced,variant:s.variant??variant%3,character:f.id,style:f.style,
  duration:reduced?(finisher?1700:1100):s.duration,impactAt:s.impact,revealAt:.025,
  sequenceId:s.id,title:s.title,color:f.color,vfx:s.vfx,reaction:s.reaction,
  hitStop:finisher?110:variant===2?85:45};
}
const descriptor=a=>[...ATTACK_CATALOG,...BOSS_SEQUENCES].find(s=>s.id===a.sequenceId)||sequenceFor(a.character||DEFAULT[a.playerWeapon||a.enemyWeapon||'scissors'],a.outcome==='loss'?a.enemyWeapon:a.playerWeapon||'scissors',a.variant||0,a.finisher);
function anatomicalPose(key,style){
 const idle={blades:[[.31,1.40,.27],[-.30,1.39,.27]],brawler:[[.23,1.56,.32],[-.23,1.56,.32]],mage:[[.30,1.20,.25],[-.25,1.39,.27]],archer:[[.30,1.4,.27],[-.22,1.44,.14]],glaive:[[.28,1.28,.34],[-.27,1.36,.32]]}[style];
 return key==='neutral'?{...POSE_KEYS.neutral,handL:idle[0],handR:idle[1]}:POSE_KEYS[key];
}
function interpolatePose(a,b,t){
 const result={};for(const k of Object.keys(a))result[k]=Array.isArray(a[k])?vec(a[k],b[k],t):mix(a[k],b[k],t);return result;
}
function actorPose(s,p,style,reduced){
 const heavy=s.final||s.variant===2,hit=s.impact;
 const nodes=[0,.13,heavy?.30:.27,hit-.018,hit,hit+.11,1];
 const keys=['neutral',s.wind,s.wind,s.contact,s.contact,s.contact,'neutral'];
 const roots=ROOT_PATHS[s.path],positions=[roots[0],roots[1],roots[2],roots[3],roots[3],roots[4],roots[0]];
 let segment=0;while(segment<nodes.length-2&&p>nodes[segment+1])segment++;
 const local=clamp((p-nodes[segment])/(nodes[segment+1]-nodes[segment]));
 // Hold anticipation, accelerate into the strike, then settle with a planted follow-through.
 const curves=['outCubic','inQuint','inQuint','hold','outCubic','smooth'];
 const t=ease(local,curves[segment]);
 let pose=interpolatePose(anatomicalPose(keys[segment],style),anatomicalPose(keys[segment+1],style),t);
 const root=vec(positions[segment],positions[segment+1],t);
 for(const [at,key]of extraContacts[s.id]||[]){
  const pulse=smooth(at-.045,at-.006,p)*(1-smooth(at+.007,at+.047,p));
  pose=interpolatePose(pose,POSE_KEYS[key],pulse);
 }
 const movement=p>.13&&p<hit-.045?Math.sin(Math.PI*clamp((p-.13)/(hit-.175))):0;
 const gait=Math.sin(p*Math.PI*(heavy?12:8))*movement;
 const ranged=style==='mage'||style==='archer';
 const planted=ranged?0:gait;
 return {...pose,x:root[0],y:root[1]*(reduced?.15:1),z:reduced?0:root[2],yaw:pose.torsoYaw*.08,
  footL:[.13,.12+Math.max(0,planted)*.12,.1+planted*.22],footR:[-.13,.12+Math.max(0,-planted)*.12,-.1-planted*.22],
  draw:style==='archer'?smooth(.025,.13,p)*(1-smooth(hit-.035,hit,p)):0,
  openHand:style==='mage'||(style==='brawler'&&s.contact.includes('palm')),
  headPitch:-.035*smooth(.025,.13,p),armL:-.55,armR:-.55,elbowL:-.9,elbowR:-.9,legL:planted,legR:-planted,roll:0};
}
function shot(s,a,p,actor){
 const base={camera:[0,3,10.8],target:[0,1.55,0],fov:36,roll:0,shot:'arena'};
 if(a.reduced||a.outcome==='draw'||p<.025||p>=.98)return base;
 const r=CAMERA_RIGS[s.camera],sign=a.outcome==='loss'?-1:1;
 const ax=sign*(-2.1+actor.x),dx=sign*2.1,scale=a.actorScale||1;
 if(p<.24)return{camera:[ax+sign*r[0],r[1]+actor.y+(scale-1)*1.1,r[2]],target:[ax,2.1*scale+actor.y,.1],fov:r[9],roll:0,shot:'anticipation'};
 if(p<s.impact-.025){
  const orbit=r[5]*Math.sin(Math.PI*smooth(.24,s.impact,p)),mid=(ax+dx)*.5;
  return{camera:[mid+Math.sin(orbit)*r[4]*sign,r[3]+actor.y*.25,Math.cos(orbit)*r[4]],target:[mid,1.5*scale+actor.y*.3,0],fov:r[9]+3,roll:r[10]*sign,shot:'approach'};
 }
 if(p<s.impact+.11)return{camera:[dx+sign*r[6],r[7]+(a.targetScale||1)-1,r[8]],target:[dx-sign*.35,1.48*(a.targetScale||1),0],fov:r[9],roll:r[10]*sign,shot:'impact'};
 const t=smooth(s.impact+.11,.98,p);
 return{camera:vec([dx+sign*r[6],r[7]+.3,r[8]+1],base.camera,t),target:vec([dx-sign*.35,a.finalHit?.9:1.55,0],base.target,t),fov:mix(r[9],36,t),roll:r[10]*(1-t)*sign,shot:'recovery'};
}
function reactionPose(type,p,hit,final,finalHit,brace){
 const release=smooth(hit+.025,hit+.22,p),settle=1-smooth(hit+.25,1,p);
 const energy=Math.sin(Math.PI*smooth(hit,hit+.25,p));
 const collapse=final&&finalHit?smooth(hit+.11,.94,p):0;
 const weight=brace?.28:final?1.3:.7;
 const r={x:release*.3*settle*weight,y:0,z:0,roll:0,torsoYaw:0,torsoPitch:-.5*energy*weight,headPitch:-.2*energy,
  handL:[.4,1.40+energy*.2,.22],handR:[-.4,1.40+energy*.2,.22],footL:[.13,.12,.12],footR:[-.13,.12,-.12]};
 if(type==='trip'){r.y=-.4*energy*weight;r.roll=-.4*energy*weight;r.handR=[-.3,1.2,.55];}
 if(type==='launch'){r.y=Math.sin(Math.PI*smooth(hit,hit+.32,p))*1.1*weight;r.x=release*.55*weight;r.torsoPitch=-.7*energy;}
 if(type==='slam'){r.y=-.45*energy*weight;r.torsoPitch=.65*energy;r.handL=[.2,1.05,.3];}
 if(type==='spin'){r.torsoYaw=release*Math.PI*1.6*settle*weight;r.z=Math.sin(release*Math.PI)*.3*weight;}
 if(type==='guardBreak'){r.handL=[.55,1.9,.05];r.handR=[-.55,1.9,.05];r.torsoPitch=-.9*energy*weight;}
 if(type==='wallBounce'){r.x=Math.sin(release*Math.PI*.8)*1.0*weight;r.y=.1*energy;r.roll=-.15*energy;}
 r.y-=.92*collapse;r.roll-=1.35*collapse;return{defender:r,collapse,release};
}
export function cinematicFrame(animation,seconds){
 const s=descriptor(animation),p=clamp(seconds/(animation.duration/1000)),hit=animation.impactAt??s.impact;
 const stop=(animation.hitStop||45)/animation.duration;
 // Freeze only the physical pose; damage, audio and UI continue on the public timeline.
 const physical=p+1e-9>=hit&&p<hit+stop?hit:p>=hit+stop?hit+(p-hit-stop)*(1-hit)/(1-hit-stop):p;
 const style=animation.style||fighterFor(s.character).style;
 const attacker=actorPose(s,physical,style,animation.reduced);
 const impact=Math.max(0,1-Math.abs(p-hit)/.035),returnHome=smooth(hit+.11,1,p);
 const secondaryImpact=(extraContacts[s.id]||[]).reduce((v,[at])=>Math.max(v,Math.max(0,1-Math.abs(p-at)/.014)),0);
 const reactions=reactionPose(s.reaction,physical,hit,animation.finisher,animation.finalHit,animation.braced);
 if(animation.avoided){const dodge=smooth(hit-.18,hit-.035,p)*(1-smooth(hit+.15,.95,p));reactions.defender.z=dodge*.85;reactions.defender.torsoPitch=.4*dodge;reactions.defender.x=.35*dodge;}
 if(animation.braced&&!animation.avoided){reactions.defender.handL=[.13,1.72,.38];reactions.defender.handR=[-.13,1.72,.4];}
 if(animation.defeatedBoss&&reactions.collapse){const c=reactions.collapse,b=animation.defeatedBoss;
  if(b==='rail'){reactions.defender.roll=-.20*c;reactions.defender.y=-.6*c;reactions.defender.torsoPitch=.5*c;}
  if(b==='kiln'){reactions.defender.roll=.25*c;reactions.defender.y=-.8*c;reactions.defender.torsoPitch=.7*c;}
  if(b==='prism'){reactions.defender.roll=-.8*c;reactions.defender.torsoYaw=c*2.5;reactions.defender.y=-.45*c;}
  if(b==='lantern'){reactions.defender.roll=.55*c;reactions.defender.y=-.6*c;reactions.defender.torsoPitch=-.4*c;}
  if(b==='root'){reactions.defender.roll=0;reactions.defender.y=-.72*c;reactions.defender.torsoPitch=.65*c;}
  if(b==='tide'){reactions.defender.roll=-1.55*c;reactions.defender.y=-1.05*c;reactions.defender.z=-.35*c;}
 }
 return{progress:p,weapon:animation.outcome==='loss'?animation.enemyWeapon:animation.playerWeapon||s.weapon,
  attacker,...shot(s,animation,p,attacker),...reactions,lunge:clamp(attacker.x/4.9),impact:animation.avoided?0:impact,secondaryImpact,returnHome,
  windup:smooth(.025,.13,p)*(1-smooth(hit-.1,hit,p)),contact:smooth(hit-.1,hit,p),revealed:p>=.025,
  shock:smooth(hit,hit+.22,p)*(1-smooth(hit+.22,.99,p)),vfx:s.vfx,reaction:s.reaction,
  activeBeats:(s.beats||[]).filter(b=>Math.abs(p-b.at)<.025).map(b=>b.id),hitStopped:p+1e-9>=hit&&p<hit+stop};
}
