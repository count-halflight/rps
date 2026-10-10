import { fighterFor } from './fighters.js';
import { ATTACK_CATALOG, BOSS_SEQUENCES, FINISHER_STAGING, NORMAL_CONTACTS, sequenceFor } from './attackCatalog.js';
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
// QTE input is resolved by the controller using the same startedAt clock as the
// arena. Failed prompts alter the stunt branch, never reverse an earned RPS win.
export function cinematicCue(sequenceId){
 const final=FINISHER_STAGING[sequenceId];
 if(final)return final.cues.map(c=>({...c}));
 const s=ATTACK_CATALOG.find(a=>a.id===sequenceId);if(!s)return [];
 const labels={echo:{rock:['Break the guard','Sweep the legs','Cross the blades'],paper:['Sell the feint','Step through','Keep the storm turning'],scissors:['Draw clean','Catch the rise','Keep them airborne']},cinder:{rock:['Drive the fist','Find the opening','Bring it down'],paper:['Push through','Drive the shoulder','Break the ground'],scissors:['Turn the hook','Lift the target','Keep the punches coming']},nyx:{rock:['Aim the prism','Close the crystal trap','Shatter the shell'],paper:['Ride the wave','Add the next slice','Tighten the well'],scissors:['Split the beam','Guide the orbit','Cut the horizon']},vex:{rock:['Hold the aim','Pierce the guard','Mark the landing'],paper:['Spread the volley','Follow the bounce','Split the arrows'],scissors:['Release on time','Find the landing','Draw the stars']},kuro:{rock:['Drive the point','Land the vault','Split the sky'],paper:['Sweep low','Follow the turn','Keep the wheel spinning'],scissors:['Cleave through','Catch the rise','Close the gate']}};
 const index=['echo','cinder','nyx','vex','kuro'].indexOf(s.character)+['rock','paper','scissors'].indexOf(s.weapon)+s.variant;
 return [{id:'contact',key:String(index%3+1),at:s.variant===2?.15:.075,end:Math.min(s.impact-.07,s.variant===2?.49:.45),label:labels[s.character][s.weapon][s.variant]}];
}
export function attackPresentation(weapon,finisher=false,reduced=false,variant=0,character=null,signature=null,finisherIndex=0){
 const f=fighterFor(character||DEFAULT[weapon]);
 const s=BOSS_SEQUENCES.find(b=>b.id===signature)||sequenceFor(f.id,weapon,variant,finisher,finisherIndex);
 return {finisher,reduced,variant:s.variant??variant%3,character:f.id,style:f.style,
  duration:reduced?(finisher?1700:1100):s.duration,impactAt:s.impact,revealAt:.025,
  sequenceId:s.id,title:s.title,color:f.color,vfx:s.vfx,reaction:s.reaction,finisherIndex:s.finisherIndex||0,
  hitStop:finisher?110:variant===2?85:45,contacts:s.contacts||[],spectacle:s.staging?.kind||null,qteCues:reduced?[]:cinematicCue(s.id)};
}
const descriptor=a=>[...ATTACK_CATALOG,...BOSS_SEQUENCES].find(s=>s.id===a.sequenceId)||sequenceFor(a.character||DEFAULT[a.playerWeapon||a.enemyWeapon||'scissors'],a.outcome==='loss'?a.enemyWeapon:a.playerWeapon||'scissors',a.variant||0,a.finisher);
function presentationSuccess(animation,seconds){
 const settled=(animation.qte||[]).filter(c=>c.status!=='pending').sort((a,b)=>a.resolvedAt-b.resolvedAt);
 if(!settled.length)return clamp(animation.qteSuccess??1);
 const last=settled.at(-1),previous=settled.slice(0,-1);
 const before=previous.length?previous.filter(c=>c.status==='hit').length/previous.length:1;
 const after=settled.filter(c=>c.status==='hit').length/settled.length;
 return mix(before,after,smooth(last.resolvedAt,last.resolvedAt+150,seconds*1000));
}
function anatomicalPose(key,style){
 const idle={blades:[[.31,1.40,.27],[-.30,1.39,.27]],brawler:[[.23,1.56,.32],[-.23,1.56,.32]],mage:[[.30,1.20,.25],[-.25,1.39,.27]],archer:[[.30,1.4,.27],[-.22,1.44,.14]],glaive:[[.28,1.28,.34],[-.27,1.36,.32]]}[style];
 return key==='neutral'?{...POSE_KEYS.neutral,handL:idle[0],handR:idle[1]}:POSE_KEYS[key];
}
function interpolatePose(a,b,t){
 const result={};for(const k of Object.keys(a))result[k]=Array.isArray(a[k])?vec(a[k],b[k],t):mix(a[k],b[k],t);return result;
}
function sampleNodes(nodes,p){
 let i=0;while(i<nodes.length-2&&p>nodes[i+1].at)i++;
 const a=nodes[i],b=nodes[i+1],t=ease(clamp((p-a.at)/Math.max(.0001,b.at-a.at)),b.ease||'smooth');
 return{a,b,t};
}
function stagedVictim(s,p){
 const points=s.staging?.victim;
 if(!points)return null;
 const nodes=[{at:0,x:0,y:0,z:0},...points],{a,b,t}=sampleNodes(nodes,p);
 return{x:mix(a.x,b.x,t),y:mix(a.y,b.y,t),z:mix(a.z,b.z,t),roll:mix(a.roll||0,b.roll||0,t),
  stretch:vec(a.stretch||[1,1,1],b.stretch||[1,1,1],t)};
}
function comboNodes(s){
 const roots=ROOT_PATHS[s.path],contacts=s.contacts||[];
 if(s.staging)return[{at:0,pose:'neutral',root:roots[0]},{at:.13,pose:s.wind,root:roots[1]},...s.staging.actor,{at:1,pose:'neutral',root:roots[0]}];
 if(!contacts.length)return null;
 const ranged=['nyx','vex'].includes(s.character),points=[{at:0,pose:'neutral',root:roots[0]},{at:.13,pose:s.wind,root:roots[1]}];
 contacts.forEach(([at,pose],i)=>{
  // A safe follow-up holds the line. Heavy combinations actually change sides
  // instead of shaking the arms while both characters slide toward each other.
  const side=(i%2?1:-1)*(s.variant===2?.75:.35),r=ranged?[roots[3][0]-.12*i,roots[2][1]*(i+1)/contacts.length,roots[2][2]+side*.6]:[roots[3][0]+(i%2?.45:-.1),Math.max(0,roots[3][1])+(pose.includes('upper')||pose.includes('rise')?.36:0),side];
  if(i===0)points.push({at:at-.075,pose:s.wind,root:roots[2],ease:'inQuint'});
  points.push({at,pose,root:r,ease:'outCubic'});
  if(at+.035<s.impact-.018)points.push({at:at+.035,pose:s.wind,root:[r[0]-.18,r[1]*.8,r[2]*1.15]});
 });
 points.push({at:s.impact-.018,pose:s.contact,root:roots[3],ease:'inQuint'},{at:s.impact,pose:s.contact,root:roots[3]},
  {at:s.impact+.11,pose:s.contact,root:roots[4]},{at:1,pose:'neutral',root:roots[0]});
 return points.sort((a,b)=>a.at-b.at);
}
function actorPose(s,p,style,reduced){
 const heavy=s.final||s.variant===2,hit=s.impact,roots=ROOT_PATHS[s.path];
 const authored=!reduced?comboNodes(s):null;
 const nodes=authored||[
  {at:0,pose:'neutral',root:roots[0]},{at:.13,pose:s.wind,root:roots[1]},
  {at:heavy?.30:.27,pose:s.wind,root:roots[2],ease:'inQuint'},
  {at:hit-.018,pose:s.contact,root:roots[3],ease:'inQuint'},
  {at:hit,pose:s.contact,root:roots[3],ease:'hold'},
  {at:hit+.11,pose:s.contact,root:roots[4],ease:'outCubic'},{at:1,pose:'neutral',root:roots[0]}];
 const {a,b,t}=sampleNodes(nodes,p);
 let pose=interpolatePose(anatomicalPose(a.pose,style),anatomicalPose(b.pose,style),t);
 let root=vec(a.root,b.root,t);
 for(const [at,key]of s.contacts||[]){
  const pulse=smooth(at-.035,at-.005,p)*(1-smooth(at+.007,at+.035,p));
  pose=interpolatePose(pose,POSE_KEYS[key],pulse);
 }
 const movement=p>.13&&p<hit-.045?Math.sin(Math.PI*clamp((p-.13)/(hit-.175))):0;
 const gait=Math.sin(p*Math.PI*(heavy?12:8))*movement;
 const ranged=style==='mage'||style==='archer',planted=ranged?0:gait;
 const kick=mix(a.kick||0,b.kick||0,t),air=!reduced&&root[1]>1.2;
 const target=stagedVictim(s,p);
 const yaw=authored&&!ranged?-Math.atan2((target?.z||0)-root[2],4.2+(target?.x||0)-root[0]):pose.torsoYaw*.08;
 if(reduced){root=[root[0],root[1]*.10,0];}
 let footL=[.13,.12+Math.max(0,planted)*.12,.1+planted*.22],footR=[-.13,.12+Math.max(0,-planted)*.12,-.1-planted*.22];
 if(air){footL=[.13,.35,-.25];footR=[-.13,.55,.2];}
 if(kick>.01){footL=vec(footL,[.2,1.08,.83],kick);footR=vec(footR,[-.16,.32,-.25],kick);}
 return {...pose,x:root[0],y:root[1],z:root[2],yaw,footL,footR,
  draw:style==='archer'?smooth(.025,.13,p)*(1-smooth(hit-.035,hit,p)):0,
  openHand:style==='mage'||(style==='brawler'&&(s.contact.includes('palm')||s.staging?.kind==='inferno')),
  headPitch:-.035*smooth(.025,.13,p),armL:-.55,armR:-.55,elbowL:-.9,elbowR:-.9,legL:planted,legR:-planted,
  roll:mix(a.roll||0,b.roll||0,t)+(s.path==='backflip'&&!reduced?-Math.PI*1.25*Math.sin(Math.PI*smooth(.16,hit,p)):0)};
}
function directedFinisherShot(s,a,p,actor,defender,base){
 const sign=a.outcome==='loss'?-1:1,scale=a.actorScale||1,targetScale=a.targetScale||1;
 const ax=sign*(-2.1+actor.x),dx=sign*(2.1+defender.x),center=[(ax+dx)*.5,(actor.y+defender.y)*.5+1.45*Math.max(scale,targetScale),((actor.z||0)+(defender.z||0))*.5];
 const hit=a.impactAt??s.impact,kind=s.staging.kind;
 if(p+1e-9>=.9){const t=smooth(.90,1,p);return{camera:vec([dx+sign*1.2,2.1,7.8],base.camera,t),target:vec([dx-sign*.4,a.finalHit?.9:1.55,0],base.target,t),fov:mix(45,36,t),roll:0,shot:'recovery'};}
 if(p>=hit-.018){
  const ground=['orbital','crater','thunder','rift'].includes(kind);
  return{camera:[dx+sign*(ground?2.1:1.25),ground?.72:2.5,ground?6.2:6.8],target:[dx-sign*.45,ground?.6:1.5*targetScale,0],fov:ground?51:45,roll:sign*(ground?.055:-.025),shot:'impact'};
 }
 let side=sign*(Math.sin(p*Math.PI*4)*2.1),height=2.2,distance=8.4,roll=0,fov=46;
 let target=center;
 if(kind==='orbital'){
  if(p<.40){side=sign*1.8;height=1.2;distance=8.0;fov=53;}
  else if(p<.69){side=sign*(p<.48?3.1:p<.57?3.3:2.2);height=1.1;distance=8.5;roll=sign*(p<.48?-.06:.07);fov=52;}
  else{side=sign*-1.2;height=-2.0;distance=mix(12.5,7.0,smooth(.69,hit,p));target=[dx,defender.y+1.2*targetScale,defender.z];roll=sign*.06;fov=58;}
 }else if(kind==='singularity'){
  side=sign*Math.sin(smooth(.27,.78,p)*Math.PI*1.1)*4.6;height=1.3;distance=10.0;
  const stretched=defender.stretch?.[1]||1;
  target=[sign*1.0,Math.max(3.4,defender.y+1.25*targetScale*stretched),-1.0];
  height=1.0;distance=10.0+(stretched-1)*1.4;center[1]=target[1]-.7;roll=-sign*.08;fov=49;
 }else if(kind==='turbine'){
  side=sign*Math.sin(p*Math.PI*6)*3.4;height=p<.5?.7:2.7;distance=9.2;roll=sign*Math.sin(p*Math.PI*5)*.065;fov=52;
 }else if(kind==='mirror'){
  side=sign*(p<.41?-2.4:p<.57?3.3:-2.8);height=p<.57?1.0:3.0;distance=8.0;roll=sign*(p<.57?.035:-.035);
 }else if(kind==='blade-storm'){
  side=sign*Math.sin(p*Math.PI*8)*2.4;height=.75+Math.cos(p*Math.PI*6)*.6;distance=7.6;roll=sign*Math.sin(p*Math.PI*8)*.07;fov=49;
 }else if(kind==='integral'){
  side=sign*mix(1.7,-2.0,smooth(.30,.75,p));height=3.0;distance=10.0;fov=48;
 }else if(kind==='prism'){
  side=sign*Math.cos(p*Math.PI*3)*3.0;height=2.7;distance=9.8;roll=sign*.025;
 }else if(kind==='eclipse'){
  side=sign*Math.sin(p*Math.PI*2)*3.7;height=-.7;distance=11.2;fov=54;roll=-sign*.04;
 }else if(kind==='constellation'){
  side=sign*(p<.46?-3.3:3.1);height=3.4;distance=10.3;fov=50;
 }else if(kind==='meteor'){
  side=sign*Math.cos(p*Math.PI*2)*2.4;height=p<.55?4.0:.45;distance=10.1;fov=53;
 }else if(kind==='rift'){
  side=sign*Math.sin(p*Math.PI*4)*4.0;height=p<.63?-.4:2.1;distance=10.5;roll=sign*.06;fov=52;
 }else if(kind==='thunder'){
  side=sign*(p<.47?-2.4:2.4);height=-.8;distance=9.6;fov=53;
 }else if(kind==='crater'){
  side=sign*2.4;height=p<.57?-.5:3.2;distance=10.3;roll=sign*.045;fov=53;
 }else if(kind==='inferno'){
  side=sign*(p<.42?2.9:p<.56?-3.4:1.9);height=.65;distance=7.5;roll=-sign*.035;fov=48;
 }else if(kind==='fracture'){
  side=sign*(p<.5?2.9:-2.4);height=p<.55?.15:2.6;distance=7.7;roll=sign*.03;fov=49;
 }else if(kind==='timefracture'){
  side=sign*(p<.42?-3.1:p<.58?3.0:-1.4);height=.3;distance=8.5;roll=sign*(p<.58?-.045:.045);fov=47;
 }else if(kind==='guillotine'){
  side=sign*mix(-2.0,2.5,smooth(.29,.73,p));height=p<.72?4.1:.2;distance=10.8;target=[dx,defender.y+2.1*targetScale,defender.z];fov=54;roll=-sign*.025;
 }else if(kind==='threadmaze'){
  side=sign*Math.sin(p*Math.PI*5)*4.0;height=2.6;distance=11.8;fov=56;roll=sign*Math.sin(p*Math.PI*4)*.035;
 }else if(kind==='railcannon'){
  center[0]=dx;center[1]=defender.y+1.5*targetScale;target=[dx,defender.y+1.25*targetScale,defender.z];
  side=sign*2.5;height=.3;distance=8.5;fov=54;roll=-sign*.06;
 }else if(kind==='suncore'){
  side=sign*Math.cos(p*Math.PI*4)*3.4;height=1.1;distance=11.0;target=[dx-sign*.75,defender.y+1.45*targetScale,0];fov=55;roll=sign*.035;
 }else if(kind==='magnetic'){
  side=sign*Math.sin(p*Math.PI*5.2)*3.2;height=p<.53?1.7:3.4;distance=10.2;roll=-sign*Math.sin(p*Math.PI*3)*.045;fov=51;
 }else if(kind==='cathedral'){
  side=sign*3.8;height=5.0;distance=13.1;target=[dx,defender.y+1.6*targetScale,defender.z];fov=55;roll=sign*.02;
 }else if(kind==='origami'){
  side=sign*(p<.49?3.6:p<.67?-3.8:1.0);height=p<.49?1.0:3.9;distance=10.8;roll=sign*Math.sin(p*Math.PI*6)*.08;fov=53;
 }else if(kind==='gravitywell'){
  side=sign*Math.sin(p*Math.PI*3.2)*5.0;height=-.15;distance=13.0;target=[sign*2.0,defender.y+1.3*targetScale,-.4];fov=55;roll=sign*.07;
 }else if(kind==='tidal'){
  side=sign*(p<.46?-2.8:2.8);height=-.35;distance=10.7;target=[dx-sign*.8,defender.y+1.2*targetScale,defender.z];fov=54;roll=-sign*.035;
 }else if(kind==='tether'){
  side=sign*Math.cos(p*Math.PI*3)*4.0;height=2.4;distance=13.5;target=[dx-sign*.5,defender.y+1.4*targetScale,defender.z*.65];fov=56;roll=sign*Math.sin(p*Math.PI*4)*.075;
 }else if(kind==='starlance'){
  side=sign*3.0;height=1.5;distance=14.0;target=[dx-sign*.7,defender.y+1.4*targetScale,-.5];fov=55;roll=-sign*.04;
 }else if(kind==='chronoblade'){
  side=sign*(p<.42?3.8:p<.58?-3.3:2.0);height=p<.58?2.3:.8;distance=9.9;fov=50;roll=sign*Math.sin(p*Math.PI*3)*.065;
 }else if(kind==='serpent'){
  side=sign*Math.sin(p*Math.PI*4)*4.8;height=1.8;distance=12.7;target=[dx-sign*.7,defender.y+1.35*targetScale,defender.z*.5];fov=55;roll=sign*.055;
 }else if(kind==='aurora'){
  side=sign*(p<.52?-3.0:3.0);height=-.5;distance=12.3;target=[dx-sign*.45,defender.y+1.6*targetScale,0];fov=54;roll=-sign*.065;
 }
 return{camera:[center[0]+side,Math.max(.5,center[1]+height),center[2]+distance],target,fov,roll,shot:'approach'};
}
function shot(s,a,p,actor,defender){
 const base={camera:[0,3,10.8],target:[0,1.55,0],fov:36,roll:0,shot:'arena'};
 if(a.reduced||a.outcome==='draw'||p<.025||p>=.98)return base;
 const r=CAMERA_RIGS[s.camera],sign=a.outcome==='loss'?-1:1;
 const ax=sign*(-2.1+actor.x),dx=sign*2.1,scale=a.actorScale||1;
 if(p<.24)return{camera:[ax+sign*r[0],r[1]+actor.y+(scale-1)*1.1,r[2]],target:[ax,2.1*scale+actor.y,.1],fov:r[9],roll:0,shot:'anticipation'};
 if(s.staging)return directedFinisherShot(s,a,p,actor,defender,base);
 if(p<s.impact-.025){
  const orbit=r[5]*Math.sin(Math.PI*smooth(.24,s.impact,p)),mid=(ax+dx)*.5;
  const depth=actor.z*.42,lift=(actor.y+defender.y)*.35;
  return{camera:[mid+Math.sin(orbit)*r[4]*sign,r[3]+lift,Math.cos(orbit)*r[4]+depth],target:[mid,1.5*scale+lift,depth],fov:r[9]+3,roll:r[10]*sign,shot:'approach'};
 }
 if(p<s.impact+.11)return{camera:[dx+sign*r[6],r[7]+(a.targetScale||1)-1,r[8]],target:[dx-sign*.35,1.48*(a.targetScale||1),0],fov:r[9],roll:r[10]*sign,shot:'impact'};
 const t=smooth(s.impact+.11,.98,p);
 return{camera:vec([dx+sign*r[6],r[7]+.3,r[8]+1],base.camera,t),target:vec([dx-sign*.35,a.finalHit?.9:1.55,0],base.target,t),fov:mix(r[9],36,t),roll:r[10]*(1-t)*sign,shot:'recovery'};
}
function reactionPose(type,p,hit,final,finalHit,brace){
 const release=smooth(hit+.025,hit+.22,p),settle=1-smooth(hit+.25,1,p);
 // Contact has weight on its first frame. A sine starting at zero made the
 // exact knockout frame look like two fighters standing next to each other.
 // The held flinch blends into recoil and collapse without moving the damage
 // deadline or the hit-stop window.
 const contactFlinch=p+1e-9>=hit?1-smooth(hit+.025,hit+.13,p):0;
 const energy=Math.max(Math.sin(Math.PI*smooth(hit,hit+.25,p)),contactFlinch*.85);
 const collapse=final&&finalHit?smooth(hit+.04,Math.max(.94,hit+.11),p):0;
 const weight=brace?.28:final?1.3:.7;
 const r={x:(release*.3*settle+contactFlinch*.10)*weight,y:0,z:0,roll:0,torsoYaw:0,torsoPitch:-.72*energy*weight,headPitch:-.25*energy,
  handL:[.4,1.40+energy*.2,.22],handR:[-.4,1.40+energy*.2,.22],footL:[.13,.12,.12],footR:[-.13,.12,-.12]};
 if(type==='trip'){r.y=-.4*energy*weight;r.roll=-.4*energy*weight;r.handR=[-.3,1.2,.55];}
 if(type==='launch'){r.y=Math.sin(Math.PI*smooth(hit,hit+.32,p))*1.1*weight;r.x=release*.55*weight;r.torsoPitch=-.7*energy;}
 if(type==='slam'){r.y=-.45*energy*weight;r.torsoPitch=.65*energy;r.handL=[.2,1.05,.3];}
 if(type==='spin'){r.torsoYaw=release*Math.PI*1.6*settle*weight;r.z=Math.sin(release*Math.PI)*.3*weight;}
 if(type==='guardBreak'){r.handL=[.55,1.9,.05];r.handR=[-.55,1.9,.05];r.torsoPitch=-.9*energy*weight;}
 if(type==='wallBounce'){r.x=Math.sin(release*Math.PI*.8)*1.0*weight;r.y=.1*energy;r.roll=-.15*energy;}
 r.y-=.92*collapse;r.roll-=1.35*collapse;return{defender:r,collapse,release,contactFlinch};
}
export function cinematicFrame(animation,seconds){
 const s=descriptor(animation),p=clamp(seconds/(animation.duration/1000)),hit=animation.impactAt??s.impact;
 const stop=(animation.hitStop||45)/animation.duration;
 // Freeze only the physical pose; damage, audio and UI continue on the public timeline.
 const physical=p+1e-9>=hit&&p<hit+stop?hit:p>=hit+stop?hit+(p-hit-stop)*(1-hit)/(1-hit-stop):p;
 const style=animation.style||fighterFor(s.character).style;
 const attacker=actorPose(s,physical,style,animation.reduced);
 const impact=Math.max(0,1-Math.abs(p-hit)/.035),returnHome=smooth(hit+.11,1,p);
 const contacts=animation.reduced?[]:s.contacts||[];
 const success=presentationSuccess(animation,seconds),flourish=success<.5?.18+success*.36:1;
 const secondaryImpact=contacts.reduce((v,[at])=>Math.max(v,Math.max(0,1-Math.abs(p-at)/.014)),0)*flourish;
 const reactions=reactionPose(s.reaction,physical,hit,animation.finisher,animation.finalHit,animation.braced);
 if(!animation.reduced&&animation.finisher&&animation.finalHit&&['orbital','crater','thunder','rift'].includes(s.staging?.kind)){
  // The victim lands inside the crater at contact, then settles into the same
  // knockout pose used after the cinematic. Both terms fade before recovery.
  reactions.defender.y-=reactions.contactFlinch*.55;
  reactions.defender.roll-=reactions.contactFlinch*.85;
 }
 const stunt=animation.reduced?0:.65+success*.35;
 const staged=!animation.reduced&&s.staging&&physical<hit?stagedVictim(s,physical):null;
 if(staged){
  Object.assign(reactions.defender,staged);
  reactions.defender.y*=stunt;attacker.y*=stunt;
  reactions.defender.torsoPitch=-.25-Math.sin(p*12)*.18;
  reactions.defender.handL=[.43,1.5,.24];reactions.defender.handR=[-.43,1.67,.25];
  if(staged.stretch)reactions.defender.stretch=vec([1,1,1],staged.stretch,.65+success*.35);
 }else if(!animation.reduced&&p<hit){
  for(const [index,[at,pose]]of contacts.entries()){
   const flinch=smooth(at,at+.015,p)*(1-smooth(at+.055,at+.16,p));
   reactions.defender.x+=flinch*(index%2?-.14:.20)*flourish;
   reactions.defender.torsoPitch-=flinch*.56*flourish;reactions.defender.torsoYaw+=(index%2?-1:1)*flinch*.45*flourish;
   const launched=pose.includes('upper')||pose.includes('rise')||pose.includes('Rise');
   if(launched&&p>=at)reactions.defender.y=Math.max(reactions.defender.y,Math.sin(Math.PI*smooth(at,Math.min(.95,hit+.05),p))*(s.variant===2?1.5:.9)*(.55+success*.45));
  }
 }
 const allContacts=[...contacts.map(([at])=>at),hit].sort((a,b)=>a-b);
 const contactIndex=allContacts.reduce((last,at,i)=>p+1e-9>=at?i:last,-1),contactAt=contactIndex<0?allContacts[0]:allContacts[contactIndex];
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
 const sign=animation.outcome==='loss'?-1:1,staging=s.staging;
 let spectacle=null;
 if(staging&&!animation.reduced){
  const world=staging.world&&p>=staging.world.from&&p<staging.world.to?staging.world.name:'arena';
  const chapter=p<.27?'charge':p<.40?'launch':p<.69?'chase':p<hit?'return':p<hit+.06?'impact':'settle';
  const intensity=smooth(.12,.31,p)*(1-smooth(hit+.045,.96,p))*(.55+success*.45);
  spectacle={kind:staging.kind,phase:p,intensity,world,chapter,direction:sign,contactIndex,success,
   center:[sign*(2.1+reactions.defender.x),reactions.defender.y+1.7*(animation.targetScale||1),reactions.defender.z||0],
   anchor:staging.anchor?[sign*staging.anchor[0],staging.anchor[1],staging.anchor[2]]:null};
 }
 return{progress:p,weapon:animation.outcome==='loss'?animation.enemyWeapon:animation.playerWeapon||s.weapon,
  attacker,...shot(s,animation,p,attacker,reactions.defender),...reactions,lunge:clamp(attacker.x/4.9),impact:animation.avoided?0:impact,secondaryImpact,returnHome,
  spectacle,contactAt,contactIndex,hitCount:allContacts.length,contactStrength:contactAt>=hit-1e-9?1:flourish,qteBranch:success>=.8?'perfect':success>=.5?'steady':'strained',
  windup:smooth(.025,.13,p)*(1-smooth(hit-.1,hit,p)),contact:smooth(hit-.1,hit,p),revealed:p>=.025,
  shock:smooth(hit,hit+.22,p)*(1-smooth(hit+.22,.99,p)),vfx:s.vfx,reaction:s.reaction,
  activeBeats:(s.beats||[]).filter(b=>Math.abs(p-b.at)<.025).map(b=>b.id),hitStopped:p+1e-9>=hit&&p<hit+stop};
}
