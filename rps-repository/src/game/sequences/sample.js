import {clamp,mix,vector,smooth,segment,blendValue} from './math.js';
import {blendEchoPoses,echoPose} from './echo/poses.js';
import {physicalClock} from './timeDirector.js';
import {reactionPose} from './reactions.js';
import {ECHO_REFLECTION_FAMILIES,reflectionPoseBanks,REFLECTION_REFERENCE_HEIGHT,REFLECTION_CONTACT_U} from './echo/reflectionPoses.js';
// A pure, pooled-renderer-friendly reflection sample. The curve enters from a
// different azimuth/elevation on each strike and exits tangent to the boss.
export function echoReflectionPose(index,strikeProgress,options={}){
  const i=((index%24)+24)%24,raw=clamp(strikeProgress),u=Math.abs(raw-REFLECTION_CONTACT_U)<1e-8?REFLECTION_CONTACT_U:raw,angle=i*Math.PI*2/24;
  const family=ECHO_REFLECTION_FAMILIES[i%8],direction=options.direction===-1?-1:1;
  const azimuth=direction===-1?Math.PI-angle:angle,yaw=-azimuth-Math.PI/2;
  const actorHeight=options.actorHeight||1.72,targetHeight=options.targetHeight||2.2;
  const defenderY=options.defenderY??-targetHeight*.14,scale=actorHeight/REFLECTION_REFERENCE_HEIGHT;
  const c=Math.cos(yaw),s=Math.sin(yaw),anchor=family.bladeAnchor.map(n=>n*scale);
  const rotated=[c*anchor[0]+s*anchor[2],anchor[1],-s*anchor[0]+c*anchor[2]];
  const surface=family.surfaceOffset*targetHeight/2.2;
  const contactPoint=[Math.cos(azimuth)*surface,defenderY+targetHeight*family.targetHeightRatio,Math.sin(azimuth)*surface];
  const contactRoot=contactPoint.map((n,k)=>n-rotated[k]);
  const entryAngle=azimuth-family.tangent*direction,exitAngle=azimuth+family.tangent*direction;
  const entry=[Math.cos(entryAngle)*family.entryRadius,contactRoot[1]+family.elevation,Math.sin(entryAngle)*family.entryRadius];
  const exit=[Math.cos(exitAngle)*2.95,contactRoot[1]+family.elevation*.25,Math.sin(exitAngle)*2.95];
  const root=u<REFLECTION_CONTACT_U?vector(entry,contactRoot,smooth(.10,REFLECTION_CONTACT_U,u)):
    vector(contactRoot,exit,smooth(.59,1,u));
  const banks=reflectionPoseBanks(i,u);
  return {...banks.pose,poseId:family.id,angle,root,yaw,
    poseBankA:banks.poseBankA,poseBankB:banks.poseBankB,poseBlend:banks.poseBlend,
    contactPoint,contactRoot,contactLocal:family.bladeAnchor,approachOffset:root.map((n,k)=>n-contactRoot[k]),
    primaryBlade:family.primaryBlade,contactFraction:family.contactFraction,targetBone:family.targetBone,surfaceOffset:surface,
    contact:u>=REFLECTION_CONTACT_U&&u<=.59,phase:u<REFLECTION_CONTACT_U?'pre':u<.59?'contact':'follow',
    opacity:.55*smooth(0,.18,u)*(1-smooth(.78,1,u)),bladeState:'drawn',drawProgress:1,footLock:[0,0]};
}
// Rising strike density: solve the integral of a rate rising from two to
// roughly twelve contacts/second. Each reflection still gets a 120 ms clip;
// the final rapid contacts may overlap slightly inside the same instant.
export const ECHO_REFLECTION_TIMES=Object.freeze(Array.from({length:24},(_,i)=>5.5+3.12*(Math.sqrt(4+140*(i/23))-2)/10));
const reflectionStarts=ECHO_REFLECTION_TIMES;
function finaleState(sequence,time,actor,defender,options){
  const sign=options.outcome==='loss'?-1:1,origin=sequence.origin;
  const targetHeight=options.targetHeight||2.1*(options.targetScale||1);
  const center=[sign*(origin+defender.x),defender.y+targetHeight*.58,defender.z];
  const fighterCenter=[sign*(-origin+actor.x),actor.y,actor.z];
  const act=time<2.5?1:time<5.5?2:time<9?3:time<12.5?4:5;
  let strikeIndex=-1;reflectionStarts.forEach((start,i)=>{if(time>=start)strikeIndex=i;});
  const strikeProgress=strikeIndex<0?0:clamp((time-reflectionStarts[strikeIndex])/.12);
  const reflectionOpacity=smooth(3.9,5.5,time)*(1-smooth(9.3,10.2,time));
  const reflections=reflectionStarts.map((start,index)=>{
    const u=clamp((time-start)/.12),pose=echoReflectionPose(index,u,{actorHeight:options.actorHeight||1.72,targetHeight,defenderY:defender.y,direction:sign}),active=time>=start&&time<start+.12;
    const prior=time>=start+.12;
    const radius=active?Math.hypot(pose.root[0],pose.root[2]):3.4;
    const angle=pose.angle;
    const root=active?[center[0]+pose.root[0],pose.root[1],center[2]+pose.root[2]]:[center[0]+Math.cos(angle)*radius*sign,0,center[2]+Math.sin(angle)*radius];
    const contactPoint=[center[0]+pose.contactPoint[0],pose.contactPoint[1],center[2]+pose.contactPoint[2]];
    return{index,angle,active,progress:u,poseId:pose.poseId,pose,root,yaw:pose.yaw,
      poseBankA:pose.poseBankA,poseBankB:pose.poseBankB,poseBlend:pose.poseBlend,
      contactPoint,contactLocal:pose.contactLocal,approachOffset:pose.approachOffset,
      targetBone:pose.targetBone,surfaceOffset:pose.surfaceOffset,primaryBlade:pose.primaryBlade,contactFraction:pose.contactFraction,contact:pose.contact,
      opacity:reflectionOpacity*(active?pose.opacity:prior?.12:.08)};
  });
  return {id:sequence.id,time,act,progress:time/(sequence.duration/1000),center,fighterCenter,strikeIndex,strikeProgress,reflections,
    dome:smooth(3.2,5.5,time)*(1-smooth(9.3,10.4,time)),cutLines:smooth(9,9.18,time)*(1-smooth(10.4,12,time)),
    dissolve:{style:'shatter',progress:smooth(9.65,12.4,time)},halo:smooth(12.1,12.7,time)*(1-smooth(14.3,15,time)),
    puddleEcho:smooth(13.20,13.45,time)*(1-smooth(14.5,15,time)),
    lights:{blackout:smooth(0,1.35,time)*(1-smooth(9.35,12.5,time)),relight:smooth(9.35,12.5,time)},
    blackout:smooth(8.85,8.97,time)*(1-smooth(9.05,9.14,time)),desaturate:smooth(9,9.08,time)*(1-smooth(9.35,9.85,time)),
    rainFrozen:time<12.5,title:time>=12.5?{fighter:'Echo',name:'Last reflection',opacity:smooth(12.5,13.2,time)*(1-smooth(14.5,15,time))}:null,
  };
}
function motion(sequence,physical){
  const {a,b,alpha}=segment(sequence.beats,physical);
  const attacker=blendEchoPoses(a.pose,b.pose,alpha),root=vector(a.root.pos,b.root.pos,alpha);
  Object.assign(attacker,{x:root[0],y:root[1],z:root[2],yaw:mix(a.root.yaw,b.root.yaw,alpha),poseId:alpha<.5?a.pose:b.pose,
    opacity:mix(a.opacity??attacker.opacity,b.opacity??attacker.opacity,alpha),weaponPath:blendValue(a.weaponPath,b.weaponPath,alpha)});
  return {attacker,a,b,alpha};
}
function cameraAt(sequence,time,actor,defender,options,impact){
  const {a,b,alpha}=segment(sequence.beats,time),ca=a.camera,cb=b.camera;
  const sign=options.outcome==='loss'?-1:1;
  const pos=vector(ca.pos,cb.pos,alpha),look=vector(ca.look,cb.look,alpha);
  pos[0]*=sign;look[0]*=sign;
  // Camera metadata was authored for scale one. Vertical actor framing follows
  // the actual arena scales without changing the choreography's ground plane.
  const actorHeight=options.actorHeight||2.1*(options.actorScale||1),targetHeight=options.targetHeight||2.1*(options.targetScale||1);
  const averageHeight=(actorHeight+targetHeight)*.5,heightCorrection=(averageHeight-2.1)*.66;
  look[1]+=heightCorrection;pos[1]+=heightCorrection;
  // Restoring real metre heights exposed how distant the former giant-model
  // cameras were. Ground exchanges fill the screen; the dome and epilogue
  // retain enough distance to show their practical scenery and reflections.
  const distanceScale=sequence.tier===5?(time>=12.5?.9:.82):.65;
  pos[2]=look[2]+(pos[2]-look[2])*distanceScale;
  const anchorWeight=mix(ca.anchorWeight||0,cb.anchorWeight||0,alpha);
  if(anchorWeight>0&&(ca.anchor==='attacker-eyes'||cb.anchor==='attacker-eyes')){
    const eyeHeight=options.actorEyeHeight||Math.min(1.58*(options.actorScale||1),actorHeight*.92);
    const eye=[sign*(-sequence.origin+actor.x),actor.y+eyeHeight,actor.z];
    const offset=vector(ca.offset||cb.offset,cb.offset||ca.offset,alpha);
    const anchorCamera=[eye[0]+offset[0]*sign,eye[1]+offset[1],eye[2]+offset[2]];
    for(let i=0;i<3;i++){pos[i]=mix(pos[i],anchorCamera[i],anchorWeight);look[i]=mix(look[i],eye[i],anchorWeight);}
  }
  const shot=alpha<.5?ca.shot:cb.shot;
  const compressed=options.reduced||options.short;
  if(options.reduced){
    return {camera:[0,2.45+heightCorrection,7.0],target:[0,averageHeight*.71,0],fov:40,roll:0,cameraShot:'TWO-SHOT'};
  }
  const cut=sequence.cameraCuts?.find(c=>time>=c.at&&time<c.end);
  if(cut){
    const center=[sign*(sequence.origin+defender.x),defender.y+targetHeight*.58,defender.z];
    const u=smooth(cut.at,cut.end,time),contact=reflectionStarts[cut.reflectionIndex]+.12*.43;
    const hitKick=3*Math.max(0,1-Math.abs(time-contact)/.075);
    const local=cut.offset.map((n,i)=>n+(cut.travel?.[i]||0)*u);
    return {camera:[center[0]+sign*local[0],center[1]+local[1],center[2]+local[2]],
      target:[center[0]+sign*cut.lookOffset[0],center[1]+cut.lookOffset[1],center[2]+cut.lookOffset[2]],
      fov:cut.fov+(compressed?0:hitKick),roll:0,cameraShot:cut.shot,cameraSafeWidth:cut.safeWidth,
      cameraCut:{reflectionIndex:cut.reflectionIndex,contact,progress:u}};
  }
  const authoredFov=mix(ca.fov,cb.fov,alpha),fov=authoredFov-(shot==='ESTABLISH'?3:0);
  return {camera:pos,target:look,fov:fov+(compressed?0:impact*(sequence.tier>=3?5:3)),roll:mix(ca.roll||0,cb.roll||0,alpha)*sign,cameraShot:shot};
}
function effectsAt(sequence,time,options){
  const effects=sequence.beats.flatMap(b=>b.fx).filter(f=>time>=f.at&&time<f.end);
  const result=effects.map(f=>({...f,phase:clamp((time-f.at)/(f.end-f.at)),age:time-f.at,
    opacity:Math.min(.60,f.opacity??.5),count:Math.min(f.count||1,options.quality==='light'?300:options.quality==='medium'?1500:4000),
    soft:f.soft||!!options.reduceFlashes,seed:sequence.id.split('').reduce((a,c)=>a+c.charCodeAt(0),0)}));
  // Every physical contact gets a ring; these are local geometry, never a
  // screen-sized flash. Authored rings take priority over this impact default.
  sequence.hitTimes.forEach((at,index)=>{
    if(time>=at&&time<at+.30&&!result.some(f=>f.id==='SHOCKRING'&&Math.abs(f.at-at)<.001))result.push({id:'SHOCKRING',at,end:at+.3,age:time-at,phase:(time-at)/.3,opacity:.22,size:sequence.tier>=3?.7:.5,anchor:'target',contactIndex:index,soft:true,count:1});
  });
  return result;
}
export function sampleSequence(sequence,elapsedSeconds,options={}){
  const duration=options.duration||sequence.duration,scale=duration/sequence.duration;
  const progress=clamp(elapsedSeconds/(duration/1000)),time=progress*sequence.duration/1000;
  const clock=physicalClock(sequence,time,{reduced:options.reduced,durationScale:scale}),physical=clock.physicalSeconds;
  const {attacker}=motion(sequence,physical);
  const hits=sequence.hitTimes,main=sequence.mainHit,contactIndex=hits.reduce((n,at,i)=>time+1e-9>=at?i:n,-1);
  const contactTime=contactIndex<0?hits[0]:hits[contactIndex];
  const mainAge=physical-main;
  let reaction=sequence.reaction;
  if(contactIndex>=0&&contactTime<main){reaction=sequence.beats.find(b=>Math.abs(b.t-contactTime)<1e-6)?.defender?.reaction||'STAGGER';}
  if(sequence.tier===5)reaction='FREEZE';
  const strength=options.qteSuccess===undefined?1:clamp(options.qteSuccess),flourish=strength<.5?.25+strength*.5:1;
  const defender=reactionPose(reaction,sequence.tier===5?0:contactIndex<0?-1:Math.max(0,physical-contactTime),contactTime===main?1:flourish,{tier:sequence.tier,braced:options.braced});
  if(sequence.defenderHold){
    const targetHeight=options.targetHeight||2.1*(options.targetScale||1);
    Object.assign(defender,structuredClone(sequence.defenderHold.pose));
    defender.y=-targetHeight*sequence.defenderHold.lowerByHeight;
  }
  const isLethal=sequence.tier>=4&&(options.finalHit!==false),collapse=isLethal?smooth(main+.15,Math.min(sequence.duration/1000-.05,main+1.7),physical):0;
  if(sequence.tier===3&&mainAge>.48){Object.assign(defender,reactionPose('KNEEL',Math.min(.4,mainAge-.48)));const recovery=smooth(main+.90,sequence.duration/1000,physical);const rest=reactionPose('FLINCH',-1);for(const k of ['y','torsoPitch','headPitch'])defender[k]=mix(defender[k],rest[k],recovery);}
  if(options.avoided){const dodge=smooth(main-.22,main-.035,time)*(1-smooth(main+.20,main+.6,time));defender.z=dodge*.85;defender.x=dodge*.32;defender.torsoPitch=.38*dodge;}
  const dissolve=sequence.dissolve?{style:sequence.dissolve.style,progress:isLethal?smooth(sequence.dissolve.at,sequence.dissolve.end,time):0,count:sequence.dissolve.count}:null;
  if(dissolve){defender.opacity=1-dissolve.progress;defender.dissolve=dissolve;}
  const impact=options.avoided?0:Math.max(0,1-Math.abs(time-main)/.09);
  const secondaryImpact=contactTime<main&&contactIndex>=0?Math.max(0,1-Math.abs(time-contactTime)/.045)*flourish:0;
  const {a,b,alpha}=segment(sequence.beats,time),lights=blendValue(a.lights,b.lights,alpha);
  const camera=cameraAt(sequence,time,attacker,defender,options,impact),fx=effectsAt(sequence,time,options);
  const tier=sequence.tier,shot=progress<.24?'anticipation':time<main-.02?'approach':time<main+.35?'impact':'recovery';
  const hit=main/(sequence.duration/1000),contactAt=contactTime/(sequence.duration/1000);
  const returnHome=smooth(main+.35,sequence.duration/1000,time),windup=smooth(0,.30,time)*(1-smooth(main-.25,main,time));
  const counter=tier===3?Math.round(1000*smooth(.78,main,time)**2):tier===4?Math.round(1000*smooth(1.72,main,time)**2):0;
  const finale=tier===5?finaleState(sequence,time,attacker,defender,options):null;
  const frame={progress,sequenceId:sequence.id,origin:sequence.origin,tier,weapon:sequence.weapon,attacker,defender,...camera,shot,
    physicalSeconds:physical*scale,authoredPhysicalSeconds:physical,unscaledSeconds:elapsedSeconds,timeScale:clock.timeScale,hitStopped:clock.hitStopped,
    collapse,release:smooth(main,main+.5,time),contactFlinch:time>=main?1-smooth(main+.07,main+.35,time):0,lunge:clamp(attacker.x/3.2),impact,secondaryImpact,
    returnHome,windup,contact:smooth(main-.20,main,time),revealed:true,shock:smooth(main,main+.28,time)*(1-smooth(main+.55,sequence.duration/1000,time)),
    contactAt,contactIndex,hitCount:hits.length,contactStrength:contactTime===main?1:flourish,qteBranch:strength>=.8?'perfect':strength>=.5?'steady':'strained',
    vfx:sequence.vfx,reaction:reaction.toLowerCase(),reactionId:reaction,activeBeats:sequence.beats.filter(beat=>Math.abs(time-beat.t)<.035).map(beat=>beat.pose),
    bars:options.reduced?0:tier>=3?1:0,aspect:2.39,fx,dissolve,lights,finale,counter,
    shake:options.reduced?0:sequence.shake*Math.max(impact,secondaryImpact*.65),flash:0,
    spectacle:tier>=4?{kind:tier===5?'afterlight-echo':'blade-storm',phase:progress,intensity:smooth(.12,.30,progress)*(1-smooth(.90,1,progress)),world:'arena',center:finale?.center||[(options.outcome==='loss'?-1:1)*(sequence.origin+defender.x),defender.y+(options.targetHeight||2.1*(options.targetScale||1))*.58,defender.z],chapter:time<main?'charge':'settle',success:strength,direction:options.outcome==='loss'?-1:1}:null,
  };
  if(finale){frame.lights=finale.lights;frame.hideHud=true;frame.title=finale.title;frame.flash=options.reduceFlashes?0:finale.desaturate*.12;}
  return frame;
}
