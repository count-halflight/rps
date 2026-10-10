import React from 'react';
import { ArrowRight, Crosshair, Heart, ShoppingBag, Sparkles, Battery } from 'lucide-react';
import { routeChoices,roomFor } from '../game/routes.js';
import { ITEM_TYPES } from '../game/fighters.js';
const icons={normal:Crosshair,elite:Crosshair,rest:Heart,event:Sparkles,shop:ShoppingBag};
export default function RunFlow({run,onRoute,onRoom}){
 if(run.phase==='route')return <section className="flow-screen route-screen" aria-label="Choose the next route">
  <div className="flow-heading"><span>Floor {run.level} cleared</span><h1>Choose your way through</h1><p>Health restored. Your next opponent is on floor {run.level+1}.</p></div>
  <div className="route-doors">{routeChoices(run).map((route,index)=>{const Icon=icons[route.id];return <button className={`route-door route-${route.id}`} key={route.id} onClick={()=>onRoute(route.id)}><span className="door-light"/><small>0{index+1}</small><Icon size={38}/><h2>{route.name}</h2><p>{route.detail}</p><span className="door-enter">Enter <ArrowRight size={19}/></span></button>;})}</div>
  <div className="run-trail">{run.routes.slice(-7).map(r=><span key={r.level}>{r.level} · {r.type}</span>)}</div>
 </section>;
 if(run.phase!=='room')return null;
 const room=roomFor(run);
 return <section className={`flow-screen room-screen room-${room.kind}`} aria-label={room.title}>
  <div className="flow-heading"><span>Floor {run.level} · {run.credits} credits</span><h1>{room.title}</h1><p>{room.text}</p></div>
  <div className="room-actions">
   {room.kind==='rest'?<><button onClick={()=>onRoom('recharge')}><Battery/><b>Catch your breath</b><span>+35 charge. Clear all heat.</span></button><button onClick={()=>onRoom('supply')}><Heart/><b>Take a medkit</b><span>+1 medkit and +10 charge. Clear heat.</span></button></>:room.kind==='shop'?<>
    {ITEM_TYPES.map(i=><button key={i.id} disabled={run.credits<40||run.inventory[i.id]>=5} onClick={()=>onRoom(i.id)}><ShoppingBag/><b>{i.name} · 40 cr</b><span>{i.detail} · stock {run.inventory[i.id]}/5</span></button>)}
    <button disabled={run.credits<100||(run.perks?.[room.perk.id]||0)>=room.perk.cap} onClick={()=>onRoom('perk')}><Sparkles/><b>{room.perk.name} · 100 cr</b><span>{room.perk.detail}</span></button>
   </>:<><button onClick={()=>onRoom('risk')}><Sparkles/><b>Take the risk</b><span>{room.perk.name}: {room.perk.detail} Gain 20 heat.</span></button><button onClick={()=>onRoom('safe')}><Battery/><b>Keep moving</b><span>Take 15 charge.</span></button></>}
  </div><button className="room-leave" onClick={()=>onRoom('leave')}>Continue to the fight <ArrowRight size={20}/></button>
 </section>;
}
