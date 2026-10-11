import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createLabOverlays,sampleLabCameraPath} from '../src/components/labOverlays.js';
import {cinematicFrame} from '../src/game/cinematics.js';
import {IMPLEMENTED_SEQUENCES,presentationForSequenceId} from '../src/game/sequences/index.js';
import {SCENE_MOMENTS,sceneMomentPresentation,evaluateSceneMoment} from '../src/game/sceneMoments.js';
import {COMBAT_MOMENTS,combatMomentPresentation,evaluateCombatMoment} from '../src/game/combatMoments.js';

function fixture(){
  const scene=new THREE.Scene();
  const actors=[1.72,2.2].map((height,i)=>{
    const root=new THREE.Group(),model=new THREE.Group();root.add(model);scene.add(root);
    root.scale.setScalar(height/2.1);root.position.x=i?1.6:-1.6;
    const limbs=Array.from({length:4},(_,j)=>{const bone=new THREE.Bone();bone.position.set(j%2?.2:-.2,j<2?1.3:.12,j*.05);model.add(bone);return bone;});
    return{root,model,standingHeight:2.1,eyeHeight:1.94,hands:limbs.slice(0,2),feet:limbs.slice(2)};
  });
  scene.updateMatrixWorld(true);
  return{scene,actors,overlay:createLabOverlays(scene)};
}
function points(path){
  const attr=path.geometry.getAttribute('position');return Array.from({length:attr.count},(_,i)=>[attr.getX(i),attr.getY(i),attr.getZ(i)]);
}
function close(actual,expected,message){actual.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-5,`${message}: axis${i}`));}

test('Actual Lab path geometry follows all four attacks, nine scenes and eight combat clocks',()=>{
  const f=fixture(),playerHeight=1.72,enemyHeight=2.2;
  try{
    const cases=[
      ...IMPLEMENTED_SEQUENCES.map(s=>({clip:presentationForSequenceId(s.id),sample:(clip,t)=>cinematicFrame({...clip,actorHeight:playerHeight,targetHeight:enemyHeight,actorEyeHeight:1.94*playerHeight/2.1,targetEyeHeight:1.94*enemyHeight/2.1,actorScale:playerHeight/2.1,targetScale:enemyHeight/2.1},t)})),
      ...SCENE_MOMENTS.map(s=>({clip:sceneMomentPresentation(s.id),sample:(clip,t)=>evaluateSceneMoment(s.id,t,{...clip,actorHeight:enemyHeight,actorEyeHeight:1.94*enemyHeight/2.1})})),
      ...COMBAT_MOMENTS.map(s=>({clip:combatMomentPresentation(s.id),sample:(clip,t)=>evaluateCombatMoment(s.id,t,{...clip,playerHeight,enemyHeight})})),
    ];
    for(const {clip,sample}of cases){
      clip.id=`path-${clip.sequenceId||clip.momentId}`;
      f.overlay.update(f.actors,clip,{camera:true});
      const path=f.scene.getObjectByName('Lab camera path'),vertices=points(path);assert.equal(vertices.length,61);
      for(const index of [0,24,60])close(vertices[index],sample(clip,clip.duration/1000*index/60).camera,clip.id);
    }
  }finally{f.overlay.dispose();}
});

test('Camera-path cache refreshes for mirrored, reduced and measured-height changes with the same clip ID',()=>{
  const f=fixture(),clip={...sceneMomentPresentation('entrance.echo'),id:'same-scene'};
  try{
    f.overlay.update(f.actors,clip,{camera:true});const path=f.scene.getObjectByName('Lab camera path'),initialGeometry=path.geometry,first=points(path)[0];
    f.overlay.update(f.actors,clip,{camera:true});assert.equal(path.geometry,initialGeometry,'unchanged settings reuse the geometry');
    f.overlay.update(f.actors,{...clip,mirrored:true},{camera:true});assert.notEqual(path.geometry,initialGeometry);assert.ok(Math.abs(points(path)[0][0]+first[0])<1e-5);
    f.overlay.update(f.actors,{...clip,reduced:true},{camera:true});const fixed=points(path);close(fixed[0],fixed[60],'reduced camera is fixed');
    f.overlay.update(f.actors,clip,{camera:true});const before=path.geometry;
    f.actors[1].root.scale.setScalar(2.6/2.1);f.overlay.update(f.actors,clip,{camera:true});assert.notEqual(path.geometry,before);
    close(points(path)[0],evaluateSceneMoment('entrance.echo',0,{actorHeight:2.6}).camera,'actual rival height changes framing');
  }finally{f.overlay.dispose();}
});

test('Scene clip options supply a path without an attack animation and preserve actual bones and grip targets',()=>{
  const f=fixture(),clip={...sceneMomentPresentation('bulwark.intro'),id:'entrance-only'};
  try{
    f.overlay.update(f.actors,null,{camera:true,bones:true,ik:true,clip});
    const path=f.scene.getObjectByName('Lab camera path');assert.ok(path.visible);assert.equal(points(path).length,61);
    const root=path.parent,helpers=root.children.filter(child=>child.isSkeletonHelper),targets=root.children.filter(child=>child.isMesh);
    assert.equal(helpers.length,2);assert.ok(helpers.every(helper=>helper.visible));
    assert.equal(targets.length,8);assert.ok(targets.every(target=>target.visible));
    for(const [index,limb]of f.actors.flatMap(actor=>[...actor.hands,...actor.feet]).entries())close(targets[index].position.toArray(),limb.getWorldPosition(new THREE.Vector3()).toArray(),'grip/foot overlay');
    f.overlay.update(f.actors,null,{camera:false,bones:true,ik:true,clip});assert.equal(path.visible,false);assert.ok(targets.every(target=>target.visible));
    const exported=sampleLabCameraPath(combatMomentPresentation('combat.reveal'),{playerHeight:1.72,enemyHeight:2.2});assert.equal(exported.length,61);
  }finally{f.overlay.dispose();}
});
