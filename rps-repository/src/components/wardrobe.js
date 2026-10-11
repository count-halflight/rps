import * as T from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// The Blender assets contain complete, skinned outfits. Encounter tailoring
// adds cloth and practical equipment without hiding the human silhouette.
export function createWardrobe(fighter, appearance = {}) {
 const pieces=[],cloth=[],textures=[],animators=[],restores=[],dynamicPieces=new Set(),color=new T.Color(appearance.color||'#538987');
 let state={phase:appearance.phase||0,brokenPlates:0,heat:0,signatureWarning:false,scan:false},lastTime=0,disposed=false;
 // Small procedural PBR maps keep the metal tactile without an extra network
 // asset. The grooves affect highlights, rather than being painted neon.
 const size=128,normalPixels=new Uint8Array(size*size*4),roughPixels=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const at=(y*size+x)*4,n=((Math.imul(x+17,y+71)^Math.imul(y+23,911))>>>0)%97/97;
  const scratch=x%29===0||((x+y*3)%97===0),wave=Math.sin(y*.75)*.5;
  normalPixels.set([Math.round(128+(scratch?23:wave*4)),Math.round(128+(n-.5)*9),254,255],at);
  const rough=Math.round(100+n*45+(scratch?42:0));roughPixels.set([rough,rough,rough,255],at);
 }
 const normalMap=new T.DataTexture(normalPixels,size,size,T.RGBAFormat),roughnessMap=new T.DataTexture(roughPixels,size,size,T.RGBAFormat);
 for(const texture of [normalMap,roughnessMap]){texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(3,3);texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;textures.push(texture);}
 const fabric=new T.MeshStandardMaterial({color:color.clone().multiplyScalar(.25),roughness:.94,side:T.DoubleSide});
 const lining=new T.MeshStandardMaterial({color:color.clone().multiplyScalar(.56),roughness:.89,side:T.DoubleSide});
 const leather=new T.MeshStandardMaterial({color:'#15171b',roughness:.67});
 const metal=new T.MeshStandardMaterial({color:'#806b48',metalness:.72,roughness:.38});
 const silver=new T.MeshStandardMaterial({color:'#879397',metalness:.78,roughness:.28});
 const glow=new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.7,roughness:.4});
 const armour=new T.MeshPhysicalMaterial({color:appearance.palette?.metal||'#899ba6',metalness:.92,roughness:.35,clearcoat:.36,clearcoatRoughness:.23,normalMap,normalScale:new T.Vector2(.3,.3),roughnessMap});
 const blackSteel=new T.MeshStandardMaterial({color:appearance.palette?.shadow||'#172129',metalness:.78,roughness:.47,normalMap,normalScale:new T.Vector2(.18,.18),roughnessMap});
 const glass=new T.MeshPhysicalMaterial({color:color.clone().multiplyScalar(.32),metalness:.12,roughness:.11,clearcoat:1,transparent:true,opacity:.30,depthWrite:false,side:T.DoubleSide});
 metal.normalMap=silver.normalMap=normalMap;metal.roughnessMap=silver.roughnessMap=roughnessMap;
 const mats=[fabric,lining,leather,metal,silver,glow,armour,blackSteel,glass];
 fighter.model.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(/jacket/i.test(m.name)){
  fabric.normalMap=m.normalMap;fabric.roughnessMap=m.roughnessMap;if(m.normalScale)fabric.normalScale=m.normalScale.clone();
 }});
 // Cache the neutral attachment frame once. Re-equipping a cached rival after
 // a hurt/finisher pose must not bake that pose into its new armour or helmet.
 const mountFrames=fighter.model.userData.wardrobeMountFrames??={};
 fighter.model.updateWorldMatrix(true,true);
 const captureFrame=(parent,key)=>{
  if(mountFrames[key])return mountFrames[key];
  parent.updateWorldMatrix(true,false);
  const matrix=parent.matrixWorld.clone().invert().multiply(fighter.model.matrixWorld);
  const quaternion=parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(fighter.model.getWorldQuaternion(new T.Quaternion()));
  return mountFrames[key]={direction:new T.Matrix3().setFromMatrix4(matrix).toArray(),quaternion:quaternion.toArray()};
 };
 fighter.model.traverse(o=>{if(o.isBone)captureFrame(o,o.name);});captureFrame(fighter.body,'__body');
 const bone=n=>fighter.model.getObjectByName(n.replaceAll('.',''));
 function mount(geo,mat,anchor,offset,rotation=[0,0,0]){
  const parent=bone(anchor)||fighter.body,mesh=new T.Mesh(geo,mat);parent.updateWorldMatrix(true,false);
  const frame=captureFrame(parent,parent===fighter.body?'__body':parent.name);
  parent.add(mesh);mesh.position.set(...offset).applyMatrix3(new T.Matrix3().fromArray(frame.direction));
  mesh.quaternion.fromArray(frame.quaternion).multiply(new T.Quaternion().setFromEuler(new T.Euler(...rotation)));
  geo.computeBoundingBox();const size=geo.boundingBox.getSize(new T.Vector3());
  // Thin trims and internal machinery do not need their own shadow draw.
  mesh.castShadow=Math.max(size.x*size.y,size.y*size.z,size.x*size.z)>.05;pieces.push(mesh);return mesh;
 }
 const pad=(anchor,p,s,mat=leather)=>mount(new RoundedBoxGeometry(...s,3,Math.min(...s)*.23),mat,anchor,p);
 const bead=(anchor,p,s,mat=metal)=>{const m=mount(new T.SphereGeometry(1,16,12),mat,anchor,p);m.scale.set(...s);m.castShadow=Math.max(s[0]*s[1],s[1]*s[2],s[0]*s[2])*4>.05;return m;};
 const cord=(anchor,points,radius=.004,mat=metal)=>mount(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),24,radius,6,false),mat,anchor,[0,0,0]);
 const name=(mesh,label)=>{
  mesh.name=label;
  if(/^(Bulwark (armour plate|weak seam|plate \d fracture|tower shield|shield spine|shield slit|split-shield)|Crucible (furnace housing|furnace glass|furnace flame|exposed pipe)|Sable cable arm|Redline (cyber-heart|exposed heart ring)|Cipher signal fragment|Onyx last-hand glyph)/.test(label))dynamicPieces.add(mesh);
  if(/fracture|signal fragment|weak seam|furnace flame/.test(label))mesh.castShadow=false;
  return mesh;
 };
 function relief(anchor,p,points,depth=.035,mat=armour,label='Wardrobe relief',rotation=[0,0,0]){
  const shape=new T.Shape();shape.moveTo(...points[0]);for(const point of points.slice(1))shape.lineTo(...point);shape.closePath();
  const geometry=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.012,bevelThickness:.009,bevelSegments:3,curveSegments:12,steps:1});
  return name(mount(geometry,mat,anchor,p,rotation),label);
 }
 function plateOutline(width,height){return [[-width*.42,height*.42],[width*.30,height*.50],[width*.50,height*.20],[width*.43,-height*.30],[0,-height*.50],[-width*.48,-height*.25]];}
 function sculpt(parts){
  const flat=parts.map(geometry=>geometry.index?geometry.toNonIndexed():geometry);
  const geometry=mergeGeometries(flat,false);new Set([...parts,...flat]).forEach(part=>part.dispose());return geometry;
 }
 function instanceParts(sources,label){
  const first=sources[0],sharedParent=sources.every(mesh=>mesh.parent===first.parent)?first.parent:fighter.model;
  const geometry=first.geometry.clone(),pool=new T.InstancedMesh(geometry,first.material,sources.length);
  geometry.computeBoundingBox();const baseSize=geometry.boundingBox.getSize(new T.Vector3());
  pool.name=label;pool.frustumCulled=false;pool.castShadow=sources.some(mesh=>mesh.castShadow);pool.instanceMatrix.setUsage(T.DynamicDrawUsage);
  const controls=sources.map((mesh,index)=>{
   mesh.geometry.computeBoundingBox();const size=mesh.geometry.boundingBox.getSize(new T.Vector3()),marker=new T.Group();
   marker.name=mesh.name;marker.position.copy(mesh.position);marker.quaternion.copy(mesh.quaternion);marker.scale.copy(mesh.scale).multiply(new T.Vector3(size.x/baseSize.x,size.y/baseSize.y,size.z/baseSize.z));
   marker.visible=mesh.visible;marker.userData={...mesh.userData,wardrobeInstance:index};mesh.parent.add(marker);restores.push(()=>marker.parent?.remove(marker));
   mesh.parent.remove(mesh);mesh.geometry.dispose();pieces.splice(pieces.indexOf(mesh),1);dynamicPieces.delete(mesh);return marker;
  });
  sharedParent.add(pool);pieces.push(pool);dynamicPieces.add(pool);
  const inverse=new T.Matrix4(),matrix=new T.Matrix4(),hidden=new T.Matrix4().makeScale(1e-7,1e-7,1e-7);
  const sync=()=>{
   sharedParent.updateWorldMatrix(true,false);inverse.copy(sharedParent.matrixWorld).invert();let active=0;
   controls.forEach((marker,index)=>{
    if(marker.visible){marker.updateWorldMatrix(true,false);matrix.multiplyMatrices(inverse,marker.matrixWorld);pool.setMatrixAt(index,matrix);active++;}
    else pool.setMatrixAt(index,hidden);
   });pool.visible=active>0;pool.instanceMatrix.needsUpdate=true;
  };
  sync();return {pool,controls,sync};
 }
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
  // Four head silhouettes and two equipment silhouettes are independent of
  // the three outfit sets. The visual stream selects 24 looks per weapon kit.
  const look=appearance.look;
  if(look?.head===1){cap(fabric);name(pad('head',[0,.20,.133],[.032,.030,.012],metal),'Rival cap crest');}
  if(look?.head===2){
   relief('head',[-.085,.07,.09],[[-.03,.07],[.027,.06],[.037,-.07],[-.015,-.09]],.015,blackSteel,'Rival half-faceplate');
   cord('head',[[-.1,.06,.02],[-.12,.11,-.01],[-.1,.2,-.07]],.005,metal);
  }
  if(look?.head===3&&kit.layer!=='hood'){
   panel('head',[[-.15,.17,.035],[-.16,-.09,-.04],[-.11,-.15,-.14],[.11,-.15,-.14],[.16,-.09,-.04],[.15,.17,.035],[0,.30,-.09]],[0,1,6,1,2,6,2,3,6,3,4,6,4,5,6],fabric);
   cape('spine01',.21,.57,-.19,lining,true);
  }
  if(look?.accessory===1){
   name(pad('spine02',[-.16,-.35,-.08],[.065,.38,.055],blackSteel),'Rival side scabbard');
   cord('spine01',[[-.18,.01,.16],[0,-.17,.20],[.18,-.37,.15]],.015,leather);
   cape('spine02',.24,.66,-.21,lining,true);
  }
  if(appearance.tier==='miniboss'){
   mantle(blackSteel,.43);cape('spine01',.82,.92,-.25,lining,true);
   for(let i=0;i<4;i++)relief('spine01',[(i%2?1:-1)*.16,.015-Math.floor(i/2)*.19,.21],plateOutline(.25,.24),.037,armour,`Miniboss armour segment ${i+1}`);
   relief('upperarm01.L',[-.055,.025,.005],plateOutline(.29,.28),.06,blackSteel,'Miniboss asymmetric pauldron',[0,-.4,.22]);
  }
 }
 if(appearance.boss){const type=appearance.model;
  if(type==='bulwark'){
   // The combat camera sees fighters from the side. A shallow front plate
   // disappears at that angle, so the siege shell must enclose the whole
   // torso and helmet before the six breakable front surfaces are added.
   armour.color.set('#76888c');armour.metalness=.78;armour.roughness=.91;armour.clearcoat=.025;armour.envMapIntensity=.48;
   blackSteel.color.set('#26343b');blackSteel.metalness=.62;blackSteel.roughness=.94;blackSteel.envMapIntensity=.42;
   fabric.color.set('#101b1e');lining.color.set('#27383a');
   glow.color.set('#849a91');glow.emissive.set('#55766b');glow.emissiveIntensity=.16;
   // Effective roughness must remain high after the roughness map multiplier.
   // Dark oxide islands and uneven wear keep broad steel surfaces from turning
   // into blank white reflections under the moon/key light.
   const wornRough=new Uint8Array(size*size*4),wornColor=new Uint8Array(size*size*4);
   const wornNoise=(x,y,scale)=>{
    const px=x/scale,py=y/scale,ix=Math.floor(px),iy=Math.floor(py),sx=px-ix,sy=py-iy;
    const fx=sx*sx*(3-2*sx),fy=sy*sy*(3-2*sy);
    const cell=(a,b)=>((Math.imul(a+31,73856093)^Math.imul(b+73,19349663))>>>0)/4294967295;
    return T.MathUtils.lerp(T.MathUtils.lerp(cell(ix,iy),cell(ix+1,iy),fx),T.MathUtils.lerp(cell(ix,iy+1),cell(ix+1,iy+1),fx),fy);
   };
   for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const at=(y*size+x)*4,n=((Math.imul(x+31,y+19)^Math.imul(y+73,397))>>>0)%101/101;
    const oxide=T.MathUtils.smoothstep(wornNoise(x,y,29)*.68+wornNoise(x,y,11)*.32,.39,.65);
    // Wide polished hollows blend into patina; sparse short scoring affects
    // roughness without painting the hammer as a field of dark circular holes.
    const scratch=(x+y*7)%233===0&&wornNoise(x,y,8)>.48,r=Math.round(200+n*25+oxide*20-(scratch?18:0));
    wornRough.set([r,r,r,255],at);
    const tone=Math.round(234+n*12-oxide*30);wornColor.set([tone,Math.round(tone*(1-oxide*.045)),Math.round(tone*(1-oxide*.09)),255],at);
   }
   const wearRoughness=new T.DataTexture(wornRough,size,size,T.RGBAFormat),wearColor=new T.DataTexture(wornColor,size,size,T.RGBAFormat);
   for(const texture of [wearRoughness,wearColor]){texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(2,2);texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;textures.push(texture);}
   wearColor.colorSpace=T.SRGBColorSpace;armour.roughnessMap=blackSteel.roughnessMap=wearRoughness;armour.map=blackSteel.map=wearColor;
   const cuirass=new T.LatheGeometry([[0,-.43],[.20,-.43],[.26,-.34],[.33,-.15],[.35,.05],[.32,.23],[.23,.33],[.17,.36],[0,.36]].map(p=>new T.Vector2(...p)),32);cuirass.scale(1,1,.66);
   name(mount(cuirass,blackSteel,'spine01',[0,-.10,.055]),'Bulwark cuirass underframe');
   const gorget=new T.LatheGeometry([[.23,-.06],[.26,-.025],[.235,.02],[.19,.10]].map(p=>new T.Vector2(...p)),32);gorget.scale(1,1,.80);
   name(mount(gorget,armour,'spine01',[0,.225,.035]),'Bulwark raised steel gorget');
   name(pad('spine01',[0,-.15,.365],[.030,.67,.014],glow),'Bulwark exposed central seam');
   cape('spine01',1.08,1.23,-.31,fabric);mantle(blackSteel,.49);
   // Banded armour wraps around the flanks instead of ending at the breast.
   // These share their bone/material with the underframe and batch together.
   for(const sign of [-1,1])for(let row=0;row<3;row++){
    const shell=new T.SphereGeometry(1,24,10,(sign===1?Math.PI:0)-.68,1.36,.92,1.19);shell.scale(.365-row*.016,.18,.25-row*.007);
    name(mount(shell,blackSteel,'spine01',[0,.045-row*.24,.045]),`Bulwark flank lamella ${sign} ${row}`);
    const border=[];for(let j=0;j<=12;j++){const a=-.66+j/12*1.32;border.push([sign*(.355-row*.016)*Math.cos(a),-.085-row*.24,.045+(.246-row*.007)*Math.sin(a)]);}
    name(cord('spine01',border,.009,armour),`Bulwark flank steel band ${sign} ${row}`);
   }
   const pauldrons=[],bracers=[],greaves=[];
   for(const side of ['L','R']){
    // In the shipped GLBs the anatomical left shoulder is +X. The previous
    // offsets pointed inward and hid most of each pauldron in the sleeve.
    const sign=side==='L'?1:-1;
    const cap=new T.SphereGeometry(1,32,16,0,Math.PI*2,0,1.84);cap.scale(.235,.225,.238);
    const lames=[];for(let i=0;i<3;i++){
     const layer=new T.SphereGeometry(1,32,8,0,Math.PI*2,.95,.92);layer.scale(.238-i*.018,.145,.235-i*.016);layer.translate(0,-.12-i*.075,0);lames.push(layer);
    }
    const rim=new T.TorusGeometry(.229,.012,8,40);rim.rotateX(Math.PI/2);rim.scale(1,1,1.04);rim.translate(0,-.06,0);
    const shoulderGeometry=sculpt([cap,...lames,rim]);
    pauldrons.push(name(mount(shoulderGeometry,armour,'upperarm01.'+side,[sign*.12,.02,.03],[0,0,sign*.13]),`Bulwark siege pauldron ${side}`));
    const bracer=new T.LatheGeometry([[.065,-.18],[.086,-.15],[.099,-.035],[.085,.11],[.070,.145]].map(p=>new T.Vector2(...p)),24);bracer.scale(1,1,1.23);
    bracers.push(name(mount(bracer,blackSteel,'lowerarm01.'+side,[0,-.065,.025]),`Bulwark bracer ${side}`));
    const greave=new T.LatheGeometry([[.058,-.23],[.088,-.19],[.094,-.02],[.086,.10],[.077,.19]].map(p=>new T.Vector2(...p)),24);greave.scale(1,1,1.16);
    greaves.push(name(mount(greave,armour,'lowerleg01.'+side,[0,-.17,.035]),`Bulwark greave ${side}`));
   }
   const helmetGeometry=new T.LatheGeometry([[.11,-.20],[.17,-.17],[.20,-.07],[.195,.11],[.15,.21],[.055,.255],[0,.255]].map(p=>new T.Vector2(...p)),24);
   helmetGeometry.scale(1,1,.91);
   name(mount(helmetGeometry,armour,'head',[0,.015,.035]),'Bulwark closed siege helm');
   relief('head',[0,.063,.221],[[-.145,.047],[.145,.047],[.132,.005],[.031,.005],[.025,-.15],[-.025,-.15],[-.031,.005],[-.132,.005]],.010,blackSteel,'Bulwark visor slit');
   name(pad('head',[0,.087,.242],[.065,.003,.005],glow),'Bulwark visor light');
   name(cord('head',[[0,.12,.219],[0,.24,.14],[0,.27,.045],[0,.22,-.09],[0,.09,-.15]],.011,armour),'Bulwark helm crown spine');
   // Forged brow arches and recessed cheek flutes give the closed helm a
   // recognizable face from the oblique combat camera. They share static
   // head batches rather than adding a separate mesh for every small trim.
   for(const sign of [-1,1]){
    name(cord('head',[[sign*.02,.155,.204],[sign*.07,.162,.207],[sign*.135,.132,.183],[sign*.175,.104,.137]],.009,metal),`Bulwark cathedral brow ${sign}`);
    for(let flute=0;flute<3;flute++)name(cord('head',[[sign*(.102+flute*.023),.008,.204-flute*.016],[sign*(.105+flute*.023),-.055,.193-flute*.016],[sign*(.075+flute*.028),-.139,.157-flute*.017]],.004,blackSteel),`Bulwark cheek flute ${sign} ${flute}`);
   }
   for(const sign of [-1,1]){
    const cheek=new T.SphereGeometry(1,18,10,(sign===1?Math.PI:0)-.76,1.52,.82,1.62);cheek.scale(.207,.207,.194);
    name(mount(cheek,armour,'head',[0,.008,.035]),`Bulwark enclosed temple ${sign}`);
    for(let row=0;row<3;row++)name(pad('head',[sign*.12,-.035-row*.035,.204],[.014,.012,.040],blackSteel),`Bulwark breathing vent ${sign} ${row}`);
   }
   const plates=[];
   for(let row=0;row<3;row++)for(const sign of [-1,1]){
    const width=.37-row*.017,height=.30-row*.012,p=[sign*(.196-row*.015),.08-row*.24,.292-row*.008],rotation=[0,sign*.16,sign*.065],index=plates.length;
    const weak=relief('spine01',[p[0],p[1],p[2]-.016],plateOutline(width*.82,height*.85),.018,glow,`Bulwark weak seam ${index+1}`,rotation);weak.visible=false;
    const mesh=relief('spine01',p,plateOutline(width,height),.078,armour,`Bulwark armour plate ${index+1}`,rotation);
    mesh.userData.armourPlate=index;
    const rest=mesh.position.clone(),orientation=mesh.quaternion.clone(),shards=[];
    const outline=plateOutline(width,height);
    for(let segment=0;segment<3;segment++){
     const part=relief('spine01',p,[[0,0],outline[segment*2],outline[(segment*2+1)%6],outline[(segment*2+2)%6]],.067,armour,`Bulwark plate ${index+1} fracture ${segment+1}`,rotation);
     part.visible=false;shards.push({mesh:part,rest:part.position.clone(),orientation:part.quaternion.clone()});
    }
    plates.push({mesh,weak,rest,orientation,shards,broken:false,brokenAt:0,sign,index});
   }
   // One draw contains six independently posed/breakable surfaces, not one
   // flattened breastplate. Separate instance pools retain all fracture paths.
   const platePool=instanceParts(plates.map(plate=>plate.mesh),'Bulwark six-plate carapace');
   const weakPool=instanceParts(plates.map(plate=>plate.weak),'Bulwark six exposed weak seams');
   const shardPools=[0,1,2].map(segment=>instanceParts(plates.map(plate=>plate.shards[segment].mesh),`Bulwark fracture pool ${segment+1}`));
   const limbPools=[instanceParts(pauldrons,'Bulwark paired siege pauldrons'),instanceParts(bracers,'Bulwark paired bracers'),instanceParts(greaves,'Bulwark paired greaves')];
   plates.forEach((plate,index)=>{plate.mesh=platePool.controls[index];plate.weak=weakPool.controls[index];plate.shards.forEach((shard,segment)=>{shard.mesh=shardPools[segment].controls[index];});});
   const shieldOutline=[[-.33,.55],[.27,.55],[.36,.37],[.30,-.46],[0,-.62],[-.32,-.46]],shieldRotation=[0,.38,0];
   const shield=relief('wrist.R',[.03,.07,.15],shieldOutline,.14,blackSteel,'Bulwark tower shield',shieldRotation);
   const shieldCrest=relief('wrist.R',[.03,.07,.295],[[-.105,.44],[.105,.44],[.135,-.13],[0,-.38],[-.135,-.13]],.028,armour,'Bulwark shield spine',shieldRotation);
   const borderPoints=[...shieldOutline,shieldOutline[0]].map(p=>new T.Vector3(p[0]*.92,p[1]*.94,.016));
   const shieldBorder=new T.TubeGeometry(new T.CatmullRomCurve3(borderPoints,false,'catmullrom',.08),64,.014,8,false);
   shieldCrest.geometry=sculpt([shieldCrest.geometry,shieldBorder]);
   const shieldLight=name(mount(new RoundedBoxGeometry(.014,.26,.010,3,.002),glow,'wrist.R',[.03,.08,.344],shieldRotation),'Bulwark shield slit');
   const shieldMount=new T.Group();shieldMount.name='Bulwark shield presentation';shield.parent.add(shieldMount);
   [shield,shieldCrest,shieldLight].forEach(mesh=>shieldMount.add(mesh));restores.push(()=>shieldMount.parent?.remove(shieldMount));
   const shieldFrame=captureFrame(bone('wrist.R')||fighter.body,bone('wrist.R')?.name||'__body');
   const shieldAxis=new T.Vector3(0,1,0).applyQuaternion(new T.Quaternion().fromArray(shieldFrame.quaternion));
   name(cord('wrist.L',[[0,-.25,0],[0,.69,0]],.030,blackSteel),'Bulwark hammer haft');
   name(pad('wrist.L',[0,.70,0],[.46,.25,.33],armour),'Bulwark siege hammer head');
   for(const sign of [-1,1])name(pad('wrist.L',[sign*.226,.70,0],[.056,.28,.36],armour),`Bulwark hammer striking face ${sign}`);
   name(pad('wrist.L',[0,.70,.17],[.19,.070,.018],glow),'Bulwark hammer core');
   // A recessed chapel crest breaks up the blunt hammer face. The bevel and
   // brace straps carry the design; light is a small inset rather than neon.
   for(const sign of [-1,1])name(pad('wrist.L',[sign*.145,.70,.178],[.018,.225,.015],blackSteel),`Bulwark hammer retaining strap ${sign}`);
   name(relief('wrist.L',[0,.70,.181],[[-.055,.077],[0,.103],[.055,.077],[.041,-.071],[0,-.091],[-.041,-.071]],.008,metal,'Bulwark hammer chapel seal'),'Bulwark hammer chapel seal');
   const gauntlets=['L','R'].map(side=>{
    const shell=new T.LatheGeometry([[.095,-.18],[.13,-.12],[.142,.055],[.12,.14],[.085,.19]].map(p=>new T.Vector2(...p)),24);shell.scale(1,1,1.10);
    const mesh=name(mount(shell,blackSteel,'wrist.'+side,[0,.04,.04]),`Bulwark split-shield gauntlet ${side}`);mesh.visible=false;return mesh;
   });
   const gauntletPool=instanceParts(gauntlets,'Bulwark split-shield gauntlets');
   animators.push((time,reduced)=>{
    const broken=Math.max(Math.min(6,Math.floor(state.brokenPlates||0)),state.phase===2?6:state.phase===1?2:0);
    const shieldYaw=Number.isFinite(state.shieldPresentationYaw)?T.MathUtils.clamp(state.shieldPresentationYaw,-.8,1.2):.62;
    shieldMount.quaternion.setFromAxisAngle(shieldAxis,shieldYaw-shieldRotation[1]);
    shieldMount.visible=state.phase===0;
    shield.visible=shieldCrest.visible=shieldLight.visible=state.phase===0;gauntletPool.controls.forEach(mesh=>{mesh.visible=state.phase>0;});
    for(const plate of plates){
     const isBroken=plate.index<broken;
     if(isBroken&&!plate.broken)plate.brokenAt=time;
     plate.broken=isBroken;plate.mesh.visible=!isBroken;plate.weak.visible=isBroken;
     if(!isBroken){
      const angle=state.signatureWarning?.32:reduced?0:Math.sin(time*1.1+plate.index*.8)*.024;
      plate.mesh.quaternion.copy(plate.orientation).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),angle*plate.sign));
     }
     const age=Math.max(0,time-plate.brokenAt);
     plate.shards.forEach((shard,i)=>{
      shard.mesh.visible=isBroken&&!reduced&&age<1.2;
      if(!shard.mesh.visible)return;
      const velocity=.26+i*.12;
      shard.mesh.position.copy(shard.rest).add(new T.Vector3(plate.sign*velocity*age,.22*age-.52*age*age,.15*age+i*.022));
      shard.mesh.quaternion.copy(shard.orientation).multiply(new T.Quaternion().setFromEuler(new T.Euler(age*(i+1),age*plate.sign,age*.9)));
     });
    }
    [platePool,weakPool,...shardPools,...limbPools,gauntletPool].forEach(pool=>pool.sync());
   });
  }else if(type==='crucible-9'){
   const robeStart=pieces.length;
   cape('spine01',1.01,1.27,-.24,blackSteel);mantle(fabric,.39);lapels(lining,true);
   const robes=pieces.slice(robeStart);robes.forEach(mesh=>dynamicPieces.add(mesh));
   const front=name(pad('spine01',[0,-.15,.19],[.32,.40,.075],blackSteel),'Crucible furnace housing');
   const furnaceGlass=name(pad('spine01',[0,-.15,.234],[.26,.34,.012],glass),'Crucible furnace glass');
   const pipes=[];
   for(const sign of [-1,1])for(let i=0;i<3;i++){
    const pipe=name(cord('spine01',[[sign*(.14+i*.025),.035,.02],[sign*(.24+i*.017),-.09,.08],[sign*(.21+i*.014),-.36,.06],[sign*.16,-.50,.10]],.009,i===1?glow:metal),`Crucible exposed pipe ${pipes.length+1}`);
    pipe.visible=false;pipes.push(pipe);
   }
   const furnace=new T.MeshStandardMaterial({color:'#ffd9a0',emissive:color,emissiveIntensity:2.4,roughness:.35});mats.push(furnace);
   const flames=[];
   for(let i=0;i<3;i++){const mesh=name(mount(new T.ConeGeometry(.052,.23,14),furnace,'spine01',[(i-1)*.065,-.17,.228]),`Crucible furnace flame ${i+1}`);flames.push(mesh);}
   for(const x of [-.09,0,.09])name(pad('spine01',[x,-.15,.25],[.012,.35,.014],metal),'Crucible furnace grate');
   for(let i=0;i<3;i++){
    name(mount(new T.CylinderGeometry(.028,.036,.27+i*.045,16,1,true),blackSteel,'head',[(i-1)*.085,.26+i*.02,-.01]),`Crucible chimney ${i+1}`);
    name(mount(new T.TorusGeometry(.031,.007,8,20),metal,'head',[(i-1)*.085,.405+i*.043,-.01],[Math.PI/2,0,0]),'Crucible chimney rim');
   }
   name(cord('wrist.R',[[0,-.24,0],[0,.76,0],[.16,.93,0]],.020,metal),'Crucible ladle-scythe shaft');
   name(mount(new T.SphereGeometry(.115,24,12,0,Math.PI*2,0,Math.PI*.55),blackSteel,'wrist.R',[.17,.93,0],[Math.PI,0,0]),'Crucible molten ladle');
   name(mount(new T.CircleGeometry(.100,24),furnace,'wrist.R',[.17,.929,0],[-Math.PI/2,0,0]),'Crucible molten ladle surface');
   relief('wrist.R',[.16,.95,0],[[0,0],[.12,.025],[.34,-.05],[.43,-.16],[.18,-.09]],.025,armour,'Crucible scythe lip');
   animators.push((time,reduced)=>{
    const heat=T.MathUtils.clamp((state.heat||0)/100,0,1);
    flames.forEach((mesh,i)=>{mesh.scale.y=.45+heat*.75+state.phase*.2+(reduced?0:Math.sin(time*5+i)*.08);});
    robes.forEach(mesh=>{mesh.visible=state.phase===0;});pipes.forEach(mesh=>{mesh.visible=state.phase>0;});
    furnaceGlass.visible=state.phase<2;front.material=state.phase===2?armour:blackSteel;furnace.emissiveIntensity=1.6+heat*1.6;
   });
  }else if(type==='sable'){
   cape('spine01',.80,1.39,-.21,blackSteel);lapels(leather,true);
   for(let i=0;i<10;i++){
    const x=(i-4.5)*.040;
    name(cord('spine02',[[x,.05,.10],[x*1.7,-.31,.17],[x*2.7,-.72,.12],[x*3.0,-.98,.18]],.011,i%3?blackSteel:metal),`Sable gown cable ${i+1}`);
   }
   const arms=[];
   for(const sign of [-1,1])for(let i=0;i<3;i++){
    const mesh=name(cord('spine01',[[sign*.17,-.08,.0],[sign*(.32+i*.06),.08+i*.04,-.05],[sign*(.55+i*.09),-.04+i*.13,.12],[sign*(.65+i*.09),-.25+i*.12,.28]],.013,blackSteel),`Sable cable arm ${arms.length+1}`);
    mesh.visible=false;arms.push({mesh,rest:mesh.quaternion.clone(),sign});
   }
   name(cord('wrist.R',[[0,-.17,0],[0,.82,0]],.008,silver),'Sable siphon needle');
   name(mount(new T.TorusGeometry(.060,.006,8,30),armour,'wrist.R',[0,.015,0],[Math.PI/2,0,0]),'Sable rapier guard');
   animators.push((time,reduced)=>{arms.forEach((arm,i)=>{arm.mesh.visible=state.phase>0;arm.mesh.quaternion.copy(arm.rest).multiply(new T.Quaternion().setFromEuler(new T.Euler(0,0,arm.sign*((state.phase===2?.28:.08)+(reduced?0:Math.sin(time*1.3+i)*.045)))));});});
  }else if(type==='redline'){
   mantle(leather,.29);lapels(blackSteel);cape('spine02',.28,.66,-.19,fabric,true);
   const heartCase=name(mount(new T.TorusGeometry(.068,.010,10,40),armour,'spine01',[.043,-.12,.205]),'Redline exposed heart ring');
   const heart=name(bead('spine01',[.043,-.12,.207],[.047,.059,.030],glow),'Redline cyber-heart');
   name(pad('spine01',[.043,-.12,.24],[.012,.090,.006],silver),'Redline heart centre seam');
   for(const sign of [-1,1])for(let i=0;i<3;i++)name(pad('spine01',[sign*.15,-.10-i*.050,.185],[.050,.013,.015],metal),'Redline chest vent');
   for(const side of ['L','R'])relief('lowerarm01.'+side,[0,-.10,.01],[[-.055,.08],[.055,.08],[.035,-.17],[-.025,-.23]],.025,blackSteel,`Redline feral bracer ${side}`);
   animators.push((time,reduced)=>{const pulse=reduced?1:1+Math.pow(Math.max(0,Math.sin(time*(state.phase?9:6))),8)*.20;heart.scale.set(.047*pulse,.059*pulse,.030);heartCase.rotation.z=reduced?0:Math.sin(time*1.1)*.02;});
  }else if(type==='cipher'){
   cape('spine01',.77,1.15,-.23,glass,true);mantle(blackSteel,.32);
   const skinMaterials=[];
   for(const object of [fighter.model])object.traverse(node=>{if(!node.isMesh||pieces.includes(node))return;for(const material of Array.isArray(node.material)?node.material:[node.material]){
    if(!/^Skin/.test(material.name))continue;
    const old={transparent:material.transparent,opacity:material.opacity,depthWrite:material.depthWrite};restores.push(()=>Object.assign(material,old));
    material.transparent=true;material.opacity=.62;material.depthWrite=false;skinMaterials.push(material);
   }});
   const pixels=[];
   for(let i=0;i<12;i++){const sign=i%2?1:-1,mesh=name(pad('spine01',[sign*(.24+(i%3)*.045),.06-Math.floor(i/2)*.085,.09],[.060+(i%3)*.020,.016,.026],glow),`Cipher signal fragment ${i+1}`);pixels.push({mesh,rest:mesh.position.clone(),index:i});}
   relief('head',[.082,.075,.095],[[-.045,.065],[.035,.07],[.048,-.055],[-.027,-.085]],.014,glass,'Cipher broken visor');
   animators.push((time,reduced)=>{skinMaterials.forEach(material=>{material.opacity=state.scan?1:.62;});pixels.forEach(pixel=>{pixel.mesh.position.copy(pixel.rest);if(!reduced)pixel.mesh.position.x+=Math.sin(time*2+pixel.index*1.7)*.012;pixel.mesh.visible=state.scan||((pixel.index+Math.floor(time*.65))%4!==0);});});
  }else if(type==='onyx'){
   const mirrorGlass=new T.MeshPhysicalMaterial({color:'#070b10',metalness:.94,roughness:.075,clearcoat:1,clearcoatRoughness:.04,normalMap,normalScale:new T.Vector2(.05,.05)});mats.push(mirrorGlass);
   mantle(mirrorGlass,.36);cape('spine01',.61,1.03,-.20,mirrorGlass,true);
   relief('spine01',[0,-.15,.16],[[-.16,.25],[.17,.25],[.22,.02],[.13,-.27],[-.13,-.28],[-.21,.01]],.047,mirrorGlass,'Onyx black-glass torso');
   relief('head',[0,.075,.115],[[-.10,.11],[.09,.11],[.12,.015],[.065,-.09],[-.06,-.10],[-.12,.015]],.030,mirrorGlass,'Onyx hollow face');
   name(pad('head',[0,.075,.152],[.065,.004,.005],glow),'Onyx reflected eyes');
   const glyphs=['rock','paper','scissors'].map((hand,i)=>{
    const mesh=name(mount(i===0?new T.IcosahedronGeometry(.045,1):i===1?new T.PlaneGeometry(.082,.092):new T.TorusGeometry(.038,.007,6,20),glow,'spine01',[0,-.085,.233]),`Onyx last-hand glyph ${hand}`);mesh.visible=false;return mesh;
   });
   animators.push(()=>{glyphs.forEach((mesh,i)=>{mesh.visible=['rock','paper','scissors'][i]===state.lastHand;});});
  }else if(type==='rail'){
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
 // Static tailoring is batched only within one bone and one material. Cloth,
 // breakable plates, phase props and animated machinery retain their own draws.
 const staticGroups=new Map(),movingCloth=new Set(cloth.map(part=>part.mesh));
 const beforeBatch=pieces.filter(mesh=>mesh.visible).length;
 const shadowBefore=pieces.filter(mesh=>mesh.visible&&mesh.castShadow).length;
 for(const mesh of pieces){
  if(movingCloth.has(mesh)||dynamicPieces.has(mesh)||!mesh.visible)continue;
  let byMaterial=staticGroups.get(mesh.parent);if(!byMaterial){byMaterial=new Map();staticGroups.set(mesh.parent,byMaterial);}
  const group=byMaterial.get(mesh.material)||[];group.push(mesh);byMaterial.set(mesh.material,group);
 }
 for(const [parent,byMaterial] of staticGroups)for(const [material,group] of byMaterial){
  if(group.length<2)continue;
  const geometries=group.map(mesh=>{
   mesh.updateMatrix();const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();geometry.applyMatrix4(mesh.matrix);
   if(!geometry.attributes.uv){
    geometry.computeBoundingBox();const p=geometry.attributes.position,b=geometry.boundingBox,uv=new Float32Array(p.count*2);
    for(let i=0;i<p.count;i++){uv[i*2]=(p.getX(i)-b.min.x)/Math.max(.001,b.max.x-b.min.x);uv[i*2+1]=(p.getY(i)-b.min.y)/Math.max(.001,b.max.y-b.min.y);}
    geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
   }
   return geometry;
  });
  const geometry=mergeGeometries(geometries,false);geometries.forEach(part=>part.dispose());
  if(!geometry)continue;
  const combined=new T.Mesh(geometry,material);combined.name=`Wardrobe static batch ${parent.name||'body'} ${material.id}`;
  combined.castShadow=group.some(mesh=>mesh.castShadow);combined.userData.wardrobeParts=group.map(mesh=>mesh.name);parent.add(combined);pieces.push(combined);
  for(const mesh of group){
   // Keep named, non-rendering attachment markers for inspection and anchors.
   if(mesh.name){const marker=new T.Group();marker.name=mesh.name;marker.position.copy(mesh.position);marker.quaternion.copy(mesh.quaternion);marker.scale.copy(mesh.scale);parent.add(marker);restores.push(()=>marker.parent?.remove(marker));}
   parent.remove(mesh);mesh.geometry.dispose();pieces.splice(pieces.indexOf(mesh),1);
  }
 }
 const batchStats=Object.freeze({before:beforeBatch,after:pieces.filter(mesh=>mesh.visible).length,shadowBefore,shadowAfter:pieces.filter(mesh=>mesh.visible&&mesh.castShadow).length});
 function setState(next={}){
  state={...state,...next};
  state.phase=T.MathUtils.clamp(Math.floor(state.phase||0),0,2);
  state.brokenPlates=T.MathUtils.clamp(Math.floor(state.brokenPlates||0),0,6);
 }
 return{
  batchStats,
  setState,
  update(time,reduced=false,next){
   if(disposed)return;
   if(next)setState(next);
   const elapsed=Number.isFinite(time)?time:lastTime,dt=T.MathUtils.clamp(elapsed-lastTime,0,.1);lastTime=elapsed;
   for(const c of cloth){const a=c.mesh.geometry.attributes.position;for(let i=0;i<a.count;i++){const weight=1-(c.rest[i*3+1]+c.length/2)/c.length;a.setZ(i,c.rest[i*3+2]+(reduced?0:Math.sin(elapsed*2.1+c.rest[i*3]*7)*.024*weight));}a.needsUpdate=true;}
   for(const animate of animators)animate(elapsed,reduced,dt);
  },
  dispose(){
   if(disposed)return;disposed=true;
   for(const restore of restores)restore();
   for(const p of pieces){p.parent?.remove(p);if(p.isInstancedMesh)p.dispose();p.geometry.dispose();}
   mats.forEach(m=>m.dispose());textures.forEach(texture=>texture.dispose());
  },
 };
}
