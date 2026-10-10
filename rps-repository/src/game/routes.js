import { PERKS,addPerk,perkTotals } from './perks.js';
const TYPES={normal:{name:'Fight',detail:'A regular rival. Standard rewards.'},elite:{name:'Elite fight',detail:'A stronger gatekeeper. Better reward choices.'},rest:{name:'Rest stop',detail:'Take supplies or recharge before the fight.'},event:{name:'Side street',detail:'A seeded event before the fight.'},shop:{name:'Supply stall',detail:'Buy supplies or a perk. Leaving is free.'}};
function hash(seed){let n=seed>>>0;n=Math.imul(n^(n>>>16),0x45d9f3b);return(n^(n>>>16))>>>0;}
export function routeChoices(run){
 const h=hash(run.seed+run.level*4513),other=['elite','rest','event','shop'];
 const mandatory=(run.level+1)%5===0||(run.level+1)%5===3;
 const keys=['normal',other[h%4],other[(h%4+1+(h>>>8)%3)%4]];
 return [...new Set(keys)].map((id,i)=>({id,...TYPES[id],detail:mandatory?(id==='elite'?'A supply cache, then the scheduled guardian.':id==='normal'?'Face the scheduled guardian.':`${TYPES[id].detail} The guardian waits after.`):TYPES[id].detail,seed:hash(h+i*71)}));
}
export function roomFor(run){
 const kind=run.routeChoice,h=hash(run.seed+run.level*8803);
 const perk=PERKS.filter(p=>p.cap>1)[h%32];
 return {kind,title:kind==='rest'?'Under the awning':kind==='shop'?'Last stall open':'A light in the alley',text:kind==='event'?['A courier dropped a sealed power cell.','A repairer offers a tune-up in exchange for a risky voltage test.','A hidden locker opens when the district lights flicker.'][h%3]:kind==='rest'?'The fight can wait. Pick a supply.':'Spend credits, or leave with what you have.',perk};
}
export function roomAction(run,id){
 if(run.phase!=='room')return run;
 const room=roomFor(run),p=perkTotals(run),inventory={...run.inventory};
 let next={...run};
 if(id==='leave')return{...run,phase:'ready',encounterSeen:false};
 if(room.kind==='rest'){
  if(!['recharge','supply'].includes(id))return run;
  next.charge=Math.min(100,run.charge+(id==='recharge'?35:10));next.heat=0;
  if(id==='supply'||p.restSupply)inventory.medkit=Math.min(5,inventory.medkit+1+(p.restSupply||0));
 }else if(room.kind==='shop'){
  if(id==='perk'){
   if(run.credits<100||(run.perks?.[room.perk.id]||0)>=room.perk.cap)return run;
   next=addPerk(next,room.perk.id);next.credits-=100;
  }else if(['medkit','coolant','battery'].includes(id)){
   if(run.credits<40||inventory[id]>=5)return run;inventory[id]++;next.credits-=40;
  }else return run;
  return{...next,inventory};
 }else{
  if(!['risk','safe'].includes(id))return run;
  if(id==='risk'){next=addPerk(next,room.perk.id);next.heat=Math.min(100,run.heat+20);}
  else next.charge=Math.min(100,run.charge+15);
 }
 return{...next,inventory,phase:'ready',encounterSeen:false};
}
