import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { createWardrobe } from "./wardrobe.js";
import { createPoseRig } from "./poseRig.js";
export function createRiggedFighter(
  gltf,
  accent = "#83ffd6",
  style = "blades",
) {
  const root = new THREE.Group(),
    body = new THREE.Group(),
    model = clone(gltf.scene);
  root.add(body);
  body.add(model);
  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      o.material = Array.isArray(o.material)
        ? o.material.map((m) => m.clone())
        : o.material.clone();
    }
  });
  model.updateMatrixWorld(true);
  const pelvis = model.getObjectByName("spine04").getWorldPosition(new THREE.Vector3()).y;
  body.position.y = pelvis;
  model.position.y -= pelvis;
  model.updateMatrixWorld(true);
  const bone = (name) => model.getObjectByName(name.replaceAll(".", "")),
    arms = [bone("upperarm01.L"), bone("upperarm01.R")],
    elbows = [bone("lowerarm01.L"), bone("lowerarm01.R")],
    legs = [bone("upperleg01.L"), bone("upperleg01.R")],
    hands = [bone("wrist.L"), bone("wrist.R")],
    head = bone("head");
  const rig = createPoseRig(model, body, style);
  const palms = hands.map((hand,i) => hand.worldToLocal(bone(`finger3-1.${i===0?"L":"R"}`).getWorldPosition(new THREE.Vector3())).multiplyScalar(.7));
  const steel = new THREE.MeshStandardMaterial({
      color: "#70797c",
      metalness: 0.7,
      roughness: 0.32,
    }),
    glow = new THREE.MeshStandardMaterial({
      color: accent,
      emissive: accent,
      emissiveIntensity: 1.8,
      roughness: 0.45,
    });
  const gear = { rock: [], paper: [], scissors: [] };
  const add = (parent, geo, mat, pos) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  hands.forEach((hand) => {
    const rock = new THREE.Group();
    hand.add(rock);
    gear.rock.push(rock);
    add(
      rock,
      new THREE.BoxGeometry(0.11, 0.065, 0.045),
      steel,
      [0, 0.115, 0.015],
    );
    for (let i = 0; i < 3; i++)
      add(rock, new THREE.BoxGeometry(0.027, 0.023, 0.017), glow, [
        (i - 1) * 0.035,
        0.147,
        0.028,
      ]);
    const blade = new THREE.Group();
    hand.add(blade);
    gear.scissors.push(blade);
    add(
      blade,
      new THREE.CylinderGeometry(0.022, 0.022, 0.2, 10),
      steel,
      [0, 0.04, 0],
    );
    add(blade, new THREE.BoxGeometry(0.19, 0.018, 0.035), steel, [0, -0.04, 0]);
    const shape=new THREE.Shape();
    shape.moveTo(-.025,.10);shape.lineTo(-.025,.82);shape.lineTo(0,.98);shape.lineTo(.033,.84);shape.lineTo(.028,.10);shape.closePath();
    add(blade,new THREE.ExtrudeGeometry(shape,{depth:.012,bevelEnabled:true,bevelThickness:.003,bevelSize:.003,bevelSegments:2,steps:1}),steel,[0,0,-.006]);
    add(blade,new THREE.CylinderGeometry(.003,.003,.74,6),glow,[.03,.47,0]);
    const field = new THREE.Group();
    hand.add(field);
    gear.paper.push(field);
    add(
      field,
      new THREE.TorusGeometry(0.16, 0.007, 4, 36),
      glow,
      [0, 0.1, 0.09],
    );
  });
  Object.values(gear)
    .flat()
    .forEach((g) => (g.visible = false));
  const kit = new THREE.Group();
  let bowString;
  hands[0].add(kit);
  if (style === "blades") {
    gear.scissors.forEach((g) => (g.visible = true));
  } else if (style === "brawler") {
    gear.rock.forEach((g) => {
      g.visible = true;
      g.scale.setScalar(1.7);
    });
  } else if (style === "mage" || style === "glaive") {
    add(
      kit,
      new THREE.CylinderGeometry(0.025, 0.025, 1.9, 10),
      steel,
      [0, -0.15, 0],
    );
    if (style === "mage") {
      const crystal = add(
        kit,
        new THREE.OctahedronGeometry(0.14),
        glow,
        [0, 0.89, 0],
      );
      crystal.scale.y = 1.8;
      add(kit, new THREE.TorusGeometry(0.2, 0.018, 6, 24), steel, [0, 0.85, 0]);
    } else {
      const shape=new THREE.Shape();
      shape.moveTo(0,.65);shape.bezierCurveTo(.05,.91,.21,1.21,.10,1.45);
      shape.bezierCurveTo(.02,1.28,-.10,1.13,-.05,.72);shape.closePath();
      add(kit,new THREE.ExtrudeGeometry(shape,{depth:.018,bevelEnabled:true,bevelThickness:.004,bevelSize:.004,bevelSegments:3}),steel,[0,0,-.009]);
      add(kit,new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(.02,.77,0),new THREE.Vector3(.15,1.18,0),new THREE.Vector3(.10,1.42,0)),24,.004,6,false),glow,[0,0,0]);
      add(kit, new THREE.BoxGeometry(0.34, 0.04, 0.08), steel, [0, 0.68, 0]);
    }
  } else if (style === "archer") {
    const points = [];
    for (let i = 0; i <= 24; i++) {
      const a = -Math.PI / 2 + (i / 24) * Math.PI;
      points.push(new THREE.Vector3(0, Math.sin(a) * 0.65, Math.cos(a) * 0.32));
    }
    add(
      kit,
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points),
        24,
        0.025,
        6,
        false,
      ),
      steel,
      [0, 0.05, 0],
    );
    const stringGeometry = new THREE.BufferGeometry();
    stringGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0,-.60,0,0,.05,0,0,.70,0],3));
    bowString = new THREE.Line(stringGeometry, new THREE.LineBasicMaterial({color:accent}));
    kit.add(bowString);
    add(
      kit,
      new THREE.CylinderGeometry(0.018, 0.018, 0.18, 8),
      steel,
      [0, 0.05, 0],
    );
    const shaft = add(
      kit,
      new THREE.CylinderGeometry(0.006, 0.006, 0.65, 5),
      steel,
      [0, .05, .34],
    );
    shaft.rotation.x = Math.PI / 2;
  }
  const orient = p => {
    const orientation=body.getWorldQuaternion(new THREE.Quaternion());
    hands.forEach((hand,i)=>{
      const group=style==='blades'?gear.scissors[i]:i===0?kit:null;
      if(!group)return;
      group.position.copy(palms[i]);
      const tilt=new THREE.Quaternion().setFromEuler(new THREE.Euler(p.weaponPitch??.18,p.weaponSweep??0,style==='glaive'?-.55:i===0?.16:-.16));
      group.quaternion.copy(hand.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation).multiply(tilt));
    });
    model.updateWorldMatrix(true,true);
  };
  const supportReach=arms[1].getWorldPosition(new THREE.Vector3()).distanceTo(elbows[1].getWorldPosition(new THREE.Vector3()))+elbows[1].getWorldPosition(new THREE.Vector3()).distanceTo(hands[1].getWorldPosition(new THREE.Vector3()));
  let wardrobe,gripY=-.4,gripZ=0;
  const pose = (p={},time=0) => {
    rig.pose(p,time);
    orient(p);
    if(style==='glaive'||style==='archer'){
      let held={...p};
      // Let the support hand slide along the shaft. A fixed low grip was
      // physically unreachable when the lead hand swept below the waist.
      for(let pass=0;pass<5;pass++){
        const shoulder=arms[1].getWorldPosition(new THREE.Vector3());
        if(style==='glaive'){
          gripY=THREE.MathUtils.clamp(kit.worldToLocal(shoulder.clone()).y,-.55,.55);
          if(Math.abs(gripY)<.18){const lo=kit.localToWorld(new THREE.Vector3(0,-.18,0)),hi=kit.localToWorld(new THREE.Vector3(0,.18,0));gripY=lo.distanceTo(shoulder)<hi.distanceTo(shoulder)?-.18:.18;}
          gripZ=0;
        }else{gripY=.05;gripZ=-(p.draw||0)*.55;}
        const grip=kit.localToWorld(new THREE.Vector3(0,gripY,gripZ));
        const offset=hands[1].localToWorld(palms[1].clone()).sub(hands[1].getWorldPosition(new THREE.Vector3()));
        const target=grip.sub(offset),delta=target.sub(shoulder),excess=delta.length()-supportReach*model.getWorldScale(new THREE.Vector3()).y*.93;
        if(excess<.005)break;
        // Keep both hands reachable rather than stretching a joint or
        // displaying the support hand in empty space beside the weapon.
        const lead=hands[0].getWorldPosition(new THREE.Vector3()).addScaledVector(delta.normalize(),-excess);
        held={...held,handL:model.worldToLocal(lead).toArray()};rig.pose(held,time);orient(held);
      }
      // The wrist orientation changes its palm offset. Iterate the target
      // instead of pinning the wrist itself to the weapon centreline.
      for(let i=0;i<4;i++){
        const grip=kit.localToWorld(new THREE.Vector3(0,gripY,gripZ));
        const palmOffset=hands[1].localToWorld(palms[1].clone()).sub(hands[1].getWorldPosition(new THREE.Vector3()));
        const wrist=model.worldToLocal(grip.sub(palmOffset));
        rig.pose({...held,handR:wrist.toArray()},time);orient(held);
        if(hands[1].localToWorld(palms[1].clone()).distanceTo(kit.localToWorld(new THREE.Vector3(0,gripY,gripZ)))<.002)break;
      }
    }
    wardrobe?.update(time,p.reduced);
    if(bowString){
      bowString.geometry.attributes.position.setZ(1,-(p.draw || 0)*.55);
      bowString.geometry.attributes.position.needsUpdate=true;
    }
  };
  const setWeapon = (id) => {
    glow.emissiveIntensity = id ? 1.8 : 0.65;
  };
  pose();
  setWeapon("rock");
  return {
    root,
    body,
    head,
    arms,
    elbows,
    legs,
    hands,
    pose,
    setWeapon,
    glow,
    style,
    model,
    equipAppearance(appearance){wardrobe?.dispose();wardrobe=createWardrobe({root,body,model},appearance);
      model.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(/jacket/i.test(m.name)){
        m.userData.originalColor??=m.color.clone();m.color.copy(m.userData.originalColor);
        if(appearance.id)m.color.lerp(new THREE.Color(appearance.color||accent).multiplyScalar(.07),.65);
      }});
    },
    gripPoints:()=>({rightPalm:hands[1].localToWorld(palms[1].clone()),shaft:kit.localToWorld(new THREE.Vector3(0,gripY,gripZ))}),
    disposeAppearance(){wardrobe?.dispose();},
    shoulderY: rig.shoulderY,
    weaponSegments: () => {
      root.updateWorldMatrix(true,true);
      const groups = style === 'blades' ? gear.scissors : style === 'glaive' ? [kit] : [];
      return groups.map(g=>[g.localToWorld(new THREE.Vector3(0,.12,0)),g.localToWorld(new THREE.Vector3(0,style==='glaive'?1.30:.98,0))]);
    },
  };
}
