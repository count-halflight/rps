import ECHO_S0 from './echo/ECHO-S0.js';
import ECHO_S2 from './echo/ECHO-S2.js';
import ECHO_SF from './echo/ECHO-SF.js';
import ECHO_AF from './echo/ECHO-AF.js';
import {fighterFor} from '../fighters.js';
import {TIERS} from './define.js';
import {sampleSequence,echoReflectionPose,ECHO_REFLECTION_TIMES} from './sample.js';
export {SEQUENCE_MANIFEST,canonicalSequenceId} from './manifest.js';
export {ECHO_POSES,echoPose,blendEchoPoses} from './echo/poses.js';
export {REACTIONS,reactionPose} from './reactions.js';
export {physicalClock} from './timeDirector.js';
export {echoReflectionPose,ECHO_REFLECTION_TIMES};
export {ECHO_REFLECTION_POSES,ECHO_REFLECTION_FAMILIES,reflectionPoseBanks,REFLECTION_CONTACT_U,REFLECTION_REFERENCE_HEIGHT} from './echo/reflectionPoses.js';
export const IMPLEMENTED_SEQUENCES=Object.freeze([ECHO_S0,ECHO_S2,ECHO_SF,ECHO_AF]);
export const SEQUENCES=IMPLEMENTED_SEQUENCES;
const byId=new Map(IMPLEMENTED_SEQUENCES.map(s=>[s.id,s]));
export const sequenceById=id=>byId.get(id);
export function presentationForSequenceId(id,options={}){
  const s=sequenceById(id);if(!s)throw new Error(`Sequence has not been authored: ${id}`);
  const f=fighterFor(s.character),compressed=options.reduced||options.short;
  const duration=compressed?Math.min(s.duration,TIERS[s.tier].reducedMax):s.duration;
  return {sequenceId:s.id,character:s.character,weapon:s.weapon,playerWeapon:s.weapon,style:f.style,variant:s.variant,title:s.title,
    color:f.color,duration,bodyDuration:s.duration,impactAt:s.mainHit/(s.duration/1000),hits:s.hitTimes.map(t=>t/(s.duration/1000)),
    hitTimes:[...s.hitTimes],hitStop:s.hitStop,origin:s.origin,tier:s.tier,finisher:s.tier>=4,finisherIndex:0,finale:s.tier===5,
    reduced:!!options.reduced,short:!!options.short,reduceFlashes:options.reduceFlashes!==false,revealAt:0,vfx:s.vfx,reaction:s.reaction,
    contacts:s.hitTimes.filter(t=>t<s.mainHit).map(t=>[t/(s.duration/1000),s.beats.find(b=>Math.abs(b.t-t)<1e-6)?.pose||'AFTERLIGHT_STILL']),
    qteCues:compressed?[]:s.qteCues.map(c=>({...c})),sfx:s.beats.flatMap(b=>b.sfx),beats:s.beats,
    outcome:options.outcome||'win',actorScale:options.actorScale||1,targetScale:options.targetScale||1,
    ...options,
  };
}
export const sequencePresentation=presentationForSequenceId;
// The default twelve frames are authored review beats, not uniform snapshots:
// a 16 ms draw and a held contact must both survive a contact-sheet export.
// Returned units are seconds on the selected presentation's unscaled clock.
export function sequenceContactSheetTimes(id,count=12,options={}){
  const s=sequenceById(id);if(!s)throw new Error(`Sequence has not been authored: ${id}`);
  const requested=Math.max(1,Math.floor(Number.isFinite(count)?count:12)),end=s.duration/1000;
  const recommended=[...new Set(s.reviewTimes||[0,...s.hitTimes,end])].sort((a,b)=>a-b);
  let times;
  if(requested===recommended.length)times=recommended;
  else if(requested<recommended.length)times=Array.from({length:requested},(_,i)=>recommended[Math.round(i*(recommended.length-1)/Math.max(1,requested-1))]);
  else{
    times=[...recommended];
    while(times.length<requested){
      let gap=0,index=0;
      for(let i=0;i<times.length-1;i++)if(times[i+1]-times[i]>gap){gap=times[i+1]-times[i];index=i;}
      if(!gap)times.push(Math.min(end,times.at(-1)+end/requested));
      else times.splice(index+1,0,(times[index]+times[index+1])*.5);
    }
  }
  const p=presentationForSequenceId(id,options),scale=p.duration/s.duration;
  return times.map(t=>Math.max(0,Math.min(end,t))*scale);
}
export function evaluateSequence(id,elapsedSeconds,options={}){
  const s=typeof id==='string'?sequenceById(id):id;
  if(!s)throw new Error(`Sequence has not been authored: ${id}`);
  const presentation=presentationForSequenceId(s.id,options);
  return sampleSequence(s,elapsedSeconds,presentation);
}
