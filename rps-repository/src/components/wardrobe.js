import * as T from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// The Blender assets contain complete, skinned outfits. Encounter tailoring
// adds cloth and practical equipment without hiding the human silhouette.
export function createWardrobe(fighter, appearance = {}) {
 const pieces=[],cloth=[],color=new T.Color(appearance.color||'#538987');
 const fabric=new T.MeshStandardMaterial({color:color.clone().multiplyScalar(.25),roughness:.94,side:T.DoubleSide});
 const lining=new T.MeshStandardMaterial({color:color.clone().multiplyScalar(.56),roughness:.89,side:T.DoubleSide});
 const leather=new T.MeshStandardMaterial({color:'#15171b',roughness:.67});
 const metal=new T.MeshStandardMaterial({color:'#806b48',metalness:.72,roughness:.38});
 const silver=new T.MeshStandardMaterial({color:'#879397',metalness:.78,roughness:.28});
 const glow=new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.7,roughness:.4});
 const mats=[fabric,lining,leather,metal,silver,glow];
 fighter.model.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(/jacket/i.test(m.name)){
  fabric.normalMap=m.normalMap;fabric.roughnessMap=m.roughnessMap;if(m.normalScale)fabric.normalScale=m.normalScale.clone();
 }});
 const bone=n=>fighter.model.getObjectByName(n.replaceAll('.',''));
 function mount(geo,mat,anchor,offset,rotation=[0,0,0]){
  const parent=bone(anchor)||fighter.body,mesh=new T.Mesh(geo,mat);parent.updateWorldMatrix(true,false);
  const frame=fighter.model.getWorldQuaternion(new T.Quaternion());
  const point=parent.getWorldPosition(new T.Vector3()).add(new T.Vector3(...offset).applyQuaternion(frame));
  parent.add(mesh);mesh.position.copy(parent.worldToLocal(point));
  mesh.quaternion.copy(parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(frame).multiply(new T.Quaternion().setFromEuler(new T.Euler(...rotation))));
  mesh.castShadow=true;pieces.push(mesh);return mesh;
 }
 const pad=(anchor,p,s,mat=leather)=>mount(new RoundedBoxGeometry(...s,3,Math.min(...s)*.23),mat,anchor,p);
 const bead=(anchor,p,s,mat=metal)=>{const m=mount(new T.SphereGeometry(1,16,12),mat,anchor,p);m.scale.set(...s);return m;};
 const cord=(anchor,points,radius=.004,mat=metal)=>mount(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),24,radius,6,false),mat,anchor,[0,0,0]);
 function panel(anchor,vertices,triangles,mat=fabric){
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices.flat(),3));geometry.setIndex(triangles);geometry.computeVertexNormals();
  return mount(geometry,mat,anchor,[0,0,0]);
 }
 function cape(anchor,width,length,offset=-.16,mat=fabric,asymmetric=false){
  const geometry=new T.PlaneGeometry(width,length,14,18),a=geometry.attributes.position;
  for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),t=(length/2-y)/length;
   a.setX(i,x*(.43+.57*t));a.setY(i,y+(asymmetric?x*.3:0)+.018*Math.cos(x*18)*t);
   a.setZ(i,offset-.08*Math.cos(x/width*Math.PI)+.016*Math.sin(x*35)*t);
  }geometry.computeVertexNormals();const m=mount(geometry,mat,anchor,[0,-length/2-.025,0]);cloth.push({mesh:m,rest:a.array.slice(),length});return m;
 }
 function lapels(mat=lining,long=false){for(const s of [-1,1])panel('spine01',[[s*.075,.02,.14],[s*.19,-.13,.19],[s*.085,long?-.46:-.28,.165],[s*.048,-.11,.18]],[0,1,2,0,2,3],mat);}
 function scarf(){panel('neck03',[[-.115,-.08,.10],[.12,-.08,.10],[.105,-.15,.13],[-.105,-.15,.13]],[0,1,2,0,2,3],lining);cape('spine01',.13,.57,-.14,lining,true);}
 function cap(mat=leather,captain=false){
  mount(new T.CylinderGeometry(.12,.14,.10,32,1,true),mat,'head',[0,.22,.012]);
  mount(new T.CircleGeometry(.12,32),mat,'head',[0,.27,.012],[-Math.PI/2,0,0]);
  panel('head',[[-.14,.17,.07],[.14,.17,.07],[.11,.155,.195],[-.11,.155,.195]],[0,1,2,0,2,3],mat);
  if(captain)cord('head',[[-.12,.183,.04],[-.09,.18,.124],[0,.178,.15],[.09,.18,.124],[.12,.183,.04]],.006,metal);
 }
 function mantle(mat=fabric,w=.34){panel('spine01',[[-w,-.03,.015],[-w,-.23,-.07],[-.21,-.40,-.19],[.21,-.40,-.19],[w,-.23,-.07],[w,-.03,.015],[.15,.02,-.12],[-.15,.02,-.12]],[0,1,7,1,2,7,2,3,7,3,6,7,3,4,6,4,5,6],mat);}
 const kit=appearance.kit||{},elite=appearance.elite;
 // Player models need no second box-shaped vest or thick torus collar.
 if(appearance.id&&!appearance.boss){
  if(kit.layer==='cape'||kit.layer==='veil')cape('spine01',elite?.83:.69,elite?1.08:.78,-.18,fabric,true);
  if(kit.layer==='coat'){cape('spine02',.64,.85,-.20);lapels();}
  if(kit.layer==='vest')lapels(fabric);
  if(kit.layer==='apron')panel('spine02',[[-.18,0,.20],[.18,0,.20],[.22,-.63,.18],[-.22,-.63,.18]],[0,1,2,0,2,3],fabric);
  if(kit.layer==='hood'){panel('head',[[-.14,.22,-.02],[0,.32,-.05],[.14,.22,-.02],[.17,-.10,-.11],[-.17,-.10,-.11]],[0,1,4,1,3,4,1,2,3],fabric);cape('spine01',.45,.42,-.16,fabric);}
  if(kit.detail==='mask')panel('head',[[-.087,.012,.105],[0,-.04,.14],[.087,.012,.105],[.070,-.075,.10],[-.070,-.075,.10]],[0,1,4,1,3,4,1,2,3],leather);
  if(kit.detail==='visor'){for(const s of [-1,1])pad('head',[s*.047,.10,.108],[.075,.028,.018],silver);cord('head',[[-.10,.10,.02],[-.095,.10,.10],[.095,.10,.10],[.10,.10,.02]],.004,metal);}
  if(kit.detail==='paint')for(const s of [-1,1])cord('head',[[s*.070,.055,.104],[s*.058,.025,.122]],.002,lining);
  if(kit.detail==='plates')for(const side of ['L','R']){bead('upperarm01.'+side,[0,-.025,0],[.11,.065,.08],leather);pad('lowerarm01.'+side,[0,-.065,.025],[.075,.16,.055],metal);cord('lowerarm01.'+side,[[-.037,-.07,.05],[0,-.085,.06],[.037,-.07,.05]],.003,lining);}
  if(kit.detail==='collar'||kit.detail==='scarf')scarf();
  if(kit.detail==='rings')for(const s of [-1,1])for(let i=0;i<3;i++)bead('spine01',[s*(.10+i*.022),-.13-i*.024,.17],[.013,.013,.013],metal);
  if(kit.detail==='antenna')for(const s of [-1,1]){cord('head',[[s*.13,.13,-.025],[s*.17,.24,-.015]],.006,metal);bead('head',[s*.17,.24,-.015],[.017,.017,.017],glow);}
  if(elite){mantle(lining,.31);lapels();cap(leather);}
 }
 if(appearance.boss){const type=appearance.model;
  if(type==='rail'){
   cape('spine01',.94,1.18,-.21);lapels(lining,true);cap(fabric,true);
   for(const s of [-1,1]){pad('upperarm01.'+(s===1?'L':'R'),[0,-.012,.02],[.19,.055,.12],fabric);for(let i=0;i<3;i++)cord('upperarm01.'+(s===1?'L':'R'),[[-.06+i*.045,-.035,.06],[-.06+i*.045,-.075,.06]],.005,metal);}
   for(let i=0;i<4;i++)bead('spine02',[.075,-.07-i*.07,.19],[.011,.008,.011],metal);
   pad('wrist.R',[0,.66,.005],[.36,.16,.18],silver);cord('wrist.R',[[0,-.20,0],[0,.64,0]],.024,leather);
   for(const x of [-.125,.125])pad('wrist.R',[x,.66,.005],[.026,.17,.19],metal);
  }else if(type==='kiln'){
   mantle(lining,.39);cape('spine02',.92,1.13,-.21);lapels(leather,true);
   panel('spine02',[[-.17,-.03,.21],[.17,-.03,.21],[.23,-.73,.17],[-.23,-.73,.17]],[0,1,2,0,2,3],leather);
   for(const s of [-1,1]){pad('head',[s*.047,.17,.088],[.070,.039,.02],metal);bead('lowerarm01.'+(s===1?'L':'R'),[0,-.05,.012],[.11,.16,.10],leather);for(let i=0;i<4;i++)cord('lowerarm01.'+(s===1?'L':'R'),[[-.075,-.06-i*.025,.07],[0,-.06-i*.025,.10],[.075,-.06-i*.025,.07]],.006,lining);}
   cord('spine01',[[-.10,-.05,.15],[0,-.22,.20],[.10,-.05,.15]],.006,metal);
  }else if(type==='prism'){
   cape('spine01',.85,1.30,-.22,lining);lapels(fabric,true);
   for(const s of [-1,1])for(let i=0;i<3;i++){const shard=mount(new T.OctahedronGeometry(.055),silver,'spine01',[s*(.25+i*.07),.055-i*.11,-.07]);shard.scale.y=2.3;shard.rotation.z=s*.25;}
   cord('head',[[-.10,.18,.05],[0,.24,.10],[.10,.18,.05]],.008,metal);
   mount(new T.RingGeometry(.024,.032,32),silver,'head',[.055,.098,.12]);cord('head',[[.083,.08,.10],[.12,-.015,.04],[.09,-.12,.01]],.0025,metal);
  }else if(type==='lantern'){
   cape('spine01',1.04,1.25,-.20,lining,true);lapels(fabric,true);mount(new T.ConeGeometry(.255,.07,48,1,true),leather,'head',[0,.28,0]);
   cord('head',[[-.13,.25,.005],[-.22,.24,-.03],[-.29,.22,-.01]],.006,metal);
   for(const s of [-1,1])for(let i=0;i<2;i++){const x=s*(.15+i*.07);cord('spine02',[[x,-.20,.10],[x,-.40-i*.08,.12]],.0025,metal);mount(new T.CylinderGeometry(.035,.03,.09,12),glow,'spine02',[x,-.46-i*.08,.12]);cord('spine02',[[x-.033,-.42-i*.08,.12],[x+.033,-.42-i*.08,.12]],.004,metal);}
  }else if(type==='root'){
   mantle(lining,.39);cape('spine01',1,1.30,-.23,fabric,true);lapels(leather);
   for(const s of [-1,1])for(let i=0;i<3;i++){const x=s*(.07+i*.038);cord('head',[[x,.19,-.02],[x+s*.025,.28+i*.035,-.035],[x+s*.045,.32+i*.040,-.015]],.007-i*.001,metal);}
   for(const s of [-1,1])for(let i=0;i<5;i++)panel('spine01',[[s*.18,-.04-i*.045,-.12],[s*.31,-.10-i*.045,-.08],[s*.28,-.23-i*.045,-.10]],[0,1,2],i%2?lining:fabric);
  }else if(type==='tide'){
   cape('spine01',.96,1.18,-.22);lapels(lining,true);cap(fabric,true);scarf();pad('head',[-.043,.085,.112],[.042,.030,.012],leather);cord('head',[[-.078,.097,.10],[.12,.10,-.02]],.002,leather);
   for(const s of [-1,1])for(let i=0;i<3;i++)bead('spine02',[s*.078,-.06-i*.073,.185],[.010,.008,.010],metal);
   cord('wrist.R',[[0,-.18,0],[0,.67,0]],.025,silver);cord('wrist.R',[[-.22,.43,0],[-.19,.57,0],[0,.69,0],[.19,.57,0],[.22,.43,0]],.036,silver);mount(new T.TorusGeometry(.062,.010,8,24),metal,'wrist.R',[0,.70,0]);
  }
 }
 return{update(time,reduced=false){for(const c of cloth){const a=c.mesh.geometry.attributes.position;for(let i=0;i<a.count;i++){const weight=1-(c.rest[i*3+1]+c.length/2)/c.length;a.setZ(i,c.rest[i*3+2]+(reduced?0:Math.sin(time*2.1+c.rest[i*3]*7)*.024*weight));}a.needsUpdate=true;}},dispose(){for(const p of pieces){p.parent?.remove(p);p.geometry.dispose();}mats.forEach(m=>m.dispose());}};
}
