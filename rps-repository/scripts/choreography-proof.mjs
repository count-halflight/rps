import { ATTACK_CATALOG } from '../src/game/attackCatalog.js';
import { attackPresentation,cinematicFrame } from '../src/game/cinematics.js';
import { mkdir,writeFile } from 'node:fs/promises';
const flatten=(frame)=>[frame.attacker.x,frame.attacker.y,frame.attacker.z,...frame.attacker.handL,...frame.attacker.handR,frame.attacker.torsoYaw||0,frame.attacker.weaponPitch||0,...frame.camera.map(n=>n*.2),...frame.target.map(n=>n*.2)];
export function sequenceDistance(a,b){
 const samples=20;let pose=0,camera=0;
 for(let i=1;i<samples;i++){
  const x=cinematicFrame(a,a.duration*i/samples/1000),y=cinematicFrame(b,b.duration*i/samples/1000);
  const v=flatten(x),w=flatten(y);pose+=v.slice(0,11).reduce((s,n,j)=>s+(n-w[j])**2,0);
  camera+=x.camera.reduce((s,n,j)=>s+(n-y.camera[j])**2,0);
 }
 return {pose:Math.sqrt(pose/(samples-1)),camera:Math.sqrt(camera/(samples-1)),combined:Math.sqrt((pose+camera*.04)/(samples-1))};
}
export function inspectCatalog(threshold=.18){
 const sequences=ATTACK_CATALOG.map(s=>({...attackPresentation(s.weapon,s.final,false,s.variant,s.character,null,s.finisherIndex||0),playerWeapon:s.weapon,outcome:'win',finalHit:s.final}));
 const table=[];const collisions=[];
 for(let i=0;i<sequences.length;i++)for(let j=i+1;j<sequences.length;j++){
  const d=sequenceDistance(sequences[i],sequences[j]);table.push({a:ATTACK_CATALOG[i].id,b:ATTACK_CATALOG[j].id,...d});
  if(d.combined<threshold)collisions.push(table.at(-1));
 }
 return{sequences:sequences.length,threshold,minimum:Math.min(...table.map(r=>r.combined)),collisions,table};
}
if(import.meta.url===`file://${process.argv[1]}`){
 const report=inspectCatalog();await mkdir('artifacts',{recursive:true});await writeFile('artifacts/choreography-distances.json',JSON.stringify(report,null,2));
 const csv='sequence_a,sequence_b,pose_distance,camera_distance,combined_distance\n'+report.table.map(r=>[r.a,r.b,r.pose.toFixed(4),r.camera.toFixed(4),r.combined.toFixed(4)].join(',')).join('\n');await writeFile('artifacts/choreography-distances.csv',csv);
 console.log(JSON.stringify({sequences:report.sequences,minimum:report.minimum,collisions:report.collisions.length,threshold:report.threshold}));
 if(report.collisions.length)process.exitCode=1;
}
