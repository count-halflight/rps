import React from 'react';
import {ChevronRight} from 'lucide-react';
export default function EncounterIntro({entrance,run,onSkip}){
 if(!entrance)return null;
 const r=run.enemy.rival,phase=r.phases?.[entrance.phase];
 return <section className={`encounter-intro ${run.enemy.boss?'boss-intro':''} ${entrance.kind==='phase'?'phase-intro':''}`} aria-label={entrance.kind==='phase'?'Boss phase change':'Rival introduction'}>
  <div className="intro-bars"/><div className="intro-identity"><span>{entrance.kind==='phase'?`Phase ${entrance.phase+1}`:run.enemy.boss?'District boss':run.enemy.elite?'Gatekeeper':run.enemy.district.zone}</span><h1>{entrance.kind==='phase'?phase?.name:r.name}</h1><h2>{entrance.kind==='phase'?phase?.detail:r.title}</h2><p>{entrance.kind==='phase'?r.signature:`“${r.taunt}”`}</p><small>{r.weapon} · {r.personalityInfo?.name}</small></div>
  <button onClick={onSkip}>{entrance.kind==='phase'?'Ready':'Skip intro'} <ChevronRight size={18} aria-hidden="true"/></button>
 </section>;
}
