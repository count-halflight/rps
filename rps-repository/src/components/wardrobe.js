import * as T from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
// Original modular tailoring. Encounter kits are geometry, not colour swaps.
export function createWardrobe(fighter,appearance={}){
 const group=new T.Group(),pieces=[],cloth=[];fighter.body.add(group);
 const color=new T.Color(appearance.color||'#538987');
 const fabric=new T.MeshStandardMaterial({color:color.clone().multiplyScalar(.065),roughness:.9,side:T.DoubleSide});
 fighter.model.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(/jacket/i.test(m.name)){fabric.normalMap=m.normalMap;fabric.roughnessMap=m.roughnessMap;fabric.normalScale=m.normalScale.clone();}});
 const metal=new T.MeshStandardMaterial({color:color.clone().multiplyScalar(.7),metalness:.75,roughness:.33});
 const dark=new T.MeshStandardMaterial({color:'#151b21',roughness:.62});
 const glow=new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.3,roughness:.4});
 const skin=new T.MeshStandardMaterial({color:'#5b352a',roughness:.7});
 fabric.name='Tailored jacket';
 const mats=[fabric,metal,dark,glow,skin];
 const bone=n=>fighter.model.getObjectByName(n.replaceAll('.',''));
 function mount(geo,mat,anchor,offset,rotation=[0,0,0]){
  const parent=bone(anchor)||fighter.body,m=new T.Mesh(geo,mat);
  parent.updateWorldMatrix(true,false);
  const frame=fighter.model.getWorldQuaternion(new T.Quaternion());
  const point=parent.getWorldPosition(new T.Vector3()).add(new T.Vector3(...offset).applyQuaternion(frame));
  parent.add(m);m.position.copy(parent.worldToLocal(point));
  m.quaternion.copy(parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(frame).multiply(new T.Quaternion().setFromEuler(new T.Euler(...rotation))));m.castShadow=true;
  pieces.push(m);return m;
 }
 const plate=(anchor,p,s,mat=metal,rot)=>mount(new RoundedBoxGeometry(...s,2,Math.min(...s)*.20),mat,anchor,p,rot);
 const sphere=(anchor,p,s,mat=metal)=>{const m=mount(new T.SphereGeometry(1,16,10),mat,anchor,p);m.scale.set(...s);return m;};
 const ring=(anchor,p,r,t=.015,mat=metal,rot)=>mount(new T.TorusGeometry(r,t,6,32),mat,anchor,p,rot);
 function cloak(anchor,width,length,depth,mat=fabric){
  const geometry=new T.PlaneGeometry(width,length,8,12),a=geometry.attributes.position;
  for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i);const drape=(length*.5-y)/length;a.setX(i,x*(.55+drape*.45));a.setY(i,y+.055*Math.cos(x/width*Math.PI*3)*drape);a.setZ(i,-depth-Math.cos(x/width*Math.PI)*.08-.05*Math.sin(y*5));}
  geometry.computeVertexNormals();const m=mount(geometry,mat,anchor,[0,-length*.5,-.18],[0,0,0]);
  cloth.push({mesh:m,rest:a.array.slice(),width,length});return m;
 }
 const kit=appearance.kit||{},elite=appearance.elite;
 if(kit.layer==='cape')cloak('spine01',elite?.85:.65,elite?1.25:.85,.08);
 if(kit.layer==='coat'){cloak('spine02',.60,.85,.13);for(const side of ['L','R'])plate('upperleg01.'+side,[0,-.13,.07],[.20,.48,.06],fabric);}
 if(kit.layer==='vest'||kit.layer==='apron'){plate('spine02',[0,-.02,.16],[.43,.4,.055],fabric);if(kit.layer==='apron')cloak('spine04',.48,.56,-.15);}
 if(kit.layer==='hood'||kit.layer==='veil'){
  const hood=mount(new T.SphereGeometry(.19,24,12,0,Math.PI*2,0,Math.PI*.7),fabric,'head',[0,.12,.055]);hood.scale.set(1,1.2,1);
  if(kit.layer==='veil')cloak('head',.4,.7,.13);
 }
 if(kit.detail==='mask')plate('head',[0,.065,.13],[.17,.065,.055],dark);
 if(kit.detail==='visor')plate('head',[0,.13,.145],[.22,.042,.028],glow);
 if(kit.detail==='paint')for(const s of [-1,1])plate('head',[s*.05,.07,.13],[.007,.055,.009],fabric,[0,0,s*.3]);
 if(kit.detail==='plates')for(const side of ['L','R']){
  sphere('upperarm01.'+side,[0,0,.025],[.16,.11,.09]);plate('lowerarm01.'+side,[0,.06,.03],[.10,.19,.08]);
 }
 if(kit.detail==='collar')ring('neck03',[0,-.10,0],.15,.025,fabric,[Math.PI/2,0,0]);
 if(kit.detail==='scarf'){ring('neck03',[0,-.10,0],.14,.026,fabric,[Math.PI/2,0,0]);cloak('spine01',.13,.65,.08);}
 if(kit.detail==='rings')for(const side of ['L','R'])ring('upperarm01.'+side,[0,.04,0],.14,.018,glow,[Math.PI/2,0,0]);
 if(kit.detail==='antenna')for(const s of [-1,1]){
  mount(new T.CylinderGeometry(.006,.01,.4,6),metal,'head',[s*.12,.30,.015],[0,0,s*.3]);sphere('head',[s*.17,.49,.015],[.025,.025,.025],glow);
 }
 if(elite){
  const d=appearance.district;
  if(d===0){mount(new T.CylinderGeometry(.014,.024,.6,8),metal,'spine01',[.22,.25,-.25]);plate('spine02',[0,0,.18],[.48,.38,.07]);}
  if(d===1){for(const side of ['L','R'])sphere('lowerarm01.'+side,[0,-.05,0],[.17,.23,.15],dark);mount(new T.CylinderGeometry(.06,.09,.5,12),metal,'spine01',[0,.20,-.27]);}
  if(d===2)for(const side of ['L','R'])mount(new T.OctahedronGeometry(.15),metal,'upperarm01.'+side,[0,.04,0]).scale.y=1.8;
  if(d===3)for(const sign of [-1,1])for(let i=0;i<3;i++)mount(new T.SphereGeometry(.04,10,6),glow,'spine02',[sign*.20,-.10-i*.11,.14]);
  if(d===4)for(const sign of [-1,1])mount(new T.CylinderGeometry(.008,.02,.45,8),metal,'head',[sign*.14,.22,0],[0,0,sign*.45]);
  if(d===5){sphere('spine02',[0,.02,-.24],[.21,.30,.12],dark);plate('head',[0,.08,.14],[.23,.07,.035],glow);}
  ring('spine02',[0,.02,.14],.28,.035,metal);for(const s of [-1,1])plate('head',[s*.13,.18,.04],[.055,.16,.12],metal,[0,0,s*.25]);}
 // Six individually built boss silhouettes and weapons. No shared boss template.
 if(appearance.boss){
  const type=appearance.model;
  if(type==='rail'){
   plate('spine02',[0,.04,.17],[.64,.56,.12]);plate('spine02',[0,.08,.40],[.58,.68,.26],dark);
   for(const s of [-1,1]){plate('upperarm01.'+(s===1?'L':'R'),[0,.025,0],[.40,.18,.28]);plate('head',[s*.11,.20,.08],[.11,.25,.20]);}
   plate('head',[0,.09,.12],[.24,.045,.06],glow);
   const h=bone('wrist.R');const hammer=new T.Group();h.add(hammer);pieces.push(hammer);
   const handle=new T.Mesh(new T.CylinderGeometry(.035,.035,1.2,12),dark);handle.position.y=.4;hammer.add(handle);
   const head=new T.Mesh(new T.BoxGeometry(.60,.3,.32),metal);head.position.y=1;hammer.add(head);
   for(const x of [-.25,.25]){const m=new T.Mesh(new T.BoxGeometry(.04,.32,.34),glow);m.position.set(x,1,0);hammer.add(m);}
  }else if(type==='kiln'){
   cloak('spine02',1.05,1.2,.18);sphere('spine02',[0,.04,.16],[.35,.30,.15],metal);
   ring('spine02',[0,.03,.30],.20,.05,glow);
   for(const s of [-1,1]){mount(new T.CylinderGeometry(.07,.11,.7,12),metal,'spine01',[s*.26,.25,.3],[0,0,s*.18]);ring('head',[0,.30,0],.22,.018,glow,[Math.PI/2,0,0]);}
  }else if(type==='prism'){
   for(const s of [-1,1])for(let i=0;i<3;i++){
    const shard=mount(new T.OctahedronGeometry(.16,0),metal,'spine01',[s*(.25+i*.12),.2-i*.08,.08]);shard.scale.y=2.2;shard.rotation.z=s*.3;
   }
   ring('head',[0,.16,.12],.30,.022,glow);cloak('spine04',.55,.8,.15);
   mount(new T.OctahedronGeometry(.19,0),metal,'head',[0,.36,.02]).scale.y=1.8;
  }else if(type==='lantern'){
   cloak('spine01',1.15,1.45,.15);sphere('head',[0,.30,.05],[.34,.10,.34],dark);
   for(const s of [-1,1])for(let i=0;i<3;i++){
    mount(new T.CylinderGeometry(.007,.007,.36+i*.10,6),metal,'spine01',[s*(.24+i*.08),-.1,.16]);
    mount(new T.CylinderGeometry(.065,.05,.14,8),glow,'spine01',[s*(.24+i*.08),-.30-i*.08,.16]);
   }
  }else if(type==='root'){
   for(const s of [-1,1]){
    const side=s===1?'L':'R';mount(new T.CylinderGeometry(.12,.16,.6,12),dark,'lowerarm01.'+side,[0,.13,0]);
    for(let i=0;i<3;i++)mount(new T.CylinderGeometry(.012,.035,.55+i*.1,8),metal,'head',[s*(.13+i*.07),.25+i*.10,.12],[0,0,s*(.2+i*.17)]);
   }
   cloak('spine01',.85,1.4,.2);ring('spine02',[0,.05,.23],.25,.04,glow);
  }else if(type==='tide'){
   sphere('head',[0,.13,.01],[.24,.25,.23],metal);plate('head',[0,.13,.23],[.27,.12,.04],glow);
   sphere('spine02',[0,.04,.18],[.39,.37,.19],dark);for(const s of [-1,1])mount(new T.CylinderGeometry(.10,.10,.7,12),metal,'spine01',[s*.23,0,.3]);
   cloak('spine02',.85,1.15,.17);ring('wrist.R',[0,.15,0],.27,.055,metal);plate('wrist.R',[0,.38,0],[.08,.55,.09]);
  }
 }
 return{update(time,reduced=false){
  for(const c of cloth){const a=c.mesh.geometry.attributes.position;for(let i=0;i<a.count;i++){
   const weight=1-(c.rest[i*3+1]+c.length*.5)/c.length;
   a.setZ(i,c.rest[i*3+2]+(reduced?0:Math.sin(time*2.4+c.rest[i*3]*4)*.035*weight));
  }a.needsUpdate=true;}
 },dispose(){pieces.forEach(p=>{p.parent?.remove(p);p.traverse(o=>{if(o.isMesh)o.geometry.dispose();});});fighter.body.remove(group);mats.forEach(m=>m.dispose());}};
}
