import React, { useLayoutEffect, useRef } from 'react';
import {ChevronRight, Crosshair, Shield, Zap} from 'lucide-react';
import { rivalProfile } from '../game/rivalProfile.js';
import { evaluateSceneMoment, sceneMomentById } from '../game/sceneMoments.js';
import RivalWeaponMark from './RivalWeaponMark';
export default function EncounterIntro({entrance,run,onSkip,presentationRival,preferences}){
 const card=useRef(null),taunt=useRef(null),surface=useRef(null);
 const r=presentationRival||rivalProfile(run.seed,run.level,run.enemy,run.character),phase=r.phases?.[entrance?.phase];
 const momentId=entrance?.sequenceId||(r.model==='bulwark'?(entrance?.kind==='phase'?`bulwark.phase${entrance.phase}`:'bulwark.intro'):!run.enemy.boss?`entrance.${r.character}`:null);
 const definition=sceneMomentById(momentId),authored=Boolean(definition);
 useLayoutEffect(()=>{
  if(!entrance||!definition)return;
  let request;
  const start=entrance.startedAt??performance.now();
  const tick=now=>{
   const frame=evaluateSceneMoment(momentId,Math.max(0,now-start)/1000,{
    duration:entrance.duration||definition.duration,
    reduced:entrance.reduced||preferences?.motion==='reduced',
    short:entrance.short||preferences?.cinematicLength==='short',
    phase:entrance.phase||0,
   });
   if(card.current){card.current.style.opacity=String(frame.card.opacity);card.current.setAttribute('aria-hidden',String(frame.card.opacity<=.01));}
   if(taunt.current)taunt.current.style.opacity=String(frame.taunt.opacity);
   surface.current?.style.setProperty('--intro-card-opacity',frame.card.opacity);
   if(!frame.finished)request=requestAnimationFrame(tick);
  };
  tick(performance.now());
  return()=>cancelAnimationFrame(request);
 },[entrance?.id,entrance?.startedAt,entrance?.duration,momentId,preferences?.motion,preferences?.cinematicLength]);
 if(!entrance)return null;
 const Personality=r.personalityKind==='BRUTE'?Zap:r.personalityKind==='MIMIC'?Crosshair:Shield;
 return <section ref={surface} className={`encounter-intro ${run.enemy.boss?'boss-intro':''} ${entrance.kind==='phase'?'phase-intro':''} ${authored?'authored-intro':''}`} aria-label={entrance.kind==='phase'?'Boss phase change':'Rival introduction'} style={{'--rival-color':r.color,'--intro-card-opacity':authored?0:1}}>
  <div className="intro-bars"/><div className="intro-slash" aria-hidden="true"/><div className="intro-floor" aria-hidden="true">{String(run.level).padStart(2,'0')}</div>
  <div ref={card} className="intro-identity" style={{opacity:authored?0:1}} aria-hidden={authored?true:undefined}>
    <span>{entrance.kind==='phase'?`Phase ${entrance.phase+1}`:run.enemy.boss?'District boss':r.tier==='miniboss'?'Gatekeeper':r.tier==='elite'?'Elite':run.enemy.district.zone}</span>
    <div className="intro-district">Floor {String(run.level).padStart(2,'0')} <i /> {run.enemy.district.name}</div>
    <h1>{entrance.kind==='phase'?definition?.title||phase?.name:r.name}</h1>
    <h2>{r.title}</h2>
    <p ref={taunt}>{definition?.taunt||(entrance.kind==='phase'?r.signature:r.taunt)}</p>
    <div className="intro-kit"><RivalWeaponMark profile={r} size={24} /><small>{r.weapon}</small><Personality size={17} aria-hidden="true"/><small>{r.personalityKind}</small><span>{r.serial}</span></div>
  </div>
  <button onClick={onSkip}>{entrance.kind==='phase'?'Ready':'Skip intro'} <ChevronRight size={18} aria-hidden="true"/></button>
 </section>;
}
