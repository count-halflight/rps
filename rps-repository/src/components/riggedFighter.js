import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { createWardrobe } from "./wardrobe.js";
import { createPoseRig } from "./poseRig.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { FACIAL_TARGETS, facialExpressionWeights } from './facialExpressions.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Keep grip/state groups independent while batching their static details.
// A wrapped hilt used to draw every narrow band as another mesh and shadow.
function batchWeaponDetails(group){
  const materials=new Map();
  for(const mesh of group.children){
    if(!mesh.isMesh||Array.isArray(mesh.material)||mesh.isSkinnedMesh)continue;
    const items=materials.get(mesh.material)||[];items.push(mesh);materials.set(mesh.material,items);
  }
  for(const [material,meshes] of materials){
    if(meshes.length<2)continue;
    const geometries=meshes.map(mesh=>{
      mesh.updateMatrix();
      const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
      return geometry.applyMatrix4(mesh.matrix);
    });
    const geometry=mergeGeometries(geometries,false);
    if(!geometry){geometries.forEach(g=>g.dispose());continue;}
    geometry.computeBoundingSphere();geometry.computeBoundingBox();
    const merged=new THREE.Mesh(geometry,material);
    merged.name=(group.name||'Weapon')+'Detail'+material.type;
    merged.castShadow=meshes.some(mesh=>mesh.castShadow);
    merged.receiveShadow=meshes.some(mesh=>mesh.receiveShadow);
    for(const mesh of meshes)group.remove(mesh);
    group.add(merged);geometries.forEach(g=>g.dispose());
  }
}
export function createRiggedFighter(
  gltf,
  accent = "#83ffd6",
  style = "blades",
) {
  const root = new THREE.Group(),
    body = new THREE.Group(),
    model = clone(gltf.scene);
  const sourceMeshes=[];
  root.add(body);
  body.add(model);
  model.traverse((o) => {
    if (o.isMesh) {
      sourceMeshes.push(o);
      o.userData.originalVisibility??=o.visible;
      const materials=Array.isArray(o.material)?o.material:[o.material];
      // Eye layers, tiny stitches and ornaments need lighting, but their
      // silhouettes add no useful detail to an expensive shadow pass.
      o.castShadow = materials.some(m=>/^(Skin|Tailored jacket|Shirt|Woven trousers|Leather|Boot sole|Hair)(?:\b|$)/.test(m.name));
      o.receiveShadow = true;
      o.material = Array.isArray(o.material)
        ? o.material.map((m) => m.clone())
        : o.material.clone();
      if(o.morphTargetInfluences)o.morphTargetInfluences=[...o.morphTargetInfluences];
    }
  });
  model.updateMatrixWorld(true);
  const metadataHeight=gltf.asset?.extras?.standingHeight;
  const standingHeight=Number.isFinite(metadataHeight)&&metadataHeight>0?metadataHeight:2.10;
  const eyeHeight=['eyeL','eyeR'].reduce((sum,name)=>sum+(model.getObjectByName(name)?.getWorldPosition(new THREE.Vector3()).y??standingHeight*.92),0)/2;
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
  const rig = createPoseRig(model, body, style, standingHeight);
  const facialMeshes=[];
  model.traverse(o=>{if(o.isMesh&&o.morphTargetDictionary)facialMeshes.push(o);});
  const setExpression=(expression,time=0)=>{
    const weights=facialExpressionWeights(typeof expression==='string'?{expression}:expression,time);
    for(const mesh of facialMeshes)for(const name of FACIAL_TARGETS){
      const index=mesh.morphTargetDictionary[name];
      if(index!==undefined)mesh.morphTargetInfluences[index]=weights[name];
    }
    return weights;
  };
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
    m.castShadow = mat===edge||mat===steel||mat===grip;
    parent.add(m);
    return m;
  };
  hands.forEach((hand,handIndex) => {
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
    blade.name=handIndex===0?'EchoBladeL':'EchoBladeR';
    hand.add(blade);
    gear.scissors.push(blade);
    add(
      blade,
      new THREE.CylinderGeometry(0.019, 0.019, 0.13, 14),
      grip,
      [0, 0, 0],
    );
    for(let i=0;i<6;i++){const band=add(blade,new THREE.TorusGeometry(.020,.0024,6,20),steel,[0,-.050+i*.020,0]);band.rotation.x=Math.PI/2;}
    add(blade,new RoundedBoxGeometry(.093,.014,.030,3,.005),steel,[0,.071,0]);
    add(blade,new THREE.SphereGeometry(.024,16,10),brass,[0,-.075,0]);
    const shape=new THREE.Shape();
    shape.moveTo(-.025,.078);shape.lineTo(-.021,.33);shape.quadraticCurveTo(-.013,.395,.003,.43);shape.lineTo(.030,.33);shape.lineTo(.029,.078);shape.closePath();
    add(blade,new THREE.ExtrudeGeometry(shape,{depth:.016,bevelEnabled:true,bevelThickness:.0035,bevelSize:.0035,bevelSegments:3,steps:1}),edge,[0,0,-.008]);
    const inset=new THREE.Shape();inset.moveTo(-.010,.09);inset.lineTo(-.008,.31);inset.lineTo(.003,.39);inset.lineTo(.014,.32);inset.lineTo(.015,.09);inset.closePath();
    add(blade,new THREE.ExtrudeGeometry(inset,{depth:.019,bevelEnabled:false}),steel,[0,0,-.0095]);
    add(blade,new THREE.CylinderGeometry(.0018,.0018,.24,8),glow,[.013,.21,.011]);
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
  const sheaths=[],stowedBlades=[];
  let bladeState='drawn',drawProgress=1,reverseGrip=true;
  let weaponMode='normal';
  let rpsHand=null;
  let bowString;
  hands[0].add(kit);
  if (style === "blades") {
    gear.scissors.forEach((g) => (g.visible = true));
    const pelvisBone=bone('spine04');
    for(const [index,sign] of [[0,1],[1,-1]]){
      const sheath=new THREE.Group();sheath.name=index===0?'EchoSheathL':'EchoSheathR';
      const position=model.localToWorld(new THREE.Vector3(sign*.205,pelvis+.015,.055));
      pelvisBone.add(sheath);sheath.position.copy(pelvisBone.worldToLocal(position));
      sheath.quaternion.copy(pelvisBone.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(model.getWorldQuaternion(new THREE.Quaternion())));
      sheath.rotation.z+=sign*.15;
      add(sheath,new RoundedBoxGeometry(.070,.365,.037,3,.013),grip,[0,-.145,0]);
      add(sheath,new RoundedBoxGeometry(.080,.022,.043,3,.008),brass,[0,.038,0]);
      add(sheath,new RoundedBoxGeometry(.008,.30,.004,2,.002),glow,[.025,-.143,.021]);
      const stowed=gear.scissors[index].clone(true);stowed.name=index===0?'EchoStowedBladeL':'EchoStowedBladeR';
      stowed.position.set(0,.082,0);stowed.rotation.z=Math.PI;sheath.add(stowed);stowed.visible=false;
      sheaths.push(sheath);stowedBlades.push(stowed);
    }
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
  for(const group of [...Object.values(gear).flat(),kit,...sheaths,...stowedBlades])batchWeaponDetails(group);
  const orient = p => {
    const orientation=body.getWorldQuaternion(new THREE.Quaternion());
    hands.forEach((hand,i)=>{
      const group=style==='blades'?gear.scissors[i]:style==='brawler'?gear.rock[i]:i===0?kit:null;
      if(!group)return;
      group.position.copy(palms[i]);
      const reverse=style==='blades'&&p.grip!=='forward';
      const tilt=new THREE.Quaternion().setFromEuler(new THREE.Euler(p.weaponPitch??.18,p.weaponSweep??0,(style==='glaive'?-.55:i===0?.16:-.16)+(reverse?Math.PI:0)));
      group.quaternion.copy(hand.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation).multiply(tilt));
    });
    model.updateWorldMatrix(true,true);
  };
  const supportReach=arms[1].getWorldPosition(new THREE.Vector3()).distanceTo(elbows[1].getWorldPosition(new THREE.Vector3()))+elbows[1].getWorldPosition(new THREE.Vector3()).distanceTo(hands[1].getWorldPosition(new THREE.Vector3()));
  const refreshWeaponVisibility=()=>{
    const inherited=weaponMode==='normal';
    kit.visible=inherited&&rpsHand!=='L'&&['mage','glaive','archer'].includes(style);
    gear.rock.forEach((g,i)=>{g.visible=inherited&&style==='brawler'&&rpsHand!==(i===0?'L':'R');});
    gear.paper.forEach(g=>{g.visible=false;});
    gear.scissors.forEach((g,i)=>{g.visible=inherited&&style==='blades'&&drawProgress>=.5&&rpsHand!==(i===0?'L':'R');});
    sheaths.forEach(g=>{g.visible=inherited&&style==='blades';});
    stowedBlades.forEach(g=>{g.visible=inherited&&style==='blades'&&drawProgress<.5;});
  };
  const setWeaponMode=(mode)=>{
    weaponMode=['shield-hammer','gauntlets'].includes(mode)?mode:'normal';
    refreshWeaponVisibility();return weaponMode;
  };
  let wardrobe,gripY=-.4,gripZ=0;
  const pose = (p={},time=0) => {
    rpsHand=['L','R'].includes(p.rpsHand)&&['rock','paper','scissors'].includes(p.handSign)?p.rpsHand:['L','R'].includes(p.freeHand)?p.freeHand:null;
    if(p.weaponMode!==undefined)setWeaponMode(p.weaponMode);
    rig.pose(p,time);
    orient(p);
    setExpression(p,time);
    if(style==='blades'){
      reverseGrip=p.grip!=='forward';
      bladeState=['drawn','sheathed','drawing'].includes(p.bladeState)?p.bladeState:'drawn';
      drawProgress=bladeState==='sheathed'?0:bladeState==='drawn'?1:THREE.MathUtils.clamp(Number.isFinite(p.drawProgress)?p.drawProgress:0,0,1);
      gear.scissors.forEach((g,i)=>{g.visible=drawProgress>=.5;stowedBlades[i].visible=drawProgress<.5;stowedBlades[i].position.y=.082+drawProgress*.32;});
      for(let i=1;i<=3;i++){
        const pony=bone('echo_ponytail'+i);if(pony){pony.rotation.x+=p.reduced?0:Math.sin(time*3.1-i*.85)*.075+(p.torsoPitch||0)*.13;pony.rotation.z+=p.reduced?0:Math.sin(time*2.2-i*.9)*.075-(p.torsoYaw||0)*.15;}
      }
      const tail=bone('echo_jacket_tail');if(tail){tail.rotation.x+=p.reduced?0:Math.sin(time*2.6)*.055+Math.abs(p.torsoPitch||0)*.11;tail.rotation.y+=p.reduced?0:Math.sin(time*1.8)*.07+(p.torsoYaw||0)*.11;}
      model.updateWorldMatrix(true,true);
    }
    if(weaponMode==='normal'&&!rpsHand&&(style==='glaive'||style==='archer')){
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
        held={...held,handL:model.worldToLocal(lead).toArray(),handLSpace:'native'};rig.pose(held,time);orient(held);
      }
      // The wrist orientation changes its palm offset. Iterate the target
      // instead of pinning the wrist itself to the weapon centreline.
      for(let i=0;i<4;i++){
        const grip=kit.localToWorld(new THREE.Vector3(0,gripY,gripZ));
        const palmOffset=hands[1].localToWorld(palms[1].clone()).sub(hands[1].getWorldPosition(new THREE.Vector3()));
        const wrist=model.worldToLocal(grip.sub(palmOffset));
        rig.pose({...held,handR:wrist.toArray(),handRSpace:'native'},time);orient(held);
        if(hands[1].localToWorld(palms[1].clone()).distanceTo(kit.localToWorld(new THREE.Vector3(0,gripY,gripZ)))<.002)break;
      }
    }
    wardrobe?.update(time,p.reduced,p.appearanceState);
    refreshWeaponVisibility();
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
    feet:rig.feet,
    hands,
    digits:rig.digits,
    pose,
    setExpression,
    setWeapon,
    setWeaponMode,
    get weaponMode(){return weaponMode;},
    glow,
    style,
    standingHeight,
    eyeHeight,
    model,
    weaponGroups:{blades:gear.scissors,sheaths,stowedBlades},
    weaponState:()=>({bladeState,drawProgress,blades:gear.scissors.map(g=>g.visible),sheaths:stowedBlades.map(g=>g.visible),reverseGrip}),
    equipAppearance(appearance={}){wardrobe?.dispose();wardrobe=createWardrobe({root,body,model},appearance);
      const bulwark=appearance.boss&&appearance.model==='bulwark';
      setWeaponMode(bulwark?'shield-hammer':'normal');
      for(const mesh of sourceMeshes){
        const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
        if(materials.every(m=>/^Hair(?: strands)?(?:\b|$)/.test(m.name))){
          mesh.userData.originalVisibility??=mesh.visible;
          mesh.visible=bulwark?false:mesh.userData.originalVisibility;
        }
      }
      const tint=new THREE.Color(appearance.color||accent);
      glow.color.copy(tint);glow.emissive.copy(tint);
      model.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material]){
        m.userData.originalColor??=m.color.clone();m.color.copy(m.userData.originalColor);
        // Authored leather albedo already contains its intended colour and
        // wear. The old flat-colour tint crushed those textured coats to a
        // near-black mass; retain it only for untextured encounter clothing.
        if(appearance.id&&/jacket/i.test(m.name)&&!m.map)m.color.lerp(tint.clone().multiplyScalar(.18),.7);
        if(appearance.id&&/Stitching/.test(m.name))m.color.lerp(tint,.55);
        if(appearance.id&&/^Skin/.test(m.name))m.color.multiplyScalar(.94+((appearance.lookSeed||0)%5)*.03);
        if(bulwark){
          if(/^(Tailored jacket|Shirt|Woven trousers|Leather|Boot sole)(?:\b|$)/.test(m.name))m.color.set('#11181c');
          if(/^Stitching(?:\b|$)/.test(m.name))m.color.set('#6d6048');
        }
      }});
    },
    setAppearanceState(state){wardrobe?.setState?.(state);},
    gripPoints:()=>({leftPalm:hands[0].localToWorld(palms[0].clone()),rightPalm:hands[1].localToWorld(palms[1].clone()),shaft:kit.localToWorld(new THREE.Vector3(0,gripY,gripZ)),bladeGrips:gear.scissors.map(g=>g.getWorldPosition(new THREE.Vector3()))}),
    disposeAppearance(){wardrobe?.dispose();},
    shoulderY: rig.shoulderY,
    weaponSegments: () => {
      if(weaponMode!=='normal')return [];
      root.updateWorldMatrix(true,true);
      const groups = style === 'blades' ? gear.scissors.filter(g=>g.visible) : style === 'glaive' ? [kit] : [];
      return groups.map(g=>[g.localToWorld(new THREE.Vector3(0,style==='blades'?.078:.12,0)),g.localToWorld(new THREE.Vector3(0,style==='glaive'?1.30:.43,0))]);
    },
  };
}
