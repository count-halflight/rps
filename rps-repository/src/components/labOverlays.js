import * as THREE from 'three';
import { cinematicFrame } from '../game/cinematics.js';
import {combatMomentById,evaluateCombatMoment} from '../game/combatMoments.js';
import {sceneMomentById,evaluateSceneMoment} from '../game/sceneMoments.js';

export function sampleLabCameraPath(clip,metrics={},count=61){
  if(!clip)return[];
  const momentId=clip.momentId||clip.sequenceId;
  const combat=combatMomentById(momentId),sceneMoment=sceneMomentById(momentId);
  const duration=clip.duration||(combat||sceneMoment)?.duration;
  if(!Number.isFinite(duration)||duration<=0)return[];
  const options={...clip,...metrics};
  return Array.from({length:Math.max(2,count)},(_,i)=>{
    const time=duration/1000*i/(Math.max(2,count)-1);
    const frame=combat?evaluateCombatMoment(momentId,time,options):sceneMoment?evaluateSceneMoment(momentId,time,options):cinematicFrame(options,time);
    return frame.camera;
  });
}

function actorMetrics(actors,clip){
  const heights=actors.map(actor=>(actor.standingHeight||2.1)*Math.abs(actor.root.scale.y));
  const eyes=actors.map((actor,i)=>(actor.eyeHeight||actor.standingHeight*.90||1.89)*Math.abs(actor.root.scale.y));
  const scales=actors.map(actor=>Math.abs(actor.root.scale.y));
  const sceneMoment=sceneMomentById(clip.momentId||clip.sequenceId);
  const actorIndex=sceneMoment?(clip.side==='player'?0:1):clip.outcome==='loss'?1:0,targetIndex=1-actorIndex;
  return{playerHeight:clip.playerHeight||heights[0],enemyHeight:clip.enemyHeight||heights[1],
    actorHeight:clip.actorHeight||heights[actorIndex],targetHeight:clip.targetHeight||heights[targetIndex],
    actorEyeHeight:clip.actorEyeHeight||eyes[actorIndex],targetEyeHeight:clip.targetEyeHeight||eyes[targetIndex],
    actorScale:clip.actorScale||scales[actorIndex],targetScale:clip.targetScale||scales[targetIndex]};
}

function cameraKey(clip,metrics){
  return JSON.stringify([clip.id,clip.sequenceId,clip.momentId,clip.duration,clip.bodyDuration,clip.variant,clip.weapon,clip.character,
    clip.outcome,clip.reduced,clip.short,clip.mirrored,clip.side,clip.phase,clip.braced,clip.finalHit,
    clip.playerCharacter,clip.enemyCharacter,clip.actorSide,clip.defeatedSide,clip.playerHand||clip.playerWeapon,clip.enemyHand||clip.enemyWeapon,metrics]);
}

export function createLabOverlays(scene) {
  const root = new THREE.Group(); root.visible = false; scene.add(root);
  const geometry = new THREE.SphereGeometry(.055, 8, 6);
  const material = new THREE.MeshBasicMaterial({ color: '#83ffd6', depthTest: false });
  const targets = Array.from({ length: 8 }, () => { const m = new THREE.Mesh(geometry, material); m.renderOrder = 100; root.add(m); return m; });
  const path = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#ffd488', transparent: true, opacity: .85, depthTest: false }));
  path.name='Lab camera path';
  root.add(path); path.renderOrder = 100;
  let helpers = [], previousActors = '', previousSequence = '';
  const disposeHelpers = () => { helpers.forEach(h => { root.remove(h); h.geometry.dispose(); h.material.dispose(); }); helpers = []; };
  return {
    update(actors, animation, options = {}) {
      root.visible = Boolean(options.bones || options.ik || options.camera);
      if (!root.visible) return;
      const key = actors.map(a => a.root.uuid).join('-');
      if (key !== previousActors) {
        disposeHelpers(); previousActors = key;
        helpers = actors.map(a => { const h = new THREE.SkeletonHelper(a.model || a.root); h.material.depthTest = false; h.renderOrder = 101; root.add(h); return h; });
      }
      helpers.forEach(h => { h.visible = Boolean(options.bones); h.updateMatrixWorld(true); });
      targets.forEach(t => { t.visible = false; });
      if (options.ik) actors.forEach((a, i) => {
        const limbs = [...(a.hands || []), ...(a.feet || [])];
        limbs.slice(0, 4).forEach((bone, j) => { const t = targets[i * 4 + j]; t.visible = true; bone.getWorldPosition(t.position); });
      });
      const clip=options.clip||animation;
      path.visible = Boolean(options.camera && clip);
      if (path.visible) {
        const metrics=actorMetrics(actors,clip),key=cameraKey(clip,metrics);
        if(previousSequence!==key){
          const points=sampleLabCameraPath(clip,metrics).map(point=>new THREE.Vector3(...point));
          path.geometry.dispose(); path.geometry = new THREE.BufferGeometry().setFromPoints(points); previousSequence = key;
        }
      }
    },
    dispose() { disposeHelpers(); root.removeFromParent(); geometry.dispose(); material.dispose(); path.geometry.dispose(); path.material.dispose(); },
  };
}
