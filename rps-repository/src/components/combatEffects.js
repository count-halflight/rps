import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

// Trails follow the actual weapon edges for the last 160 milliseconds. Their
// lifetime is independent of frame rate, so a stalled frame or a stepped capture
// clock cannot bridge seconds of movement with a giant translucent triangle.
export function createCombatEffects(scene) {
  const root=new THREE.Group();scene.add(root);
  const histories=[[],[]],positions=histories.map(()=>new Float32Array(12*18));
  const trails=positions.map(data=>{
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(data,3));g.setDrawRange(0,0);
    const m=new THREE.MeshBasicMaterial({color:'#9eeedd',transparent:true,opacity:.45,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
    const mesh=new THREE.Mesh(g,m);mesh.frustumCulled=false;root.add(mesh);return mesh;
  });
  const sparkData=new Float32Array(64*6),sparkGeometry=new THREE.BufferGeometry();
  sparkGeometry.setAttribute('position',new THREE.BufferAttribute(sparkData,3));
  const sparks=new THREE.LineSegments(sparkGeometry,new THREE.LineBasicMaterial({color:'#ffd7a6',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));root.add(sparks);
  const dustData=new Uint8Array(32*32*4);
  for(let y=0;y<32;y++)for(let x=0;x<32;x++){
    const d=Math.hypot((x-15.5)/16,(y-15.5)/16),i=(y*32+x)*4;
    dustData.set([190,177,158,Math.round(Math.max(0,1-d)**2*90)],i);
  }
  const dustMap=new THREE.DataTexture(dustData,32,32);dustMap.needsUpdate=true;
  const dust=Array.from({length:10},()=>{
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:dustMap,transparent:true,depthWrite:false}));root.add(s);return s;
  });
  const shards=new THREE.InstancedMesh(new THREE.OctahedronGeometry(.10),new THREE.MeshPhysicalMaterial({color:'#beacff',emissive:'#7760ad',emissiveIntensity:.5,metalness:.4,roughness:.13}),12);
  root.add(shards);const dummy=new THREE.Object3D();
  const contactLight=new THREE.PointLight('#ffe2b1',0,5);root.add(contactLight);
  let lastId=null,ghosts=[],history=[];
  const ghostMaterial=new THREE.MeshBasicMaterial({color:'#83ffd6',transparent:true,opacity:.10,depthWrite:false,blending:THREE.AdditiveBlending});
  const clearGhosts=()=>{ghosts.forEach(g=>{const skeletons=new Set();g.traverse(o=>{if(o.isSkinnedMesh)skeletons.add(o.skeleton);});skeletons.forEach(s=>s.dispose());root.remove(g);});ghosts=[];history=[];};
  return {
    reset(){root.visible=false;histories.forEach(h=>h.length=0);trails.forEach(t=>t.geometry.setDrawRange(0,0));lastId=null;clearGhosts();},
    update(attacker,frame,a,sign,time,low=false){
      root.visible=true;
      if(lastId!==a.id){histories.forEach(h=>h.length=0);lastId=a.id;clearGhosts();
        if(!low&&/ghost|afterimage|thousand|tempest/.test(frame.vfx))for(let i=0;i<3;i++){
          const ghost=clone(attacker.root);ghost.traverse(o=>{if(o.isMesh){o.material=ghostMaterial;o.castShadow=false;}});root.add(ghost);ghosts.push(ghost);
        }
      }
      if(ghosts.length){const bones={};attacker.root.traverse(o=>{if(o.isBone)bones[o.name]=o.quaternion.toArray();});
        history.push({x:attacker.root.position.x,y:attacker.root.position.y,z:attacker.root.position.z,r:attacker.root.rotation.y,bones});if(history.length>12)history.shift();}
      ghosts.forEach((ghost,i)=>{const past=history[Math.max(0,history.length-1-(i+1)*3)];ghost.visible=frame.progress>.25&&frame.progress<a.impactAt+.09;if(past){ghost.position.set(past.x,past.y,past.z);ghost.rotation.y=past.r;ghost.scale.copy(attacker.root.scale);ghost.traverse(o=>{if(o.isBone&&past.bones[o.name])o.quaternion.fromArray(past.bones[o.name]);});}});
      const cutting=(a.style==='blades'||a.style==='glaive')&&frame.progress>(a.finisher?.27:a.impactAt-.28)&&frame.progress<a.impactAt+.16;
      const segments=attacker.weaponSegments?.()||[];
      trails.forEach((trail,i)=>{
        const h=histories[i];
        trail.visible=cutting&&Boolean(segments[i]);
        if(!trail.visible){h.length=0;trail.geometry.setDrawRange(0,0);return;}
        // Store snapshots: weaponSegments may reuse its vector instances.
        if(h.length&&time<h.at(-1).time)h.length=0;
        while(h.length&&time-h[0].time>.16)h.shift();
        const sample={time,segment:segments[i].map(v=>v.clone())};
        if(h.length&&h.at(-1).time===time)h[h.length-1]=sample;else h.push(sample);
        if(h.length>13)h.shift();
        const data=positions[i];let count=0;
        for(let j=1;j<h.length;j++){
          const [base,tip]=h[j-1].segment,[base2,tip2]=h[j].segment;
          for(const v of [base,tip,tip2,base,tip2,base2]){v.toArray(data,count);count+=3;}
        }
        trail.geometry.setDrawRange(0,count/3);trail.geometry.attributes.position.needsUpdate=true;
        trail.material.color.set(a.color);trail.material.opacity=(1-frame.returnHome)*(a.finisher?.24:.32);
      });
      const contactAt=frame.contactAt??a.impactAt;
      const age=Math.max(0,frame.progress-contactAt),impact=!a.avoided&&frame.progress>=contactAt&&age<.12;
      const contact=frame.contactPosition?new THREE.Vector3(...frame.contactPosition):new THREE.Vector3(sign*(2.1+frame.defender.x),2.02+frame.defender.y,.12);
      sparks.visible=impact||(!a.avoided&&frame.secondaryImpact>.1);
      if(sparks.visible){
        const travel=age*(a.finisher?22:14);
        for(let i=0;i<64;i++){
          const angle=i*2.399,z=Math.sin(i*4.71),speed=.35+(i%7)/7;
          const direction=new THREE.Vector3(Math.cos(angle),Math.sin(angle)*.7,z*.45);
          const start=contact.clone().addScaledVector(direction,travel*speed);
          start.y-=travel*travel*.09;
          const end=start.clone().addScaledVector(direction,.10+age*.7);
          start.toArray(sparkData,i*6);end.toArray(sparkData,i*6+3);
        }
        sparkGeometry.attributes.position.needsUpdate=true;sparks.material.opacity=(impact?1-age/.12:frame.secondaryImpact)*(frame.contactStrength??1);
      }
      dust.forEach((s,i)=>{
        s.visible=impact&&(a.style==='brawler'||a.finisher)&&frame.defender.y<.5;
        const spread=age*12,angle=i*2.399;
        s.position.set(contact.x+Math.cos(angle)*spread,.12+age*(i%3),Math.sin(angle)*spread);
        s.scale.setScalar(.3+age*5);s.material.opacity=Math.max(0,1-age/.20)*.6;
      });
      contactLight.position.copy(contact);contactLight.color.set(a.color);contactLight.intensity=(frame.impact+frame.secondaryImpact*.4)*(a.finisher?32:14);
      shards.visible=a.style==='mage'&&frame.weapon!=='paper'&&frame.progress>a.impactAt-.3&&frame.progress<a.impactAt+.2;
      if(shards.visible){
        const launch=THREE.MathUtils.smoothstep(frame.progress,a.impactAt-.17,a.impactAt);
        for(let i=0;i<12;i++){
          const angle=i*Math.PI/6+time;
          dummy.position.set(sign*(-1.85+launch*3.95),1.95+Math.cos(angle)*.5*(1-launch),Math.sin(angle)*.65*(1-launch));
          dummy.rotation.set(angle,time*2,i);dummy.scale.setScalar(/shatter|crystal/.test(frame.vfx)?1.8:/split/.test(frame.vfx)?.65:1.0);
          if(/trap/.test(frame.vfx))dummy.position.y=.15+launch*.8;
          if(/horizon/.test(frame.vfx))dummy.position.z=(i-6)*.16*(1-launch);
          dummy.updateMatrix();shards.setMatrixAt(i,dummy.matrix);
        }shards.instanceMatrix.needsUpdate=true;
      }
    },
    dispose(){clearGhosts();ghostMaterial.dispose();dustMap.dispose();scene.remove(root);root.traverse(o=>{if(o.isInstancedMesh)o.dispose();o.geometry?.dispose();o.material?.dispose();});},
  };
}
