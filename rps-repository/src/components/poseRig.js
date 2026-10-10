import * as THREE from "three";

// Place both joints of a limb, preserving its measured lengths. Rotating just
// the shoulder made the old fighters slide with rigid elbows and open hands.
export function createPoseRig(model, body, style) {
  const bone = (name) => model.getObjectByName(name.replaceAll(".", ""));
  const arms = ["L", "R"].map((s) => [bone(`upperarm01.${s}`), bone(`lowerarm01.${s}`), bone(`wrist.${s}`)]);
  const legs = ["L", "R"].map((s) => [bone(`upperleg01.${s}`), bone(`lowerleg01.${s}`), bone(`foot.${s}`)]);
  const spines = [bone("spine02"), bone("spine01")], head = bone("head");
  const rest = new Map();
  model.traverse((b) => { if (b.isBone) rest.set(b, b.quaternion.clone()); });
  model.updateMatrixWorld(true);
  const local = (b) => model.worldToLocal(b.getWorldPosition(new THREE.Vector3()));
  const shoulderY = local(arms[0][0]).y;
  const footRest = legs.map((l) => local(l[2]));
  const modelRotation = model.getWorldQuaternion(new THREE.Quaternion());
  const footRotations = legs.map(l=>modelRotation.clone().invert().multiply(l[2].getWorldQuaternion(new THREE.Quaternion())));
  const lengths = [...arms, ...legs].map(([a,b,c]) => [a.getWorldPosition(new THREE.Vector3()).distanceTo(b.getWorldPosition(new THREE.Vector3())), b.getWorldPosition(new THREE.Vector3()).distanceTo(c.getWorldPosition(new THREE.Vector3()))]);
  const world = (v) => model.localToWorld(new THREE.Vector3(...v));
  const point = (b) => b.getWorldPosition(new THREE.Vector3());
  function aim(b, end, target) {
    const start = point(b), from = point(end).sub(start).normalize(), to = target.clone().sub(start).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(from, to);
    const parent = b.parent.getWorldQuaternion(new THREE.Quaternion());
    b.quaternion.copy(parent.clone().invert().multiply(q).multiply(parent).multiply(b.quaternion));
    b.updateWorldMatrix(false, true);
  }
  function solve(chain, target, pole, lens) {
    const [upper, lower, end] = chain, start = point(upper);
    const direction = target.clone().sub(start), rawDistance = direction.length();
    direction.normalize();
    const scale = model.getWorldScale(new THREE.Vector3()).y;
    // Lengths were sampled at scale one. The arena scales a complete fighter.
    const l1 = lens[0]*scale, l2 = lens[1]*scale;
    const d = THREE.MathUtils.clamp(rawDistance, Math.abs(l1-l2)+.001, (l1+l2)*.985);
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
    spines[0].rotation.x += (p.torsoPitch ?? p.body ?? 0)*.35;
    spines[1].rotation.y += (p.torsoYaw || 0)*.55;
    spines[1].rotation.z += (p.torsoLean || 0)*.3;
    head.rotation.y += p.headYaw ?? Math.sin(time*.7)*.025;
    head.rotation.x += p.headPitch || 0;
    const jaw=bone('jaw');if(jaw)jaw.rotateX(p.headPitch?-.08:.004*Math.sin(time*.4));
    const blink=Math.max(0,1-Math.abs((time%4.8)-.15)/.11);
    for(const side of ['L','R'])for(const name of ['oculi01','oculi02']){
      const lid=bone(`${name}.${side}`);if(lid)lid.rotateX(blink*(name==='oculi01'?.12:-.08));
    }
    model.updateWorldMatrix(true,true);
    const targets = idle();
    const breathe = Math.sin(time*2.3)*.009;
    arms.forEach((chain,i) => {
      const key = i===0?"handL":"handR", sign=i===0?1:-1;
      let target = p[key] || targets[i];
      target = [target[0],target[1]+breathe,target[2]];
      solve(chain,world(target),world([sign*.65,shoulderY-.52,-.18]),lengths[i]);
      const fingerRoot=bone(`finger3-1.${i===0?"L":"R"}`);
      if(fingerRoot) {
        const forward=world([target[0],target[1]-.18,target[2]+.5]);
        aim(chain[2],fingerRoot,forward);
      }
      // Fingers wrap toward the palm. Curling only one joint left a claw shape.
      for (let finger=2;finger<=5;finger++) for (let segment=1;segment<=3;segment++) {
        const b=bone(`finger${finger}-${segment}.${i===0?"L":"R"}`);
        if (b) b.rotateX((segment===1?.55:.72)*(p.openHand&&i===1 ? .10 : style==='archer'&&i===1&&finger<=3?.45:1));
      }
      for(let segment=1;segment<=3;segment++){
        const thumb=bone(`finger1-${segment}.${i===0?'L':'R'}`);if(thumb){thumb.rotateX(.35);thumb.rotateZ((i===0?1:-1)*.18);}
      }
    });
    model.updateWorldMatrix(true,true);
    legs.forEach((chain,i) => {
      const key=i===0?"footL":"footR", sign=i===0?1:-1, f=footRest[i];
      const target=p[key] || [f.x,f.y,f.z+(i===0?.11:-.11)];
      solve(chain,world(target),world([sign*.16,.8,1.4]),lengths[i+2]);
      const worldRotation=model.getWorldQuaternion(new THREE.Quaternion()).multiply(footRotations[i]);
      chain[2].quaternion.copy(chain[2].parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(worldRotation));
    });
    model.updateWorldMatrix(true,true);
  }
  return {pose, shoulderY, arms:arms.map(x=>x[0]), elbows:arms.map(x=>x[1]), hands:arms.map(x=>x[2]), legs:legs.map(x=>x[0]), feet:legs.map(x=>x[2]), head};
}
