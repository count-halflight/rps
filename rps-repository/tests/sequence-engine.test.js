import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {IMPLEMENTED_SEQUENCES,SEQUENCE_MANIFEST,sequenceById,presentationForSequenceId,evaluateSequence,physicalClock,ECHO_POSES,REACTIONS,reactionPose,echoReflectionPose,ECHO_REFLECTION_TIMES,sequenceContactSheetTimes} from '../src/game/sequences/index.js';
import {attackPresentation,cinematicFrame} from '../src/game/cinematics.js';
import {TIERS} from '../src/game/sequences/define.js';

const numbers=value=>typeof value==='number'?[value]:value&&typeof value==='object'?Object.values(value).flatMap(numbers):[];
test('Phase A exposes 65 mandatory IDs and only the four actually authored Echo sequences',()=>{
  assert.equal(SEQUENCE_MANIFEST.length,65);
  assert.equal(new Set(SEQUENCE_MANIFEST.map(s=>s.id)).size,65);
  assert.deepEqual(IMPLEMENTED_SEQUENCES.map(s=>s.id),['ECHO-S0','ECHO-S2','ECHO-SF','ECHO-AF']);
  for(const s of SEQUENCE_MANIFEST)assert.match(s.id,/^(ECHO|CINDER|NYX|VEX|KURO)-(R[012F]|P[012F]|S[012F]|AF)$/);
  assert.equal(sequenceById('CINDER-AF'),undefined);
  assert.throws(()=>presentationForSequenceId('CINDER-AF'),/not been authored/);
  assert.equal(SEQUENCE_MANIFEST.find(s=>s.id==='NYX-PF').title,'Integral collapse');
});
test('ECHO-S0, S2, SF and AF are finite, deterministic and scrub backwards without cached state',()=>{
  for(const s of IMPLEMENTED_SEQUENCES)for(const options of [{},{outcome:'loss',actorScale:1.35,targetScale:1.5},{reduced:true},{short:true},{braced:true},{qteSuccess:0,reduceFlashes:true}]){
    const p=presentationForSequenceId(s.id,options);
    for(let i=0;i<=80;i++){
      const elapsed=p.duration*i/80000,frame=evaluateSequence(s.id,elapsed,options);
      assert.ok(numbers(frame).every(Number.isFinite),`${s.id} at ${elapsed}`);
      assert.ok(frame.progress>=0&&frame.progress<=1);
      for(const q of Object.values(frame.attacker.boneQuaternions))assert.ok(Math.abs(Math.hypot(...q)-1)<1e-8);
      for(const effect of frame.fx)assert.ok(effect.opacity<=.6&&effect.count<=4000);
      assert.equal(frame.flash,0,'safe default never emits a hard white flash');
    }
    const forward=evaluateSequence(s.id,p.duration*.4/1000,options);
    evaluateSequence(s.id,p.duration*.9/1000,options);
    assert.deepEqual(evaluateSequence(s.id,p.duration*.4/1000,options),forward);
  }
});
test('Time director holds physical poses while the UI clock, camera and contact deadlines advance',()=>{
  for(const s of IMPLEMENTED_SEQUENCES){
    const p=presentationForSequenceId(s.id),at=s.mainHit;
    const a=evaluateSequence(s.id,at),b=evaluateSequence(s.id,at+s.hitStop/2000);
    assert.ok(a.impact>.999999,s.id);
    assert.equal(a.hitStopped,true,s.id);assert.equal(b.hitStopped,true,s.id);
    assert.deepEqual(a.attacker,b.attacker,`${s.id} retains exact held pose`);
    assert.ok(b.unscaledSeconds>a.unscaledSeconds);
    assert.equal(a.physicalSeconds,b.physicalSeconds);
    assert.ok(!evaluateSequence(s.id,at+s.hitStop/1000+.02).hitStopped);
    let prior=-1;for(let i=0;i<=1000;i++){
      const clock=physicalClock(s,s.duration*i/1000000);
      assert.ok(clock.physicalSeconds>=prior-1e-9,`${s.id} has a monotonic physical clock`);prior=clock.physicalSeconds;
    }
    for(const hit of s.hitTimes)assert.ok(Math.abs(physicalClock(s,hit).physicalSeconds-hit)<1e-8);
    assert.equal(p.hitStop,TIERS[s.tier].hitStop);
  }
});
test('Compressed slices preserve identity, contact timing and the reduced fixed camera within tier caps',()=>{
  for(const s of IMPLEMENTED_SEQUENCES){
    const p=presentationForSequenceId(s.id,{reduced:true}),cap=TIERS[s.tier].reducedMax;
    assert.ok(p.duration<=cap);
    const first=evaluateSequence(s.id,.1,{reduced:true}),last=evaluateSequence(s.id,p.duration*.85/1000,{reduced:true});
    assert.deepEqual(first.camera,last.camera);assert.deepEqual(first.target,last.target);
    assert.equal(first.shake,0);assert.equal(first.bars,0);
    const at=evaluateSequence(s.id,p.duration*p.impactAt/1000,{reduced:true});
    assert.ok(at.impact>.9999);assert.equal(at.sequenceId,s.id);
  }
});
test('ECHO-S0 draws once, resheathes before the delayed cut and reacts only when the line lands',()=>{
  assert.equal(evaluateSequence('ECHO-S0',0).attacker.bladeState,'sheathed');
  assert.ok(evaluateSequence('ECHO-S0',.432).attacker.drawProgress>.95);
  const before=evaluateSequence('ECHO-S0',.60),contact=evaluateSequence('ECHO-S0',.65);
  assert.equal(before.attacker.bladeState,'sheathed');
  assert.equal(before.defender.torsoPitch,0);
  assert.equal(before.fx.some(f=>f.id==='SLASH_LINE'),false);
  assert.equal(contact.attacker.bladeState,'sheathed');
  assert.ok(contact.fx.some(f=>f.id==='SLASH_LINE'&&f.delayed));
  assert.ok(contact.defender.torsoPitch<-.5);
});
test('ECHO-S2 crosses sides, heights and directions through separate cut poses before all cuts bloom',()=>{
  const s=sequenceById('ECHO-S2'),contacts=s.hitTimes.slice(0,-1).map(t=>evaluateSequence(s.id,t));
  assert.ok(contacts.some(f=>f.attacker.x<3.2)&&contacts.some(f=>f.attacker.x>3.2));
  assert.ok(contacts.some(f=>f.attacker.y>1.5));
  assert.ok(contacts.some(f=>f.attacker.z<-.4)&&contacts.some(f=>f.attacker.z>.5));
  assert.ok(new Set(contacts.map(f=>f.attacker.poseId)).size>=6);
  const bloom=evaluateSequence(s.id,s.mainHit);
  assert.equal(bloom.counter,1000);assert.equal(bloom.attacker.bladeState,'sheathed');
  assert.ok(bloom.fx.some(f=>f.id==='SLASH_LINE'&&f.count===1000));
  assert.equal(bloom.cameraShot,'SNAP-ZOOM');
});
test('ECHO-SF has reflection cuts, a silent far-side sheath and a death dissolve lasting over 1.5 seconds',()=>{
  const s=sequenceById('ECHO-SF'),p=presentationForSequenceId(s.id);
  assert.ok(p.sfx.some(f=>f.id==='silence'&&Math.abs(f.end-f.at-.5)<1e-8));
  const hit=evaluateSequence(s.id,s.mainHit,{finalHit:true});
  assert.ok(hit.attacker.x>5&&hit.attacker.yaw>3);
  assert.equal(hit.attacker.bladeState,'sheathed');
  assert.equal(hit.cameraShot,'LOW-HERO');
  assert.ok(s.dissolve.end-s.dissolve.at>=1.5);
  assert.equal(evaluateSequence(s.id,7,{finalHit:true}).defender.opacity,0);
  assert.equal(evaluateSequence(s.id,6,{finalHit:false}).dissolve.progress,0);
});
test('ECHO-AF owns all five acts, twenty-four distinct reflections, deferred glass dissolve and epilogue',()=>{
  for(const [time,act]of [[0,1],[2.5,2],[5.5,3],[9,4],[12.5,5],[15,5]])assert.equal(evaluateSequence('ECHO-AF',time,{finalHit:true}).finale.act,act);
  const mid=evaluateSequence('ECHO-AF',6.5,{finalHit:true});
  assert.equal(mid.finale.reflections.length,24);assert.ok(mid.hideHud);
  assert.equal(new Set(mid.finale.reflections.map(r=>r.angle)).size,24);
  assert.equal(evaluateSequence('ECHO-AF',8.5,{finalHit:true}).dissolve.progress,0);
  assert.ok(evaluateSequence('ECHO-AF',11,{finalHit:true}).dissolve.progress>.4);
  assert.equal(evaluateSequence('ECHO-AF',13,{finalHit:true}).title.name,'Last reflection');
  assert.equal(evaluateSequence('ECHO-AF',13,{finalHit:true}).finale.rainFrozen,false);
  for(let i=0;i<24;i++)assert.ok(numbers(echoReflectionPose(i,.43)).every(Number.isFinite));
});
test('Echo has complete named full-body poses and fourteen distinct defender reactions',()=>{
  assert.ok(Object.keys(ECHO_POSES).length>=24);
  for(const [name,p]of Object.entries(ECHO_POSES)){
    for(const field of ['handL','handR','footL','footR','face','footLock','bladeState','expression'])assert.ok(p[field]!==undefined,`${name}.${field}`);
  }
  const reactions=REACTIONS.map(r=>JSON.stringify(reactionPose(r,.18,1,{tier:3})));
  assert.equal(new Set(reactions).size,14);
  assert.ok(reactionPose('LAUNCH',.3,1,{tier:2}).y<=.5);
});
test('Four authored pose and camera trajectories remain distinct and legacy presentation calls work',()=>{
  const trajectories=IMPLEMENTED_SEQUENCES.map(s=>Array.from({length:24},(_,i)=>{
    const f=evaluateSequence(s.id,s.duration*i/23000);
    return [...f.camera,...f.target,f.attacker.x,f.attacker.y,f.attacker.z,...f.attacker.handL,...f.attacker.handR,f.attacker.yaw];
  }).flat());
  for(let i=0;i<trajectories.length;i++)for(let j=i+1;j<trajectories.length;j++){
    const distance=Math.sqrt(trajectories[i].reduce((n,v,k)=>n+(v-trajectories[j][k])**2,0)/trajectories[i].length);
    assert.ok(distance>.5,`${IMPLEMENTED_SEQUENCES[i].id}/${IMPLEMENTED_SEQUENCES[j].id}: ${distance}`);
  }
  const p=attackPresentation('scissors',false,false,0,'echo');assert.equal(p.sequenceId,'ECHO-S0');
  assert.deepEqual(cinematicFrame(p,.65),evaluateSequence('ECHO-S0',.65,p));
  assert.equal(attackPresentation('scissors',true,false,2,'echo',null,0,{bossKill:true}).sequenceId,'ECHO-AF');
  assert.equal(attackPresentation('scissors',true,false,2,'echo',null,1).sequenceId,'echo.scissors.final-alt');
});
test('Beat-aware twelve-frame sheets retain the instant draw, held contact, death and finale epilogue',()=>{
  for(const s of IMPLEMENTED_SEQUENCES){
    for(const opts of [{},{reduced:true},{short:true}]){
      const p=presentationForSequenceId(s.id,opts),times=sequenceContactSheetTimes(s.id,12,opts);
      assert.equal(times.length,12);
      assert.ok(times.every((t,i)=>Number.isFinite(t)&&t>=0&&t<=p.duration/1000&&(i===0||t>times[i-1])));
      assert.ok(times.some(t=>Math.abs(t-p.duration*p.impactAt/1000)<1e-8),`${s.id} includes its held impact`);
    }
  }
  assert.ok(sequenceContactSheetTimes('ECHO-S0').includes(.432));
  assert.ok(sequenceContactSheetTimes('ECHO-SF').includes(6.2));
  assert.ok(sequenceContactSheetTimes('ECHO-AF').includes(13.6));
  assert.equal(sequenceContactSheetTimes('ECHO-S0',17).length,17);
});
test('Reviewed anticipation uses a loaded planted crouch and the finale rises before locking its eyes',()=>{
  const coil=evaluateSequence('ECHO-S0',.38),rise=evaluateSequence('ECHO-AF',2.5);
  assert.ok(coil.attacker.y<-.2);assert.ok(coil.attacker.torsoPitch>.8);
  assert.deepEqual(coil.attacker.footLock,[1,1]);assert.ok(Math.abs(coil.attacker.boneQuaternions.spine02[0])>.13);
  assert.ok(evaluateSequence('ECHO-AF',0).attacker.y<-.49);
  assert.equal(rise.attacker.y,0);assert.equal(rise.attacker.expression,'calm');assert.equal(rise.attacker.face.blink,0);
  assert.ok(rise.attacker.face.browDown<=.12);assert.equal(rise.attacker.face.grit,0);
  assert.equal(evaluateSequence('ECHO-AF',8.62).attacker.headYaw,0);
  assert.ok(evaluateSequence('ECHO-AF',8.78).attacker.headYaw<-.6);
});
test('Close camera and mirror strikes follow measured physical actor eye and torso heights',()=>{
  const options={actorHeight:1.72,actorEyeHeight:1.60,targetHeight:2.05,targetEyeHeight:1.93};
  const frame=evaluateSequence('ECHO-AF',1.4,options);
  assert.ok(Math.abs(frame.target[1]-frame.attacker.y-1.60)<1e-8);
  assert.ok(frame.fov>=18&&frame.fov<=24);
  assert.ok(frame.camera[0]>-1.6,'face close shot shows a three-quarter front rather than a side profile');
  assert.ok(Math.abs(frame.finale.center[1]-frame.defender.y-2.05*.58)<1e-8);
  const mirrored=evaluateSequence('ECHO-AF',1.4,{...options,outcome:'loss'});
  assert.ok(Math.abs(mirrored.camera[0]+frame.camera[0])<1e-8);
});
test('Metre-scale common framing fills the stage while face anchors retain their authored close distance',()=>{
  const options={actorHeight:1.72,actorEyeHeight:1.60,targetHeight:2.2,targetEyeHeight:2.04};
  const first=evaluateSequence('ECHO-S0',0,options);
  assert.ok(first.camera[2]>=6.2&&first.camera[2]<=6.5);assert.equal(first.fov,35);
  const viewHeight=2*first.camera[2]*Math.tan(first.fov*Math.PI/360);
  assert.ok(1.72/viewHeight>.42&&2.2/viewHeight<.65);
  const reduced=evaluateSequence('ECHO-S2',1,{...options,reduced:true});
  assert.equal(reduced.camera[2],7);assert.equal(reduced.fov,40);
  const close=evaluateSequence('ECHO-AF',1.4,options);
  assert.ok(Math.abs(close.camera[2]-close.target[2]-1.2)<1e-8,'dedicated eye camera was not scaled down again');
  const epilogue=evaluateSequence('ECHO-AF',13.6,options);
  assert.ok(epilogue.camera[2]<6);assert.ok(epilogue.target[0]<-1.6);
  assert.ok(epilogue.fov<=36,'the last full-body shot centers the surviving fighter');
});
test('Afterlight contact cuts keep the real fighters and airborne reflection readable across screen shapes',()=>{
  const times=sequenceContactSheetTimes('ECHO-AF');
  for(const reflectionIndex of [2,14]){
    const contact=ECHO_REFLECTION_TIMES[reflectionIndex]+.12*.43;
    assert.ok(times.includes(contact),'the review sheet samples the actual contact, not an idle master');
    for(const outcome of ['win','loss']){
      const options={outcome,actorHeight:1.72,targetHeight:2.2},frame=evaluateSequence('ECHO-AF',contact,options);
      const reflection=frame.finale.reflections[reflectionIndex],sign=outcome==='loss'?-1:1;
      assert.equal(frame.cameraCut.reflectionIndex,reflectionIndex);assert.ok(reflection.active);
      assert.ok(frame.camera[2]<5,'the contact shot is closer than the surrounding dome master');
      const roots=[[-1.6*sign,0,0,1.72],[1.6*sign,frame.defender.y,0,2.2],[...reflection.root,1.72]];
      for(const aspect of [2.39,16/9,9/16]){
        const camera=new THREE.PerspectiveCamera(frame.fov,aspect,.1,90);
        camera.position.set(frame.camera[0],frame.camera[1],frame.camera[2]*Math.max(1,frame.cameraSafeWidth/aspect));
        camera.lookAt(...frame.target);camera.updateMatrixWorld();
        for(const [x,y,z,height] of roots)for(const py of [y,y+height*.92]){
          const point=new THREE.Vector3(x,py,z).project(camera);
          assert.ok(Math.abs(point.x)<.98&&Math.abs(point.y)<.98,`contact ${reflectionIndex} ${outcome} ${aspect}: feet and faces remain inside the frame`);
        }
      }
      const reduced=evaluateSequence('ECHO-AF',contact/3,{...options,reduced:true});
      assert.equal(reduced.cameraShot,'TWO-SHOT');assert.equal(reduced.cameraCut,undefined);
    }
  }
  for(const time of [5.5,8.62])assert.equal(evaluateSequence('ECHO-AF',time).cameraShot,'ORBIT','the dome establishment and last reflection retain their master shot');
});
