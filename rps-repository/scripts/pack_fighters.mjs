import { pack } from 'gltfpack';
import { readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FIGHTERS } from '../src/game/fighters.js';

// Keep bone names for IK and UVs for runtime cloth maps. The error limit bounds
// simplification to 0.3% of the mesh extent; compression needs no network at play.
for(const fighter of FIGHTERS){
  if(process.env.FIGHTER_ONLY&&process.env.FIGHTER_ONLY!==fighter.model)continue;
  const file=resolve('public/models',`${fighter.model}-human.glb`);
  const before=readFileSync(file).length;
  await pack(['-i',file,'-o',file,'-cc','-kn','-km','-kv','-si','0.75','-se','0.001','-slb'],{
    read:path=>readFileSync(path),write:(path,data)=>writeFileSync(path,data),
  });
  console.log(`${fighter.name}: ${(before/1024).toFixed(0)} KB → ${(readFileSync(file).length/1024).toFixed(0)} KB`);
}
