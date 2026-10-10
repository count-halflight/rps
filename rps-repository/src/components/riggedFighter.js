import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { createWardrobe } from "./wardrobe.js";
import { createPoseRig } from "./poseRig.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
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
      color: "#485563",
      metalness: 0.85,
      roughness: 0.3,
    }),
    glow = new THREE.MeshStandardMaterial({
      color: accent,
      emissive: accent,
      emissiveIntensity: 1.8,
      roughness: 0.45,
    });
  const edge = new THREE.MeshStandardMaterial({color:'#becbd2',metalness:.88,roughness:.22});
  const grip = new THREE.MeshStandardMaterial({color:'#161b22',roughness:.85});
  const brass = new THREE.MeshStandardMaterial({color:'#907347',metalness:.76,roughness:.34});
  const prism = new THREE.MeshPhysicalMaterial({color:'#755396',metalness:.17,roughness:.12,clearcoat:1,clearcoatRoughness:.10,emissive:'#57358c',emissiveIntensity:.3,transparent:true,opacity:.92});
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
    const glove=add(rock,new THREE.SphereGeometry(1,24,16),grip,[0,.018,0]);glove.scale.set(.067,.084,.060);
    add(rock,new RoundedBoxGeometry(.105,.048,.043,3,.012),steel,[0,.061,.027]);
    for(let i=0;i<4;i++){
      const knuckle=add(rock,new THREE.SphereGeometry(.017,12,8),edge,[(i-1.5)*.025,.078,.043]);knuckle.scale.set(1,.65,.65);
      const wrap=add(rock,new THREE.TorusGeometry(.057,.004,6,28),brass,[0,-.038+i*.013,0]);wrap.rotation.x=Math.PI/2;wrap.scale.z=.78;
    }
    add(rock,new RoundedBoxGeometry(.036,.026,.015,2,.006),glow,[0,.025,.058]);
    const blade = new THREE.Group();
    hand.add(blade);
    gear.scissors.push(blade);
    add(
      blade,
      new THREE.CylinderGeometry(0.022, 0.022, 0.2, 10),
      grip,
      [0, 0.04, 0],
    );
    for(let i=0;i<7;i++){const band=add(blade,new THREE.TorusGeometry(.023,.003,5,16),brass,[0,-.037+i*.024,0]);band.rotation.x=Math.PI/2;}
    add(blade,new RoundedBoxGeometry(.17,.020,.034,3,.008),steel,[0,-.04,0]);
    add(blade,new THREE.SphereGeometry(.026,16,10),brass,[0,-.075,0]);
    const shape=new THREE.Shape();
    shape.moveTo(-.028,.10);shape.lineTo(-.022,.73);shape.quadraticCurveTo(-.012,.82,.004,.88);shape.lineTo(.031,.74);shape.lineTo(.031,.10);shape.closePath();
    add(blade,new THREE.ExtrudeGeometry(shape,{depth:.016,bevelEnabled:true,bevelThickness:.0035,bevelSize:.0035,bevelSegments:3,steps:1}),edge,[0,0,-.008]);
    const inset=new THREE.Shape();inset.moveTo(-.010,.12);inset.lineTo(-.008,.65);inset.lineTo(.003,.79);inset.lineTo(.014,.68);inset.lineTo(.015,.12);inset.closePath();
    add(blade,new THREE.ExtrudeGeometry(inset,{depth:.019,bevelEnabled:false}),steel,[0,0,-.0095]);
    add(blade,new THREE.CylinderGeometry(.0025,.0025,.49,6),glow,[.013,.37,.011]);
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
      g.scale.setScalar(1.12);
    });
  } else if (style === "mage" || style === "glaive") {
    add(
      kit,
      new THREE.CylinderGeometry(0.025, 0.025, 1.9, 10),
      steel,
      [0, -0.15, 0],
    );
    for(let i=0;i<9;i++){const band=add(kit,new THREE.TorusGeometry(.027,.003,6,18),brass,[0,-.37+i*.035,0]);band.rotation.x=Math.PI/2;}
    for(const y of [-1.08,.69]){const collar=add(kit,new THREE.CylinderGeometry(.036,.036,.047,16),brass,[0,y,0]);}
    if (style === "mage") {
      const crystal = add(
        kit,
        new THREE.IcosahedronGeometry(0.10,0),
        prism,
        [0, 0.89, 0],
      );
      crystal.scale.y = 1.75;
      const halo=add(kit,new THREE.TorusGeometry(.15,.008,8,40),brass,[0,.85,0]);halo.rotation.y=.65;
      const inner=add(kit,new THREE.TorusGeometry(.113,.004,6,40),edge,[0,.85,0]);inner.rotation.x=.55;
      for(const x of [-.08,.08]){const prong=add(kit,new THREE.ConeGeometry(.019,.20,8),edge,[x,.78,0]);prong.rotation.z=x<0?-.45:.45;}
    } else {
      const shape=new THREE.Shape();
      shape.moveTo(-.024,.69);shape.bezierCurveTo(-.006,.90,.16,1.15,.11,1.36);
      shape.bezierCurveTo(.07,1.23,-.065,1.08,-.052,.77);shape.closePath();
      add(kit,new THREE.ExtrudeGeometry(shape,{depth:.024,bevelEnabled:true,bevelThickness:.004,bevelSize:.004,bevelSegments:3}),edge,[0,0,-.012]);
      const inset=new THREE.Shape();inset.moveTo(-.011,.76);inset.bezierCurveTo(.012,.95,.092,1.09,.102,1.23);inset.bezierCurveTo(.03,1.12,-.030,.96,-.028,.81);inset.closePath();
      add(kit,new THREE.ExtrudeGeometry(inset,{depth:.029,bevelEnabled:false}),steel,[0,0,-.0145]);
      add(kit,new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(-.017,.78,.018),new THREE.Vector3(.07,1.03,.018),new THREE.Vector3(.099,1.24,.018)),28,.0025,6,false),glow,[0,0,0]);
      add(kit,new RoundedBoxGeometry(.19,.030,.051,3,.010),brass,[0,.68,0]);
      const butt=add(kit,new THREE.ConeGeometry(.032,.16,12),edge,[0,-1.18,0]);butt.rotation.z=Math.PI;
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
        48,
        0.028,
        10,
        false,
      ),
      steel,
      [0, 0.05, 0],
    );
    for(const sign of [-1,1]){
      const limb=add(kit,new RoundedBoxGeometry(.055,.21,.045,3,.008),brass,[0,.05+sign*.44,.235]);limb.rotation.x=sign*.48;
      add(kit,new THREE.SphereGeometry(.045,16,10),steel,[0,.05+sign*.61,.025]);
    }
    const stringGeometry = new THREE.BufferGeometry();
    stringGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0,-.60,0,0,.05,0,0,.70,0],3));
    bowString = new THREE.Line(stringGeometry, new THREE.LineBasicMaterial({color:accent}));
    kit.add(bowString);
    add(
      kit,
      new THREE.CylinderGeometry(0.018, 0.018, 0.18, 8),
      grip,
      [0, 0.05, 0],
    );
    const shaft = add(
      kit,
      new THREE.CylinderGeometry(0.006, 0.006, 0.65, 5),
      steel,
      [0, .05, .34],
    );
    shaft.rotation.x = Math.PI / 2;
    const arrowHead=add(kit,new THREE.ConeGeometry(.026,.10,4),edge,[0,.05,.70]);arrowHead.rotation.x=Math.PI/2;
    for(const x of [-.014,.014])add(kit,new THREE.BoxGeometry(.003,.040,.080),brass,[x,.05,.055]);
  }
  const orient = p => {
    const orientation=body.getWorldQuaternion(new THREE.Quaternion());
    hands.forEach((hand,i)=>{
      const group=style==='blades'?gear.scissors[i]:style==='brawler'?gear.rock[i]:i===0?kit:null;
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
      const tint=new THREE.Color(appearance.color||accent);
      glow.color.copy(tint);glow.emissive.copy(tint);
      model.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material]){
        m.userData.originalColor??=m.color.clone();m.color.copy(m.userData.originalColor);
        if(appearance.id&&/jacket/i.test(m.name))m.color.lerp(tint.clone().multiplyScalar(.18),.7);
        if(appearance.id&&/Stitching/.test(m.name))m.color.lerp(tint,.55);
        if(appearance.id&&/^Skin/.test(m.name))m.color.multiplyScalar(.94+((appearance.lookSeed||0)%5)*.03);
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
