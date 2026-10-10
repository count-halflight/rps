import assert from 'node:assert/strict';
import {writeFile,mkdir}from'node:fs/promises';
import{newRun,resolveTurn,openingFor,useEarnedItem,counterFor,WEAPONS,random,chooseReward,rewardChoices,chooseRoute,loadSave,scanSignal}from'../src/game/engine.js';
import{routeChoices,roomAction}from'../src/game/routes.js';
import{perkTotals}from'../src/game/perks.js';
const COUNT=Number(process.env.SIM_RUNS||1000),MAX=40;
function simulate(seed,policy){let run=newRun(seed),turns=0,transitions=0,rooms=0,bosses=0;const rng=random(seed*1013);
 while(run.phase!=='defeat'&&run.level<=MAX&&turns<2500){
  assert.ok(++transitions<6000,'softlock');assert.ok(Number.isFinite(run.hp)&&run.hp>=0&&run.hp<=run.maxHp);assert.ok(run.charge>=0&&run.charge<=100&&run.heat>=0&&run.heat<=100);
  if(run.phase==='upgrade'){
   if(run.enemy.boss)bosses++;
   const options=rewardChoices(run);assert.equal(options.length,3);
   const option=policy==='random'?options[Math.floor(rng()*3)]:options.find(p=>p.id==='armor')||options.find(p=>p.id==='power')||options.find(p=>p.cap)||options[0];
   run=chooseReward(run,option.id);assert.equal(run.phase,'route');
   const save=loadSave({getItem:()=>JSON.stringify(run)});assert.ok(save);run=save;continue;
  }
  if(run.phase==='route'){
   const routes=routeChoices(run);assert.ok(routes.length>=2);
   const route=routes[Math.floor(rng()*routes.length)];run=chooseRoute(run,route.id);assert.equal(run.hp,run.maxHp,'each fight restores health');continue;
  }
  if(run.phase==='room'){
   rooms++;run=roomAction(run,run.routeChoice==='rest'?'supply':run.routeChoice==='event'?(rng()>.5?'risk':'safe'):'leave');assert.equal(run.phase,'ready');continue;
  }
  assert.equal(run.phase,'ready');
  const p=perkTotals(run);
  if(policy==='tactical'&&run.charge>=30-(p.scanDiscount||0)&&!run.scanUsed&&(run.enemy.boss||run.enemy.confidence<60))run=scanSignal(run);
  const hand=policy==='perfect'?counterFor(openingFor(run,'rock').enemyWeapon,run.enemy.district.reverse).id:policy==='random'?WEAPONS[Math.floor(rng()*3)].id:counterFor(run.scanned||WEAPONS[run.enemy.signal].id,run.enemy.district.reverse).id;
  const opening=openingFor(run,hand);assert.ok(opening);
  if(policy==='tactical'&&opening.outcome==='win'&&run.hp<run.maxHp*.5&&run.inventory.medkit)run=useEarnedItem(run,hand,'medkit');
  else run=resolveTurn(run,hand,policy!=='random'&&opening.outcome==='loss'?'guard':run.charge>=40&&run.heat<65&&opening.outcome==='win'?'overdrive':'strike');
  turns++;
 }
 assert.ok(turns<2500,'combat failed to terminate');return{level:run.level,turns,rooms,bosses,defeated:run.phase==='defeat'};
}
const report={runsPerPolicy:COUNT,maxFloor:MAX,softlocks:0,policies:{}};
for(const policy of ['random','tactical','perfect']){const runs=Array.from({length:COUNT},(_,i)=>simulate(i+1,policy)),sort=runs.map(r=>r.level).sort((a,b)=>a-b);
 report.policies[policy]={meanFloor:runs.reduce((n,r)=>n+r.level,0)/COUNT,medianFloor:sort[Math.floor(COUNT/2)],reach5:runs.filter(r=>r.level>=5).length/COUNT,reach10:runs.filter(r=>r.level>=10).length/COUNT,reach20:runs.filter(r=>r.level>=20).length/COUNT,completed:runs.filter(r=>r.level>MAX).length/COUNT,rooms:runs.reduce((n,r)=>n+r.rooms,0),bosses:runs.reduce((n,r)=>n+r.bosses,0)};
 console.log(policy,JSON.stringify(report.policies[policy]));
}
assert.ok(report.policies.perfect.meanFloor>report.policies.tactical.meanFloor);assert.ok(report.policies.tactical.meanFloor>report.policies.random.meanFloor);
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/run-simulation.json',JSON.stringify(report,null,2));
