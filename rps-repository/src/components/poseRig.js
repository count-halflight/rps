import * as THREE from "three";

// Place both joints of a limb, preserving its measured lengths. Rotating just
// the shoulder made the old fighters slide with rigid elbows and open hands.
export function createPoseRig(model, body, style, standingHeight=2.10) {
  const bone = (name) => model.getObjectByName(name.replaceAll(".", ""));
  const arms = ["L", "R"].map((s) => [bone(`upperarm01.${s}`), bone(`lowerarm01.${s}`), bone(`wrist.${s}`)]);
  const legs = ["L", "R"].map((s) => [bone(`upperleg01.${s}`), bone(`lowerleg01.${s}`), bone(`foot.${s}`)]);
  const digits = Object.fromEntries(['L','R'].map(side=>[side,
    Array.from({length:5},(_,finger)=>Array.from({length:3},(_,segment)=>bone(`finger${finger+1}-${segment+1}.${side}`)))]));
  const spines = [bone("spine02"), bone("spine01")], head = bone("head");
  const rest = new Map();
  let hasMorphBlink=false;
  model.traverse(o=>{if(o.morphTargetDictionary?.blink!==undefined)hasMorphBlink=true;});
  model.traverse((b) => { if (b.isBone) rest.set(b, b.quaternion.clone().normalize()); });
  model.updateMatrixWorld(true);
  const local = (b) => model.worldToLocal(b.getWorldPosition(new THREE.Vector3()));
  const shoulderY = local(arms[0][0]).y;
  const footRest = legs.map((l) => local(l[2]));
  const modelRotation = model.getWorldQuaternion(new THREE.Quaternion());
  const footRotations = legs.map(l=>modelRotation.clone().invert().multiply(l[2].getWorldQuaternion(new THREE.Quaternion())));
  const lengths = [...arms, ...legs].map(([a,b,c]) => [a.getWorldPosition(new THREE.Vector3()).distanceTo(b.getWorldPosition(new THREE.Vector3())), b.getWorldPosition(new THREE.Vector3()).distanceTo(c.getWorldPosition(new THREE.Vector3()))]);
  const world = (v) => model.localToWorld(new THREE.Vector3(...v));
  const authoredScale=standingHeight/2.10;
  const authoredTarget=(p,key,fallback)=>p[key]?(p[key+'Space']==='native'?p[key]:p[key].map(v=>v*authoredScale)):fallback;
  const point = (b) => b.getWorldPosition(new THREE.Vector3());
  function aim(b, end, target) {
    const start = point(b), from = point(end).sub(start).normalize(), to = target.clone().sub(start).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(from, to);
    const parent = b.parent.getWorldQuaternion(new THREE.Quaternion());
    b.quaternion.copy(parent.clone().invert().multiply(q).multiply(parent).multiply(b.quaternion));
    b.updateWorldMatrix(false, true);
  }
  function solve(chain, target, pole, lens, extension=.985) {
    const [upper, lower, end] = chain, start = point(upper);
    const direction = target.clone().sub(start), rawDistance = direction.length();
    direction.normalize();
    const scale = model.getWorldScale(new THREE.Vector3()).y;
    // Lengths were sampled at scale one. The arena scales a complete fighter.
    const l1 = lens[0]*scale, l2 = lens[1]*scale;
    const d = THREE.MathUtils.clamp(rawDistance, Math.abs(l1-l2)+.001, (l1+l2)*extension);
    const actualTarget = start.clone().addScaledVector(direction,d);
    const bend = pole.clone().sub(start);
    bend.addScaledVector(direction,-bend.dot(direction)).normalize();
    const a = (l1*l1-l2*l2+d*d)/(2*d), h = Math.sqrt(Math.max(0,l1*l1-a*a));
    const elbow = start.clone().addScaledVector(direction,a).addScaledVector(bend,h);
    aim(upper, lower, elbow);
    aim(lower, end, actualTarget);
  }
  const idle = () => {
    const y = shoulderY;
    if (style === "archer") return [[.30,y-.22,.27],[-.22,y-.18,.14]];
    if (style === "mage") return [[.30,y-.42,.25],[-.25,y-.23,.27]];
    if (style === "glaive") return [[.28,y-.38,.34],[-.27,y-.30,.32]];
    if (style === "brawler") return [[.23,y-.12,.32],[-.23,y-.12,.32]];
    return [[.31,y-.28,.27],[-.30,y-.29,.27]];
  };
  function pose(p = {}, time = 0) {
    for (const [b,q] of rest) b.quaternion.copy(q);
    body.rotation.set(0,0,p.roll || 0);
    const quaternionPose=(b,name)=>{
      const q=p.boneQuaternions?.[name];
      if(!Array.isArray(q)||q.length!==4||!q.every(Number.isFinite))return false;
      const rotation=new THREE.Quaternion(...q);
      if(rotation.lengthSq()<1e-8)return false;
      b.quaternion.copy(rest.get(b)).multiply(rotation.normalize());return true;
    };
    if(!quaternionPose(spines[0],'spine02'))spines[0].rotation.x += (p.torsoPitch ?? p.body ?? 0)*.35;
    if(!quaternionPose(spines[1],'spine01')){
      spines[1].rotation.y += (p.torsoYaw || 0)*.55;
      spines[1].rotation.z += (p.torsoLean || 0)*.3;
    }
    if(!quaternionPose(head,'head')){
      head.rotation.y += p.headYaw ?? Math.sin(time*.7)*.025;
      head.rotation.x += p.headPitch || 0;
    }
    const jaw=bone('jaw');if(jaw&&!hasMorphBlink)jaw.rotateX(p.headPitch?-.08:.004*Math.sin(time*.4));
    const blink=Math.max(0,1-Math.abs((time%4.8)-.15)/.11);
    for(const side of ['L','R'])for(const name of ['oculi01','oculi02']){
      const lid=bone(`${name}.${side}`);if(lid&&!hasMorphBlink)lid.rotateX(blink*(name==='oculi01'?.12:-.08));
    }
    model.updateWorldMatrix(true,true);
    const targets = idle();
    const breathe = Math.sin(time*2.3)*.009;
    arms.forEach((chain,i) => {
      const key = i===0?"handL":"handR", sign=i===0?1:-1;
      const side=i===0?'L':'R';
      const gesture=p.rpsHand===side&&['rock','paper','scissors'].includes(p.handSign);
      const gestureProgress=gesture?THREE.MathUtils.clamp(Number.isFinite(p.handSignProgress)?p.handSignProgress:1,0,1):0;
      let target = authoredTarget(p,key,targets[i]);
      target = [target[0],target[1]+breathe,target[2]];
      solve(chain,world(target),world([sign*.65,shoulderY-.52,-.18]),lengths[i]);
      const fingerRoot=bone(`finger3-1.${i===0?"L":"R"}`);
      if(fingerRoot) {
        const forward=world([target[0],target[1]-.18,target[2]+.5]);
        aim(chain[2],fingerRoot,forward);
      }
      // Each weapon has a different anatomical grip: a closed boxer's fist,
      // a blade's tight handle, a staff's cylindrical grasp, or a draw pinch.
      for (let finger=2;finger<=5;finger++) for (let segment=1;segment<=3;segment++) {
        const b=bone(`finger${finger}-${segment}.${i===0?"L":"R"}`);
        let curl=style==='brawler'?[.84,1.04,.91]:style==='blades'?[.65,.90,.78]:style==='mage'||style==='glaive'?[.62,.86,.78]:[.68,.92,.76];
        if(style==='archer'&&i===1)curl=finger<=3?[.30,.64,.45]:[.35,.42,.30];
        const open=p.openHand&&(i===1||style==='brawler');
        if (b) {
          const signCurl=p.handSign==='rock'?[.95,1.15,.95]:p.handSign==='scissors'&&finger>=4?[1.02,1.13,.93]:[0,.03,.015];
          b.rotateX(THREE.MathUtils.lerp(curl[segment-1]*(open?.12:1),signCurl[segment-1],gestureProgress));
          if(segment===1&&gestureProgress){
            const spread=p.handSign==='paper'?[.13,.04,-.045,-.15][finger-2]:p.handSign==='scissors'?[.13,-.13,0,0][finger-2]:0;
            b.rotateZ(spread*sign*gestureProgress);
          }
        }
      }
      for(let segment=1;segment<=3;segment++){
        const thumb=digits[side][0][segment-1];if(thumb){
          const gripCurl=style==='brawler'?.48:style==='archer'&&i===1?.24:.36;
          const signCurl=p.handSign==='paper'?.025:[.60,.75,.38][segment-1];
          thumb.rotateX(THREE.MathUtils.lerp(gripCurl,signCurl,gestureProgress));
          const gripSpread=style==='blades'?.26:.18,signSpread=p.handSign==='paper'?.48:.27;
          thumb.rotateZ(sign*THREE.MathUtils.lerp(gripSpread,signSpread,gestureProgress));
        }
      }
    });
    model.updateWorldMatrix(true,true);
    legs.forEach((chain,i) => {
      const key=i===0?"footL":"footR", sign=i===0?1:-1, f=footRest[i];
      const target=authoredTarget(p,key,[f.x,f.y,f.z+(i===0?.11:-.11)]);
      const ankle=world(target);
      const lock=THREE.MathUtils.clamp(Number.isFinite(p.footLock?.[i])?p.footLock[i]:0,0,1);
      if(lock){
        const scale=model.getWorldScale(new THREE.Vector3()).y;
        ankle.y=THREE.MathUtils.lerp(ankle.y,f.y*scale+(Number.isFinite(p.floorY)?p.floorY:0),lock);
        // A straight standing leg has no room for an added fore/aft stance.
        // Keep the planted ankle on the floor and bring unreachable horizontal
        // targets within its measured sphere of reach rather than lifting it.
        const hip=point(chain[0]),reach=(lengths[i+2][0]+lengths[i+2][1])*scale*.9995;
        const vertical=Math.abs(hip.y-ankle.y);
        if(vertical<reach){
          const horizontal=new THREE.Vector2(ankle.x-hip.x,ankle.z-hip.z),limit=Math.sqrt(reach*reach-vertical*vertical);
          if(horizontal.length()>limit){horizontal.setLength(limit);ankle.x=hip.x+horizontal.x;ankle.z=hip.z+horizontal.y;}
        }
      }
      solve(chain,ankle,world([sign*.16,.8,1.4]),lengths[i+2],lock?THREE.MathUtils.lerp(.985,.9995,lock):.985);
      const worldRotation=model.getWorldQuaternion(new THREE.Quaternion()).multiply(footRotations[i]);
      if(lock){
        const orientation=new THREE.Euler().setFromQuaternion(model.getWorldQuaternion(new THREE.Quaternion()),'YXZ');
        const flat=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,orientation.y,0)).multiply(footRotations[i]);
        worldRotation.slerp(flat,lock);
      }
      chain[2].quaternion.copy(chain[2].parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(worldRotation));
    });
    model.updateWorldMatrix(true,true);
  }
  return {pose, shoulderY, arms:arms.map(x=>x[0]), elbows:arms.map(x=>x[1]), hands:arms.map(x=>x[2]), digits, legs:legs.map(x=>x[0]), feet:legs.map(x=>x[2]), head};
}
