import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { fixtureLightFactor, normalizeEnvironmentCinematic } from '../environmentLighting.js';

const HASH = `float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}`;
const clamp = x => Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));
export const BLACK_TIDE_LAYOUTS = Object.freeze(['cloister-pier', 'chain-yard', 'funeral-barge']);
export const BLACK_TIDE_STAGE = Object.freeze({ width:16, depth:10, height:0, waterHeight:-.78 });

// Authored surface fields are repeatable, local, and available with no image fetch.
// Colour, roughness and relief come from different fields, rather than a flat colour.
function surfaceTexture(kind, channel = 'colour', size = 256) {
  const pixels = new Uint8Array(size * size * 4);
  for (let y=0; y<size; y++) for (let x=0; x<size; x++) {
    const grain = ((Math.imul(x+11,173)+Math.imul(y+7,229)+Math.imul(x*y,19)) >>> 0) % 113 / 113;
    const line = kind==='wood' ? Math.sin(y*.43+Math.sin(x*.024)*2.2) : Math.sin(x*.081+y*.044);
    const seam = kind==='wood' ? y % 64 < 3 : kind==='steel' ? (x % 128 < 2 || y % 128 < 2) : kind==='stone' ? (y%48<3||(x+(Math.floor(y/48)%2)*32)%64<3):0;
    const salt = Math.sin(x*.034)*Math.sin(y*.041)>.74;
    const scar = (x*17+y*59)%347<2;
    const macro=Math.sin(x*.031+Math.sin(y*.023)*1.7)*Math.sin(y*.037+x*.007);
    const mineral=kind==='stone'?macro*.09+Math.sin(Math.floor(x/64)*17+Math.floor(y/48)*23)*.06:0;
    let v=.52+grain*(kind==='stone'?.045:.12)+line*.025-seam*.21-scar*.06+mineral;
    if (channel==='roughness') v=(kind==='stone'?.58:.35)+grain*.14+macro*.13+salt*.07+seam*.13;
    if (channel==='relief') v=.52+line*.03+grain*(kind==='stone'?.025:.06)-seam*.19-scar*.09+macro*.06;
    const index=(y*size+x)*4;
    pixels[index]=Math.max(0,Math.min(255,v*255));
    pixels[index+1]=Math.max(0,Math.min(255,(channel==='colour'&&kind==='wood'?v*.88:v)*255));
    pixels[index+2]=Math.max(0,Math.min(255,(channel==='colour'&&kind==='wood'?v*.73:v)*255));pixels[index+3]=255;
  }
  const texture=new THREE.DataTexture(pixels,size,size);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;
  if(channel==='colour')texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;texture.needsUpdate=true;return texture;
}
function waterNormalTexture(size=128) {
  const pixels=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size*Math.PI*2,v=y/size*Math.PI*2;
    const dx=Math.cos(u*7+Math.sin(v*3))*.28+Math.cos(u*13+v*8)*.16;
    const dz=Math.cos(v*9+Math.sin(u*4))*.29+Math.cos(v*17-u*11)*.12;
    const n=new THREE.Vector3(dx,dz,1).normalize(),i=(y*size+x)*4;
    pixels.set([(n.x*.5+.5)*255,(n.y*.5+.5)*255,(n.z*.5+.5)*255,255],i);
  }
  const texture=new THREE.DataTexture(pixels,size,size);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.magFilter=THREE.LinearFilter;
  texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;return texture;
}
function stainedGlassTexture(size=256){
  const pixels=new Uint8Array(size*size*4),palette=[[78,114,139],[109,71,83],[127,111,69],[62,93,113],[112,139,146]];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const diagA=(x+y+size)%64,diagB=(x-y+size*2)%64;
    const seam=diagA<3||diagB<3||Math.abs(x-size/2)<3;
    const piece=(Math.floor((x+y)/64)+Math.floor((x-y+size*2)/64)*3)%palette.length;
    const pigment=palette[piece],glitter=.85+((x*173+y*229)%53)/53*.23,i=(y*size+x)*4;
    pixels.set(seam?[16,22,25,255]:[pigment[0]*glitter,pigment[1]*glitter,pigment[2]*glitter,255],i);
  }
  const texture=new THREE.DataTexture(pixels,size,size);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=true;texture.anisotropy=4;texture.needsUpdate=true;return texture;
}
function stoneHash(x,z){let h=Math.imul(x,1597334677)^Math.imul(z,3812015801);h=Math.imul(h^(h>>>16),2246822519);return ((h^(h>>>13))>>>0)/4294967295;}
function stoneNoise(x,z){const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);return (stoneHash(ix,iz)*(1-u)+stoneHash(ix+1,iz)*u)*(1-v)+(stoneHash(ix,iz+1)*(1-u)+stoneHash(ix+1,iz+1)*u)*v;}
function cutFlagstone(points,nx,nz,d,keep){
  const result=[];
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],da=(a[0]*nx+a[1]*nz-d)*keep,db=(b[0]*nx+b[1]*nz-d)*keep;
    if(da>=0)result.push(a);
    if((da>=0)!==(db>=0)){const t=da/(da-db);result.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
  }return result;
}
function pierPavingPlan(){
  // These construction lines are authored at architectural scale. Shared
  // irregular edges join correctly, rather than ten uninterrupted tile rows.
  const xKnots=[-7.86,-4.2,-.6,3.8,7.86],heights=[-4.93,-3.43,-2.47,-.97,.59,2.15,3.21,4.93];
  const shifts=[[0,0,0,0,0],[0,.11,-.13,.05,0],[0,-.12,.07,.16,0],[0,.06,.18,-.10,0],[0,-.15,-.06,.09,0],[0,.12,-.10,-.17,0],[0,-.07,.14,.06,0],[0,0,0,0,0]];
  const edge=(row,x)=>{let i=0;while(i<xKnots.length-2&&x>xKnots[i+1])i++;const t=(x-xKnots[i])/(xKnots[i+1]-xKnots[i]);return heights[row]+shifts[row][i]*(1-t)+shifts[row][i+1]*t;};
  const courses=[],slabs=[];
  for(let row=0;row<heights.length-1;row++){
    const blocks=[];let cursor=-7.86,column=0;
    while(cursor<7.85){
      const span=Math.min([2.43,1.69,3.12,1.24,2.76,1.95,2.18][(row*3+column)%7],7.86-cursor),right=cursor+span;
      const xs=[cursor,...xKnots.filter(x=>x>cursor+.001&&x<right-.001),right];
      const outline=[...xs.map(x=>[x,edge(row,x)]),...xs.slice().reverse().map(x=>[x,edge(row+1,x)])];
      const block={left:cursor,right,column,row,outline,pieces:[]};
      let polygons=[outline];
      if((row===2&&column===2)||(row===5&&column===3)){
        const slope=row===2?.27:-.19,cut=cursor+span*.52+slope*(heights[row]+heights[row+1])*.5;
        polygons=[cutFlagstone(outline,1,slope,cut,1),cutFlagstone(outline,1,slope,cut,-1)];
      }
      for(let piece=0;piece<polygons.length;piece++){
        const polygon=polygons[piece],centre=polygon.reduce((a,p)=>[a[0]+p[0]/polygon.length,a[1]+p[1]/polygon.length],[0,0]);
        const slab={polygon,centre,row,column,piece,id:slabs.length};slabs.push(slab);block.pieces.push(slab);
      }blocks.push(block);cursor=right;column++;
    }courses.push(blocks);
  }
  const fractures=[[[ -7.7,3.8],[-6.5,3.22],[-5.8,2.74],[-4.8,2.52],[-4.3,1.83]],[[-5.8,2.74],[-5.52,3.45],[-4.96,3.92]],[[4.1,-4.7],[4.5,-3.92],[5.27,-3.64],[5.77,-2.83]],[[.12,4.64],[.48,3.99],[1.05,3.8]]];
  const segments=fractures.flatMap(path=>path.slice(1).map((p,i)=>{const a=path[i],dx=p[0]-a[0],dz=p[1]-a[1];return {x:a[0],z:a[1],dx,dz,inverse:1/(dx*dx+dz*dz)};}));
  return {edge,courses,slabs,segments};
}
function flagstoneGeometry(slab){
  const {polygon,centre,id}=slab,points=[];
  for(let i=0;i<polygon.length;i++){
    const p=polygon[i],previous=polygon[(i+polygon.length-1)%polygon.length],next=polygon[(i+1)%polygon.length];
    const inset=q=>[q[0]+(centre[0]-q[0])*.011,q[1]+(centre[1]-q[1])*.011];
    if((i+id)%3===0){const trim=.035+(id%5)*.008;points.push(inset([p[0]+(previous[0]-p[0])*trim,p[1]+(previous[1]-p[1])*trim]),inset([p[0]+(next[0]-p[0])*trim,p[1]+(next[1]-p[1])*trim]));}
    else points.push(inset(p));
  }
  const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(p[0],-p[1]))),geometry=new THREE.ExtrudeGeometry(shape,{depth:.052,bevelEnabled:true,bevelThickness:.006,bevelSize:.008,bevelSegments:1,steps:1});
  geometry.rotateX(-Math.PI/2);geometry.translate(0,-.044+(id%3)*.0007,0);return geometry;
}
function polygonEdgeDistance(points,x,z){
  let distance=Infinity;
  for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.min(1,Math.max(0,((x-a[0])*dx+(z-a[1])*dz)/Math.max(.000001,dx*dx+dz*dz)));distance=Math.min(distance,Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t));}return distance;
}
function pierSurfaceTextures(plan,width=1024,height=640){
  const colour=new Uint8Array(width*height*4),control=new Uint8Array(width*height*4);
  const edges=Array.from({length:plan.courses.length+1},(_,row)=>Float32Array.from({length:width},(_,x)=>plan.edge(row,(x/width-.5)*16)));
  const expPool=(x,z,cx,cz,rx,rz)=>Math.exp(-(((x-cx)/rx)**2+((z-cz)/rz)**2));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const wx=(x/width-.5)*16,wz=(y/height-.5)*10;let row=0;while(row<plan.courses.length-1&&wz>edges[row+1][x])row++;
    const block=plan.courses[row].find(b=>wx<=b.right)||plan.courses[row].at(-1),seam=Math.min(...block.pieces.map(s=>polygonEdgeDistance(s.polygon,wx,wz)));
    const rim=Math.min(8-Math.abs(wx),5-Math.abs(wz)),edgeDirt=Math.exp(-Math.max(0,rim)*1.75);
    const macro=stoneNoise(wx*.43+31,wz*.43+17),flow=(stoneNoise(wx*1.3+57,wz*1.3+91)-.5)*.27;
    const pooling=Math.max(expPool(wx+flow,wz,-5.65,3.15,1.75,.69),expPool(wx,wz+flow,4.7,-3.4,2.05,.64),expPool(wx+flow,wz,.15,2.3,2.3,.55),expPool(wx,wz,-6.35,-2.2,.7,2));
    const pool=Math.min(1,Math.max(0,(pooling-.22)*1.42));
    const drains=Math.exp(-Math.abs(Math.abs(wx)-6.6)*3.4)*Math.exp(-Math.abs(wz+2.4)*.6);
    const footWear=Math.max(expPool(wx,wz,-2.55,0,.74,3.8),expPool(wx,wz,2.55,0,.74,3.8));
    const mineral=(macro-.5)*.27+(stoneNoise(wx*1.7+9,wz*1.7-21)-.5)*.09;
    const granule=stoneNoise(wx*34+183,wz*34+247),grain=(granule-.5)*.023;
    const pits=Math.max(0,(stoneNoise(wx*10+87,wz*10+61)-.70)/.30)*(1-footWear*.6);
    let crackDistance=Infinity;
    for(const s of plan.segments){const t=Math.min(1,Math.max(0,((wx-s.x)*s.dx+(wz-s.z)*s.dz)*s.inverse));crackDistance=Math.min(crackDistance,Math.hypot(wx-s.x-s.dx*t,wz-s.z-s.dz*t));}
    const fissure=Math.exp(-crackDistance*83),spall=Math.exp(-crackDistance*15),blockTone=.91+stoneHash(row+13,block.column+29)*.18;
    const grout=Math.exp(-seam*65),salt=(1-edgeDirt)*Math.max(0,(stoneNoise(wx*.9+13,wz*.9+41)-.56)*.34);
    const dirt=edgeDirt*.18+drains*.13+pool*.20,base=(.57+mineral+grain+footWear*.045+salt)*blockTone-dirt-grout*.08-pits*.055-fissure*.16-spall*.016;
    const chip=Math.max(0,1-seam/.09)*(.35+.65*stoneNoise(wx*19+31,wz*19+71));
    const i=(y*width+x)*4;
    // Wet hollows are visibly darker with restrained olive sediment; worn
    // stone remains a warm grey, so blue moonlight does not flatten every face.
    colour.set([Math.max(0,base*.99-edgeDirt*.02-pool*.018)*255,Math.max(0,base*.98+edgeDirt*.014)*255,Math.max(0,base*.90-footWear*.02-pool*.043)*255,255],i);
    control.set([Math.min(1,Math.max(.085,.65-pool*.56-footWear*.095+edgeDirt*.18+grout*.1))*255,(.52-grout*.105-chip*.035-fissure*.09-pits*.055+(mineral*.42+grain*.9)*(1-pool*.87))*255,pool*255,255],i);
  }
  const make=(pixels,srgb)=>{const t=new THREE.DataTexture(pixels,width,height);if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=4;t.needsUpdate=true;return t;};
  return {colour:make(colour,true),control:make(control,false)};
}
function dressPierSurface(material,surface){
  const life={value:new THREE.Vector2(1,1)},candles={value:new THREE.Vector3(1,1,1)};
  material.onBeforeCompile=shader=>{
    shader.uniforms.pierColour={value:surface.colour};shader.uniforms.pierControl={value:surface.control};shader.uniforms.pierLightLife=life;shader.uniforms.pierCandleLife=candles;
    shader.vertexShader='varying vec3 pierWorld;varying float pierUp;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\npierWorld=(modelMatrix*vec4(transformed,1.)).xyz;pierUp=normalize(mat3(modelMatrix)*normal).y;');
    shader.fragmentShader=`uniform sampler2D pierColour,pierControl;uniform vec2 pierLightLife;uniform vec3 pierCandleLife;varying vec3 pierWorld;varying float pierUp;
      vec3 pierDirection(vec3 value){return value*inversesqrt(max(dot(value,value),.00000001));}
      float pierGlint(vec3 source,vec3 p,vec3 n,vec3 view){vec3 delta=source-p;vec3 halfDirection=pierDirection(pierDirection(delta)+view);return pow(clamp(dot(n,halfDirection),0.,1.),135.)/(1.+length(delta)*.018);}
      `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float isPier=step(.8,pierUp)*step(abs(pierWorld.y),.12)*step(abs(pierWorld.x),7.98)*step(abs(pierWorld.z),4.99);
      vec2 pierUv=pierWorld.xz/vec2(16.,10.)+.5;vec4 pierDetails=vec4(0.);
      if(isPier>.5){diffuseColor.rgb=diffuse*texture2D(pierColour,pierUv).rgb;pierDetails=texture2D(pierControl,pierUv);}`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nif(isPier>.5)roughnessFactor=pierDetails.r;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      #ifdef USE_BUMPMAP
      if(isPier>.5){vec2 dx=dFdx(pierUv),dy=dFdy(pierUv);float h=pierDetails.g*.065;vec2 relief=vec2(texture2D(pierControl,pierUv+dx).g*.065-h,texture2D(pierControl,pierUv+dy).g*.065-h);normal=perturbNormalArb(-vViewPosition,nonPerturbedNormal,relief,faceDirection);}
      #endif`);
    // A thin dielectric film reflects the actual beacon/candle positions.
    // This supplements the normal PBR highlights in tiers without floor SSR;
    // it has no animation/strobe and switches off with the district's lights.
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      if(isPier>.5 && pierDetails.b>.01){
        vec3 pierView=pierDirection(cameraPosition-pierWorld);
        vec3 stoneNormal=inverseTransformDirection(normal,viewMatrix);
        vec3 filmNormal=pierDirection(mix(stoneNormal,vec3(0.,1.,0.),.96));
        float filmFresnel=.02+.28*pow(1.-clamp(dot(pierView,filmNormal),0.,1.),5.);
        float beacon=(pierGlint(vec3(-14.,7.7,-18.),pierWorld,filmNormal,pierView)+pierGlint(vec3(14.,7.7,-18.),pierWorld,filmNormal,pierView))*pierLightLife.x;
        float candles=pierGlint(vec3(-5.8,1.3,-5.13),pierWorld,filmNormal,pierView)*pierCandleLife.x+pierGlint(vec3(0.,1.3,-5.13),pierWorld,filmNormal,pierView)*pierCandleLife.y+pierGlint(vec3(5.8,1.3,-5.13),pierWorld,filmNormal,pierView)*pierCandleLife.z;
        float reflectedCloud=pow(clamp(dot(reflect(-pierView,filmNormal),vec3(-.23,.31,-.922)),0.,1.),24.)*pierLightLife.x;
        vec3 filmLight=vec3(.40,.58,.68)*(beacon*.65+reflectedCloud*.065)+vec3(.72,.37,.14)*candles*.45;
        outgoingLight=outgoingLight*(1.-pierDetails.b*filmFresnel*.25)+filmLight*pierDetails.b*(.045+filmFresnel*.55);
      }
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=> 'black-tide-pier-surface-v1';return {life,candles};
}
function candleGlassTexture(width=64,height=128){
  const pixels=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const u=x/width,v=y/height,soot=.22+v*.5,core=Math.exp(-(((u-.5)/(.075+.045*(1-v)))**2+((v-.37)/.20)**2));
    const halo=Math.exp(-(((u-.5)/.34)**2+((v-.42)/.38)**2)),lead= Math.abs(u-.18)<.017||Math.abs(u-.82)<.017||Math.abs(v-.18)<.014;
    const candle=Math.abs(u-.5)<.055&&v<.27&&v>.09?1:0,edge=Math.min(u,1-u,v,1-v),border=edge<.035||lead;
    const i=(y*width+x)*4;pixels.set(border?[15,16,17,255]:[(.14+halo*.19+core*.49+candle*.08-soot*.05)*255,(.075+halo*.115+core*.21+candle*.04)*255,(.026+halo*.055+core*.048)*255,255],i);
  }
  const t=new THREE.DataTexture(pixels,width,height);t.colorSpace=THREE.SRGBColorSpace;t.offset.x=.5;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;
}
function batch(parent) {
  const buckets=new Map();
  const dummy=new THREE.Object3D();
  return {
    add(geometry,material,position=[0,0,0],scale=[1,1,1],rotation=[0,0,0],tint=null){
      dummy.position.set(...position);dummy.scale.set(...scale);dummy.rotation.set(...rotation);dummy.updateMatrix();
      let g=geometry.index?geometry.toNonIndexed():geometry.clone();
      // All families have the same PBR attributes; extrusions carry redundant groups.
      for(const name of Object.keys(g.attributes))if(!['position','normal','uv','color'].includes(name))g.deleteAttribute(name);
      if(!material.vertexColors)g.deleteAttribute('color');
      g.clearGroups();g.applyMatrix4(dummy.matrix);
      if(material.userData.worldTextureScale){
        const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,s=material.userData.worldTextureScale;
        for(let i=0;i<p.count;i++){
          if(Math.abs(n.getY(i))>.6)uv.setXY(i,p.getX(i)*s,p.getZ(i)*s);
          else uv.setXY(i,(Math.abs(n.getX(i))>.6?p.getZ(i):p.getX(i))*s,p.getY(i)*s);
        }
      }
      if(material.vertexColors&&!g.attributes.color){
        const p=g.attributes.position,colours=new Float32Array(p.count*3);
        const variation=.86+(((Math.floor(position[0]*37)+Math.floor(position[2]*53))*173)>>>0)%29/29*.14;
        for(let i=0;i<p.count;i++){
          const height=p.getY(i),tide=Math.max(0,1-height/2.4),stain=.8+.2*Math.sin(p.getX(i)*.49+p.getZ(i)*.3)**2;
          colours[i*3]=(tint?.[0]??1)*variation*(1-tide*.26)*stain;
          colours[i*3+1]=(tint?.[1]??1)*variation*(1-tide*.16)*stain;
          colours[i*3+2]=(tint?.[2]??1)*variation*(1-tide*.28)*stain;
        }g.setAttribute('color',new THREE.BufferAttribute(colours,3));
      }
      if(!buckets.has(material))buckets.set(material,[]);buckets.get(material).push(g);
    },
    finish(name='Port architecture'){
      const objects=[];
      for(const [material,geometries] of buckets){
        const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());
        const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.receiveShadow=true;mesh.castShadow=false;parent.add(mesh);objects.push(mesh);
      }buckets.clear();return objects;
    },
  };
}
function loftHull(length,width,height) {
  const vertices=[],indices=[],uv=[];
  const rings=18,around=10;
  for(let k=0;k<=rings;k++){
    const u=k/rings,x=(u-.5)*length;
    const beam=Math.pow(Math.sin(Math.PI*u),.36)*width*.5+.08;
    for(let j=0;j<=around;j++){
      const a=Math.PI*(j/around),z=Math.cos(a)*beam,y=-Math.sin(a)*height;
      vertices.push(x,y,z);uv.push(u,j/around);
      if(k<rings&&j<around){const p=k*(around+1)+j;indices.push(p,p+around+1,p+1,p+1,p+around+1,p+around+2);}
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
function corrugatedPanel(width,height) {
  const geometry=new THREE.PlaneGeometry(width,height,Math.ceil(width/.09),1),p=geometry.attributes.position;
  for(let i=0;i<p.count;i++)p.setZ(i,Math.sin((p.getX(i)+width*.5)*Math.PI/.09)*.035);
  geometry.computeVertexNormals();return geometry;
}
function gothicArchGeometry() {
  const shape=new THREE.Shape();shape.moveTo(-.5,0);shape.lineTo(-.5,.55);
  shape.quadraticCurveTo(-.5,.78,0,1);shape.quadraticCurveTo(.5,.78,.5,.55);shape.lineTo(.5,0);shape.closePath();
  const hole=new THREE.Path();hole.moveTo(-.35,.04);hole.lineTo(.35,.04);hole.lineTo(.35,.53);
  hole.quadraticCurveTo(.35,.7,0,.87);hole.quadraticCurveTo(-.35,.7,-.35,.53);hole.closePath();shape.holes.push(hole);
  return new THREE.ExtrudeGeometry(shape,{depth:1,bevelEnabled:true,bevelThickness:.015,bevelSize:.015,bevelSegments:1,curveSegments:10});
}
function pointedWindowGeometry(){
  const shape=new THREE.Shape();shape.moveTo(-.5,0);shape.lineTo(-.5,.54);shape.quadraticCurveTo(-.5,.77,0,1);shape.quadraticCurveTo(.5,.77,.5,.54);shape.lineTo(.5,0);shape.closePath();return new THREE.ShapeGeometry(shape,12);
}
function brokenArchGeometry(source){
  const arrays={position:[],normal:[],uv:[]},p=source.attributes.position;
  for(let i=0;i<p.count;i+=3){
    const cx=(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,cy=(p.getY(i)+p.getY(i+1)+p.getY(i+2))/3;
    if(cx>-.04&&cx<.29&&cy>.76)continue;
    for(const name of Object.keys(arrays)){const a=source.attributes[name];for(let j=0;j<3;j++)for(let k=0;k<a.itemSize;k++)arrays[name].push(a.array[(i+j)*a.itemSize+k]);}
  }
  const geometry=new THREE.BufferGeometry();for(const [name,values] of Object.entries(arrays))geometry.setAttribute(name,new THREE.Float32BufferAttribute(values,name==='uv'?2:3));return geometry;
}
function slicingMaterial(source,sign) {
  const material=source.clone(),u={active:{value:0},plane:{value:new THREE.Vector4(.18,1,.12,-4.5)},shift:{value:new THREE.Vector3()}};
  material.onBeforeCompile=shader=>{
    shader.uniforms.portSlice=u.active;shader.uniforms.portPlane=u.plane;shader.uniforms.portShift=u.shift;
    shader.vertexShader='varying vec3 portPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nportPosition=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader='uniform float portSlice;uniform vec4 portPlane;uniform vec3 portShift;varying vec3 portPosition;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>\nif(portSlice>.001 && ${sign.toFixed(1)}*(dot(portPlane.xyz,portPosition-portShift)+portPlane.w)<0.)discard;`);
  };
  material.customProgramCacheKey=()=>`black-tide-slice-${sign}`;return {material,u};
}
function mirrorShader(normal) {
  return {
    name:'BlackTideWater',uniforms:{color:{value:new THREE.Color('#091d27')},tDiffuse:{value:null},textureMatrix:{value:new THREE.Matrix4()},normalMap:{value:normal},clock:{value:0},reflecting:{value:0},strength:{value:1},ripple:{value:0},ferry:{value:new THREE.Vector2()},focus:{value:new THREE.Vector2()}},
    vertexShader:`uniform mat4 textureMatrix;uniform float clock,ripple;varying vec4 mirrorUv;varying vec3 portWorld;varying vec3 portNormal;void main(){vec3 p=position;float crest=sin(p.x*.57+clock*.87)*cos(p.y*.44-clock*.64);p.z+=crest*.065;vec4 w=modelMatrix*vec4(p,1.);portWorld=w.xyz;portNormal=normalize(mat3(modelMatrix)*normal);mirrorUv=textureMatrix*vec4(p,1.);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader:`uniform sampler2D tDiffuse,normalMap;uniform vec3 color;uniform float clock,reflecting,strength,ripple;uniform vec2 ferry,focus;varying vec4 mirrorUv;varying vec3 portWorld;varying vec3 portNormal;${HASH}
      vec3 safeDirection(vec3 v){return v*inversesqrt(max(dot(v,v),.00000001));}
      float lampReflection(vec3 source,vec3 p,vec3 n,vec3 view){vec3 l=safeDirection(source-p);return pow(clamp(dot(reflect(-l,n),view),0.,1.),48.)/(1.+length(source-p)*.045);}
      void main(){vec2 p=portWorld.xz;
      vec3 a=texture2D(normalMap,p*.034+vec2(clock*.012,-clock*.006)).xyz*2.-1.;
      vec3 b=texture2D(normalMap,p*.061+vec2(-clock*.007,clock*.011)).xyz*2.-1.;
      vec3 n=normalize(vec3((a.x+b.x)*.42,1.6,(a.y+b.y)*.42));vec2 distortion=n.xz*.007;
      vec3 view=safeDirection(cameraPosition-portWorld);float fresnel=.055+.58*pow(1.-clamp(dot(view,n),0.,1.),4.);
      vec3 reflected=texture2D(tDiffuse,mirrorUv.xy/max(.001,mirrorUv.w)+distortion).rgb;
      float clouds=noise(p*.054+vec2(clock*.004,clock*.006));
      vec3 sky=mix(vec3(.015,.028,.041),vec3(.038,.065,.085),clouds)*strength;
      vec3 c=mix(color*.58,sky,fresnel);
      vec3 moon=normalize(vec3(-.43,.7,-.34));float highlight=pow(clamp(dot(reflect(-moon,n),view),0.,1.),65.);
      c+=vec3(.31,.43,.48)*highlight*.13*strength;
      float candles=lampReflection(vec3(-5.8,1.3,-5.13),portWorld,n,view)+lampReflection(vec3(0.,1.3,-5.13),portWorld,n,view)+lampReflection(vec3(5.8,1.3,-5.13),portWorld,n,view);
      c+=vec3(.58,.34,.17)*candles*.23*strength;
      float glass=lampReflection(vec3(1.8,7.5,-42.),portWorld,n,view);c+=vec3(.16,.33,.45)*glass*.16*strength;
      c=mix(c,reflected,fresnel*reflecting);
      float edge=max(abs(p.x)-8.,abs(p.y)-5.);float edgeBand=exp(-abs(edge)*3.4);
      float froth=pow(noise(p*2.6+vec2(clock*.11,-clock*.2)),2.4)*noise(p*.48-clock*.03);
      float foam=edgeBand*froth*.24;
      float wake=exp(-abs(p.y-ferry.y)*1.7)*exp(-abs(p.x-ferry.x+3.7)*.38)*froth*.17;
      float ring=pow(max(0.,sin(length(p-focus)*2.8-clock*3.)),4.)*exp(-length(p-focus)*.17)*ripple*.15;
      c+=vec3(.30,.40,.43)*(foam+wake+ring)*strength;
      gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`,

  };
}

/** The harbour is real scenery in three layers. High adds one 384px planar pass;
 * Light keeps the same stage, machinery, hulls and animated normal-mapped water. */
export function createBlackTide(parent) {
  const root=new THREE.Group();root.name='Black Tide 3D harbour';parent.add(root);
  const textures=[],materials=[],ownedLights=[],practicals=[],landmarks=[],dynamic=[];
  const wood=surfaceTexture('wood'),woodR=surfaceTexture('wood','roughness'),woodB=surfaceTexture('wood','relief');
  const steel=surfaceTexture('steel'),steelR=surfaceTexture('steel','roughness'),steelB=surfaceTexture('steel','relief');
  const paving=pierPavingPlan();
  const concrete=surfaceTexture('stone'),stoneR=surfaceTexture('stone','roughness'),stoneB=surfaceTexture('stone','relief'),normal=waterNormalTexture(),stainedGlass=stainedGlassTexture(),pierSurface=pierSurfaceTextures(paving),candleGlass=candleGlassTexture();textures.push(wood,woodR,woodB,steel,steelR,steelB,concrete,stoneR,stoneB,normal,stainedGlass,pierSurface.colour,pierSurface.control,candleGlass);
  function mat(options){const m=new THREE.MeshStandardMaterial(options);materials.push(m);return m;}
  const steelMat=mat({color:'#31393e',map:steel,roughnessMap:steelR,bumpMap:steelB,bumpScale:.018,roughness:.5,metalness:.79});
  const dark=mat({color:'#151b20',map:steel,roughness:.64,metalness:.66});
  const deckWood=mat({color:'#82918a',map:wood,roughnessMap:woodR,bumpMap:woodB,bumpScale:.07,roughness:.58,metalness:.12});
  wood.repeat.set(2,5);woodR.repeat.copy(wood.repeat);woodB.repeat.copy(wood.repeat);
  const stone=mat({color:'#8b9695',map:concrete,roughnessMap:stoneR,bumpMap:stoneB,bumpScale:.05,roughness:.76,metalness:.025,vertexColors:true});
  stone.userData.worldTextureScale=.52;
  const pierLighting=dressPierSurface(stone,pierSurface);
  const ropeMat=mat({color:'#766e5a',roughness:1,metalness:0});
  const paint=['#515455','#705044','#56554f'].map(color=>mat({color,map:wood,roughnessMap:woodR,bumpMap:woodB,bumpScale:.046,roughness:.8,metalness:.08}));
  const icy=mat({color:'#8bafb7',emissive:'#76c8ff',emissiveIntensity:.7,roughness:.5,metalness:.1});
  const warm=mat({color:'#deb795',emissive:'#ffac6b',emissiveIntensity:.8,roughness:.4});
  const glass=mat({color:'#adbac5',map:stainedGlass,emissiveMap:stainedGlass,emissive:'#d2dae0',emissiveIntensity:.2,roughness:.28,metalness:.25});
  const rust=mat({color:'#6a5045',map:steel,roughness:.93,metalness:.32});
  const cube=new THREE.BoxGeometry(1,1,1),cylinder=new THREE.CylinderGeometry(1,1,1,12),sphere=new THREE.SphereGeometry(1,12,8);
  const scratchGeo=new THREE.PlaneGeometry(1,1),railGeo=new THREE.CylinderGeometry(1,1,1,8),archGeo=gothicArchGeometry(),windowGeo=pointedWindowGeometry();
  const ruinedArchGeo=brokenArchGeometry(archGeo),finialGeo=new THREE.ConeGeometry(1,1,8),ringGeo=new THREE.TorusGeometry(1,.10,6,20),chainGeo=new THREE.TorusGeometry(1,.12,4,10);
  const brokenRingGeo=new THREE.TorusGeometry(1,.09,6,18,Math.PI*1.61),capitalGeo=new THREE.CylinderGeometry(.66,.47,1,4,1);
  const voussoirs=[];
  for(const side of [-1,1])for(let k=0;k<7;k++){
    const outside=new THREE.QuadraticBezierCurve(new THREE.Vector2(side*.5,.55),new THREE.Vector2(side*.5,.78),new THREE.Vector2(0,1));
    const inside=new THREE.QuadraticBezierCurve(new THREE.Vector2(side*.35,.53),new THREE.Vector2(side*.35,.70),new THREE.Vector2(0,.87));
    const t0=k/7+.008,t1=(k+1)/7-.008,points=[outside.getPoint(t0),outside.getPoint(t1),inside.getPoint(t1),inside.getPoint(t0)];
    const shape=new THREE.Shape(points);voussoirs.push({side,k,geometry:new THREE.ExtrudeGeometry(shape,{depth:1,bevelEnabled:true,bevelThickness:.005,bevelSize:.003,bevelSegments:1,curveSegments:1})});
  }
  function arch(b,position,width,height,depth=.4,rotation=0,m=stone,ruined=false){
    b.add(ruined?ruinedArchGeo:archGeo,m,position,[width,height,depth],[0,rotation,0]);
    if(!m.userData.worldTextureScale||width<1.8)return;
    const group=new THREE.Group(),dressed=batch(group);
    // Voussoirs, hood mould and jamb courses are dressed stone, each with a
    // coherent construction seam. They join the existing material batch.
    for(const block of voussoirs){
      if(ruined&&block.side>0&&block.k>3)continue;
      const tone=.92+(block.k%3)*.045;
      dressed.add(block.geometry,m,[0,0,depth+.008],[width,height,Math.max(.055,depth*.26)],[0,0,0],[tone,tone*.98,tone*.95]);
    }
    for(const side of [-1,1]){
      for(let j=0;j<5;j++)dressed.add(cube,m,[side*width*.424,height*(.065+j*.107),depth+.05],[width*.13,height*.098,depth*.26],[0,0,0],[.91,.93,.93]);
      dressed.add(cube,m,[side*width*.423,.055*height,depth*.35],[width*.20,height*.10,depth*1.15]);
      dressed.add(capitalGeo,m,[side*width*.425,height*.55,depth*.47],[width*.20,height*.045,depth*.95],[0,Math.PI*.25,0]);
      if(width>4){
        const points=[];for(let j=0;j<=(ruined&&side>0?7:14);j++){const t=j/14,curve=new THREE.QuadraticBezierCurve(new THREE.Vector2(side*.513,.55),new THREE.Vector2(side*.52,.805),new THREE.Vector2(0,1.017)),p=curve.getPoint(t);points.push(new THREE.Vector3(p.x*width,p.y*height,depth+.10));}
        const mould=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),20,Math.min(.14,width*.016),5,false);dressed.add(mould,m);mould.dispose();
      }
    }
    if(ruined){for(let j=0;j<3;j++)dressed.add(cube,m,[width*(.24+j*.052),height*(.75-j*.029),depth*.48],[width*.10,height*.043,depth*.83],[0,.2,j*.14]);}
    const pieces=dressed.finish();group.position.set(...position);group.rotation.y=rotation;group.updateMatrix();
    for(const piece of pieces){const g=piece.geometry.clone();g.applyMatrix4(group.matrix);b.add(g,piece.material);g.dispose();piece.geometry.dispose();}
  }
  function pier(b,x,y,z,height,width,m=stone){
    b.add(cube,m,[x,y+.12,z],[width*1.45,.24,width*1.45]);b.add(cube,m,[x,y+.39,z],[width*1.15,.28,width*1.15]);
    b.add(cube,m,[x,y+height*.5,z],[width*.68,height-.5,width*.72]);
    for(const side of [-1,1]){
      b.add(cube,m,[x+side*width*.30,y+height*.50,z+width*.34],[width*.14,height-.7,width*.15]);
      b.add(cube,m,[x+side*width*.30,y+height*.50,z-width*.34],[width*.14,height-.7,width*.15]);
    }
    b.add(capitalGeo,m,[x,y+height-.2,z],[width,.4,width],[0,Math.PI*.25,0]);b.add(cube,m,[x,y+height+.04,z],[width*1.2,.14,width*1.2]);
  }
  function buttress(b,from,to,m=stone){
    const length=Math.hypot(to[0]-from[0],to[2]-from[2]),shape=new THREE.Shape();
    shape.moveTo(0,from[1]);shape.lineTo(length,to[1]);shape.lineTo(length+.18,to[1]-.9);
    shape.quadraticCurveTo(length*.3,from[1]-3.1,0,from[1]-.75);shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:.58,bevelEnabled:true,bevelSize:.06,bevelThickness:.035,bevelSegments:1,curveSegments:10});
    b.add(geometry,m,[from[0],0,from[2]],[1,1,1],[0,-Math.atan2(to[2]-from[2],to[0]-from[0]),0]);geometry.dispose();
    pier(b,to[0],to[1]-1,to[2],2.2,.75,m);
  }
  const pipe=(b,a,z,r,m)=>{
    const from=new THREE.Vector3(...a),to=new THREE.Vector3(...z),mid=from.clone().add(to).multiplyScalar(.5);
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),to.clone().sub(from).normalize());
    const e=new THREE.Euler().setFromQuaternion(q);b.add(railGeo,m,mid.toArray(),[r,from.distanceTo(to),r],e.toArray().slice(0,3));
  };
  function cable(b,points,r=.026){const geo=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),20,r,6,false);b.add(geo,ropeMat);geo.dispose();}
  const coffinShape=new THREE.Shape();coffinShape.moveTo(-.32,-1.5);coffinShape.lineTo(.32,-1.5);coffinShape.lineTo(.62,.75);coffinShape.lineTo(.37,1.35);coffinShape.lineTo(-.37,1.35);coffinShape.lineTo(-.62,.75);coffinShape.closePath();
  const coffinGeo=new THREE.ExtrudeGeometry(coffinShape,{depth:.48,bevelEnabled:true,bevelThickness:.055,bevelSize:.045,bevelSegments:2});
  function coffin(b,position,colour=0,rotation=0,scale=1){
    b.add(coffinGeo,paint[colour%3],position,[scale,scale,scale],[-Math.PI/2,0,rotation]);
    const [x,y,z]=position;
    b.add(cube,steelMat,[x,y+.51*scale,z],[.045*scale,.025,2.4*scale],[0,rotation,0]);
    b.add(cube,steelMat,[x,y+.52*scale,z+.25*scale],[.53*scale,.025,.045*scale],[0,rotation,0]);
  }
  function container(b,x,y,z,colour=0,rotation=0,scale=1){
    const group=new THREE.Group(),cb=batch(group);
    // Open arched mortuary stores replace modern closed shipping boxes.
    for(const dz of [-2.8,0,2.8])arch(cb,[0,0,dz],2.9,3.2,.26,0,stone,colour===2&&dz===2.8);
    cb.add(cube,stone,[0,.10,0],[3.15,.22,6.1]);
    for(const yy of [.35,1.55]){
      cb.add(cube,paint[colour%3],[0,yy,0],[2.45,.12,5.65]);
      for(const dx of [-.66,.66])coffin(cb,[dx,yy+.1,0],colour,0,.8);
    }
    for(const side of [-1,1]){cb.add(cube,stone,[side*1.39,1.55,0],[.27,.16,5.7]);cb.add(cube,steelMat,[side*1.39,2.64,0],[.04,.04,5.7]);}
    for(const side of [-1,1])for(const dz of [-2.6,2.6]){pier(cb,side*1.43,0,dz,2.1,.32);cb.add(finialGeo,stone,[side*1.43,3.3,dz],[.16,.6,.16]);}
    const parts=cb.finish();group.position.set(x,y,z);group.rotation.y=rotation;group.scale.setScalar(scale);group.updateMatrix();
    for(const part of parts){const g=part.geometry.clone();g.applyMatrix4(group.matrix);b.add(g,part.material);g.dispose();part.geometry.dispose();}
  }
  const lampMaterials=new Map();
  function lamp(b,position,index,family='practical'){
    const key=`${family}-${index%3}`;
    if(!lampMaterials.has(key)){
      const m=(family==='neon'?icy:warm).clone();materials.push(m);lampMaterials.set(key,m);
      m.map=m.emissiveMap=family==='neon'?stainedGlass:candleGlass;m.color.set(family==='neon'?'#566d78':'#76523c');m.emissiveIntensity=family==='neon'?.27:.38;
      m.roughness=.61;m.metalness=.03;
      practicals.push({material:m,base:m.emissiveIntensity*(.76+(index%3)*.10),position,index,family,colour:new THREE.Color(family==='neon'?'#78a8c1':index%3===0?'#d88432':index%3===1?'#bb702a':'#e4a254')});
    }
    const m=lampMaterials.get(key);
    const width=index%3===1?.43:.53,height=index%3===2?.70:.76;
    arch(b,[position[0],position[1]-.35,position[2]-.04],width,height,.08,0,steelMat);
    // Each bank is one material, so a third can die without dozens of lights.
    b.add(windowGeo,m,[position[0],position[1]-.26,position[2]+.035],[width*.58,height*.63,1]);
    b.add(cube,steelMat,[position[0],position[1]-.04,position[2]+.046],[.012,height*.40,.035]);
    b.add(cube,steelMat,[position[0],position[1]-.22,position[2]+.046],[width*.58,.015,.035]);
  }
  const variants=BLACK_TIDE_LAYOUTS.map((name,layout)=>{
    const group=new THREE.Group();group.name=`Black Tide ${name}`;root.add(group);const b=batch(group);
    b.add(cube,layout===2?dark:stone,[0,-.27,0],[16,.5,10]);
    // Profiled, chipped flagstones follow the same authored plan as the surface
    // textures. They merge into the existing stone draw, including split slabs.
    if(layout===2)for(let k=0;k<20;k++)b.add(cube,deckWood,[0,-.018,(k-9.5)*.5],[15.76,.055,.474]);
    else for(const slab of paving.slabs){
      const geometry=flagstoneGeometry(slab),tint=[[1,.96,.91],[.89,.97,.94],[.93,.90,.87],[.87,.92,1]][(slab.row+slab.column*3)%4];
      b.add(geometry,stone,[0,0,0],[1,1,1],[0,0,0],tint);geometry.dispose();
    }
    for(const side of [-1,1]){
      b.add(cube,steelMat,[side*7.96,-.37,0],[.14,.76,10.2]);b.add(cube,dark,[side*6.4,-.73,0],[.25,.22,10]);
      b.add(cube,icy,[side*7.87,.032,0],[.015,.012,9.6]);
      for(let k=0;k<7;k++){
        const z=-4.7+k*1.5;
        b.add(cube,stone,[side*7.1,-1.65,z],[.29,2.9,.35]);b.add(cube,stone,[side*7.1,-.45,z],[.45,.18,.50]);
        pipe(b,[side*7.1,-.9,z],[side*6,-1.8,z],.07,steelMat);
        b.add(cylinder,steelMat,[side*7.5,.17,z],[.12,.32,.12]);b.add(cylinder,dark,[side*7.5,.35,z],[.22,.08,.22]);
        if(k%2===0)cable(b,[[side*7.5,.39,z],[side*8.5,.09,z-.25],[side*9.6,-.64,z-.4]],.044);
      }
      // Railings are rearward, leaving camera and combat silhouettes open.
      for(let k=0;k<7;k++){const z=-4.8+k*.65;b.add(cylinder,steelMat,[side*7.72,.48,z],[.035,.95,.035]);b.add(finialGeo,steelMat,[side*7.72,1.07,z],[.065,.19,.065]);}
      pipe(b,[side*7.72,.95,-4.9],[side*7.72,.95,-.7],.035,steelMat);
      cable(b,[[side*7.72,.66,-4.9],[side*7.72,.54,-2.8],[side*7.72,.66,-.7]],.028);
      for(let k=0;k<5;k++)b.add(cylinder,steelMat,[side*7.3,.036,-4.1+k*1.8],[.028,.016,.028]);
    }
    b.add(cube,rust,[0,-.32,-5.02],[16,.42,.16]);b.add(cube,icy,[0,.013,-4.95],[15.8,.012,.025]);
    // A drowned landing and irregular broken masonry establish an inhabited
    // shore. Clutter stays beyond the lane and shares its existing batches.
    for(const side of [-1,1]){
      for(let k=0;k<12;k++){
        const x=side*(8.9+(k*17%11)*.27),z=-6.3-(k*13%17)*.25;
        b.add(cube,stone,[x,-.38+(k%4)*.055,z],[.25+(k%3)*.16,.19+(k%2)*.19,.34+(k%4)*.13],[k*.13,k*.73,(k%3-.8)*.19],[.77,.87,.79]);
      }
      for(let k=0;k<6;k++)b.add(cube,paint[0],[side*(9.7+k*.15),-.59,-7.2-k*.47],[2.15,.065,.36],[.025,k*.024,side*.018]);
      for(const z of [-7.4,-9.4])b.add(cube,steelMat,[side*10.6,-.24,z],[.045,.9,.045],[.1,0,side*.19]);
      cable(b,[[side*10.6,.18,-7.4],[side*10.5,-.34,-8.4],[side*10.6,.18,-9.4]],.025);
    }
    for(let i=0;i<3;i++){
      const x=-5.8+i*5.8;lamp(b,[x,1.3,-5.13],i);b.add(cylinder,steelMat,[x,.62,-5.2],[.045,1.35,.045]);
    }
    // Original stencilled route marks, grates and salt scars are small decals.
    for(let k=0;k<12;k++)b.add(cube,warm,[-5.3+k*.35,.032,-4.1],[.22,.006,.04],[0,Math.PI*.25,0]);
    for(const x of [-6.6,6.6])for(let k=0;k<24;k++)b.add(cube,dark,[x,.023,-3.7+k*.10],[.5,.012,.025]);
    if(layout===0){
      container(b,-11.2,-.3,-9.9,0,.17);container(b,-13.3,0,-16.9,2,.37,.87);
      container(b,11.1,-.25,-11.3,1,-.19);container(b,12.4,-.25,-17.7,0,-.19);
      b.add(cube,stone,[-9,-.35,-7],[2.1,.75,3.5]);
    }else if(layout===1){
      for(let k=0;k<3;k++){container(b,-11.2,0,-8.7-k*6.3,k,.05);container(b,10.7,0,-8.8-k*6.3,k+1,-.05);}
      container(b,-11.2,2.47,-8.7,1,.05);container(b,10.7,2.47,-15.1,0,-.05);
      b.add(cube,stone,[0,-.6,-9],[24,.6,8]);
      for(const x of [-8.9,8.9])b.add(cube,steelMat,[x,-.17,-10.3],[.14,.06,12]);
    }else{
      const hull=loftHull(20,13,2);b.add(hull,dark,[0,-.22,0],[1,1,1],[0,Math.PI/2,0]);hull.dispose();
      for(const z of [-6.2,-9.1])arch(b,[0,0,z],7.4,5.6,.48,0,steelMat);
      for(const side of [-1,1]){
        b.add(cube,paint[0],[side*3.5,2.8,-7.5],[.12,.12,3.2]);
        b.add(windowGeo,glass,[side*2.0,2.0,-6.17],[1.4,2.3,1]);
      }
      coffin(b,[0,.1,-7.3],1,0,1.5);
      for(const side of [-1,1]){
        pipe(b,[side*5.1,0,-4.8],[side*5.1,8.1,-6.1],.06,steelMat);
        cable(b,[[side*5.1,7.7,-6.1],[side*7.3,1.2,-1.1]],.025);
        b.add(cylinder,steelMat,[side*6.9,.6,-4.6],[.41,1.0,.41],[0,0,Math.PI/2]);
      }
    }
    const meshes=b.finish(`Black Tide ${name} merged scenery`);group.visible=false;return {group,meshes};
  });
  // Middle layer: a ruined cloister arch carries a moving funeral chain hoist.
  const gantry=new THREE.Group();gantry.name='Abbey chain hoist';gantry.position.set(-3.8,0,-21);gantry.scale.setScalar(.72);root.add(gantry);const gb=batch(gantry);
  for(const z of [-1.85,1.85]){
    arch(gb,[0,0,z],22,12,.65,0,stone,z>0);
    gb.add(cube,paint[1],[0,9.75,z],[22,.34,.3]);
    gb.add(cube,steelMat,[0,10.05,z],[22,.06,.15]);
    for(const side of [-1,1]){
      gb.add(cube,stone,[side*10.5,.45,z],[2.3,.9,2]);
      gb.add(finialGeo,stone,[side*10.1,11.5,z],[.7,2.5,.7]);
      gb.add(ringGeo,steelMat,[side*10,9.2,z+.5],[.66,.66,.66]);
      for(let k=0;k<5;k++)gb.add(cube,stone,[side*10.5,2+k*1.5,z],[2.0,.13,1.5]);
    }
  }
  gb.finish('Ruined arch and hoist rail merged');
  const trolley=new THREE.Group();gantry.add(trolley);const tb=batch(trolley);
  tb.add(cube,paint[1],[0,9.7,0],[2.7,.34,4.1]);arch(tb,[1.7,8.4,2],.7,1.2,.2,0,steelMat);tb.add(windowGeo,warm,[1.7,8.47,2.03],[.5,.9,1]);
  for(const x of [-1,1])for(const z of [-1.1,1.1]){pipe(tb,[x,9.5,z],[x,5.8,z],.025,dark);for(let k=0;k<14;k++)tb.add(chainGeo,dark,[x,6+k*.25,z],[.08,.13,.08],[0,k%2*Math.PI/2,0]);}
  tb.add(cube,steelMat,[0,5.7,0],[2.8,.3,4.0]);coffin(tb,[0,4.85,0],1,0,1.55);tb.finish('Moving hoist merged');dynamic.push(trolley);
  // A curved funeral barge crosses the lake under a pointed wrought-iron canopy.
  const ferry=new THREE.Group();ferry.name='Crossing funeral barge';ferry.position.set(-6,-.30,-25);root.add(ferry);const fb=batch(ferry);
  const ferryHull=loftHull(14,3.9,1.3);fb.add(ferryHull,paint[0],[0,0,0]);ferryHull.dispose();
  fb.add(cube,deckWood,[0,.04,0],[11.7,.18,3.5]);
  for(const x of [-3,0,3])arch(fb,[x,.15,0],3.9,3.6,.15,Math.PI/2,steelMat);
  for(const side of [-1,1]){
    pipe(fb,[-5.7,.98,side*1.77],[5.7,.98,side*1.77],.032,steelMat);
    pipe(fb,[-3,2.7,side*1.4],[3,2.7,side*1.4],.025,steelMat);
    for(let k=0;k<8;k++){fb.add(cylinder,steelMat,[-5.6+k*1.6,.51,side*1.77],[.025,.95,.025]);fb.add(finialGeo,steelMat,[-5.6+k*1.6,1.08,side*1.77],[.058,.22,.058]);}
    for(const x of [-3,0,3]){fb.add(sphere,warm,[x,2.3,side*1.4],[.065,.10,.065]);fb.add(cylinder,steelMat,[x,2.3,side*1.4],[.11,.28,.11]);}
  }
  for(const x of [-2.9,0,2.9])coffin(fb,[x,.17,0],1,Math.PI/2,.75);
  for(const x of [-6.3,6.3]){fb.add(finialGeo,steelMat,[x,1.1,0],[.15,1.5,.15]);fb.add(sphere,icy,[x,1.9,0],[.08,.08,.08]);}
  fb.finish('Funeral barge merged');dynamic.push(ferry);
  // Third layer: a flooded abbey, flying buttresses and uneven village spires.
  const far=new THREE.Group();far.name='Sliceable harbour skyline';root.add(far);const farBatch=batch(far);
  const distant=mat({color:'#53656b',map:concrete,bumpMap:stoneB,bumpScale:.04,roughness:.86,metalness:.03,vertexColors:true});distant.userData.worldTextureScale=.5;
  for(let k=0;k<12;k++){
    const x=(k-5.5)*6,z=-43-(k%3)*5.4,h=3.2+(k*13%7);
    pier(farBatch,x,-.3,z,h,1.65,distant);
    if(k%4!==2)farBatch.add(finialGeo,dark,[x,h+1.2,z],[1.65,3.2,1.65]);
    else{farBatch.add(cube,distant,[x-.4,h+.15,z],[.75,.4,.8],[0,.2,.3]);farBatch.add(cube,distant,[x+.4,h+.1,z],[.5,.6,.5],[0,-.1,-.25]);}
    arch(farBatch,[x,.4,z+1.55],1.0,2.4,.12,0,distant);
    farBatch.add(windowGeo,glass,[x,.6,z+1.57],[.67,1.7,1]);
  }
  for(const side of [-1,1]){
    const towerX=side<0?-13.6:9.4,towerZ=side<0?-45:-40,towerHeight=side<0?10.2:12.0;
    pier(farBatch,towerX,0,towerZ,towerHeight,4.0,distant);
    farBatch.add(finialGeo,dark,[towerX,towerHeight+2.4,towerZ],[3.2,5.8,3.2]);
    for(const dx of [-1.8,1.8])for(const dz of [-1.8,1.8])farBatch.add(finialGeo,distant,[towerX+dx,towerHeight+.9,towerZ+dz],[.3,1.8,.3]);
    arch(farBatch,[towerX,4.0,towerZ+2.37],2.2,4.5,.2,0,distant);farBatch.add(windowGeo,glass,[towerX,4.2,towerZ+2.39],[1.5,3.3,1]);
    for(let k=0;k<4;k++)arch(farBatch,[side*(13+k*4),0,-35],3.4,5.0,.8,0,distant,(k+(side>0?1:0))%3===1);
    // Flying buttresses visibly bridge water gaps around the central chapel.
    buttress(farBatch,[towerX,towerHeight*.73,towerZ+1.3],[side*17,1.2,-34],distant);
  }
  arch(farBatch,[1.8,0,-42],10.4,12.3,1.0,0,distant);
  farBatch.add(windowGeo,glass,[1.8,3.8,-41.9],[4.0,6.1,1]);
  farBatch.add(brokenRingGeo,steelMat,[1.8,7.5,-41.7],[1.4,1.4,1.4],[0,0,.42]);
  for(let k=0;k<8;k++){if(k===1||k===2)continue;const a=k*Math.PI/4;pipe(farBatch,[1.8,7.5,-41.68],[1.8+Math.cos(a)*1.4,7.5+Math.sin(a)*1.4,-41.68],.025,steelMat);}
  for(const side of [-1,1])arch(farBatch,[1.8+side*1.18,3.9,-41.62],1.2,3.7,.08,0,distant);
  const farMeshes=farBatch.finish('Harbour far architecture'),slices=[];
  for(const mesh of farMeshes){
    const base=mesh.material.emissiveIntensity,a=slicingMaterial(mesh.material,1),b=slicingMaterial(mesh.material,-1);materials.push(a.material,b.material);
    mesh.material=a.material;const other=mesh.clone();other.material=b.material;other.name='Opposite skyline cut';other.visible=false;far.add(other);slices.push({a:mesh,b:other,ua:a.u,ub:b.u,base});
  }
  // Three compact banks give actual selective power loss and a travelling relight.
  const banks=[],bankBatch=batch(root);
  for(let i=0;i<3;i++){
    for(let j=0;j<4;j++)lamp(bankBatch,[-12+i*12,2.8,-9.5-j*5],i,'neon');
  }
  bankBatch.finish('Merged harbour practical banks');
  // Only two shadow-free real lights; volumetric cones are soft local shafts.
  const searches=[];
  for(const side of [-1,1]){
    const tower=new THREE.Group();tower.position.set(side*14,0,-18);root.add(tower);const b=batch(tower);
    pier(b,0,0,0,6.2,.78);
    arch(b,[0,6.1,0],1.45,2.1,.55,0,stone);b.add(windowGeo,glass,[0,6.28,.04],[.96,1.5,1]);
    b.add(finialGeo,steelMat,[0,8.65,0],[.82,1.3,.82]);b.finish('Abbey moon beacon');
    const aim=new THREE.Group();tower.add(aim);aim.position.set(0,7.7,0);
    const lens=new THREE.Mesh(sphere,icy);lens.scale.set(.17,.17,.17);aim.add(lens);
    const beamMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{strength:{value:.055}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform float strength;void main(){float s=max(0.,sin(clamp(vUv.x,0.,1.)*3.14159));float edge=s*s;gl_FragColor=vec4(.40,.65,.76,edge*pow(clamp(vUv.y,0.,1.),1.5)*strength);}'});
    beamMat.forceSinglePass=true;
    const beam=new THREE.Mesh(new THREE.ConeGeometry(2.9,24,16,1,true),beamMat);beam.position.y=-12;aim.add(beam);materials.push(beamMat);
    const light=new THREE.SpotLight('#94d9f1',25,46,.18,.6,1.5);light.position.copy(tower.position).add(new THREE.Vector3(0,7.7,0));root.add(light);root.add(light.target);ownedLights.push(light);
    searches.push({side,aim,light,beam,beamMat});
  }
  const waterGeo=new THREE.PlaneGeometry(76,62,42,36),water=new Reflector(waterGeo,{shader:mirrorShader(normal),textureWidth:384,textureHeight:384,multisample:0,clipBias:.004});
  // Reflector clones custom uniforms. Keep one owned normal texture, so a
  // district reset does not retain an untracked GPU copy of the water map.
  water.material.uniforms.normalMap.value.dispose();water.material.uniforms.normalMap.value=normal;
  water.name='Animated reflected harbour water';water.rotation.x=-Math.PI/2;water.position.set(0,-.78,-13);water.frustumCulled=false;root.add(water);
  const originalReflection=water.onBeforeRender;let useReflection=false,reflectionTick=-1,reflectionBudget=true;
  function updateReflection(renderer,scene,camera){
    const tick=Math.floor(water.material.uniforms.clock.value*18);
    // No extra render in Light/reduced, and at most 18 mirror updates/sec in High.
    if(useReflection&&(tick!==reflectionTick||camera.userData?.forceWaterReflection)){
      reflectionTick=tick;
      // Distant skyline and translucent shafts do not need a second draw on
      // water. The actual ferry, crane, containers, fighters and pier reflect.
      far.visible=false;searches.forEach(s=>s.beam.visible=false);drainLines.visible=false;
      try{originalReflection.call(water,renderer,scene,camera);}
      finally{far.visible=true;searches.forEach(s=>s.beam.visible=true);drainLines.visible=cinematic.lightDrain>.005;}
      return true;
    }
    return false;
  }
  water.onBeforeRender=function(renderer,scene,camera){updateReflection(renderer,scene,camera);};
  const deckWet=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{clock:{value:0},strength:{value:.15},ripple:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 vUv;uniform float clock,strength,ripple;${HASH}void main(){float n=noise(vUv*vec2(7.,11.)-vec2(0.,clock*.11));float surge=smoothstep(.65-ripple*.5,.92-ripple*.35,vUv.y)*ripple;gl_FragColor=vec4(.19,.34,.39,surge*(.11+n*.12)*strength);}`});
  const sheen=new THREE.Mesh(new THREE.PlaneGeometry(15.8,9.8),deckWet);sheen.rotation.x=-Math.PI/2;sheen.position.y=.014;root.add(sheen);materials.push(deckWet);
  const drainPositions=new Float32Array(24*2*3),drainGeo=new THREE.BufferGeometry();drainGeo.setAttribute('position',new THREE.BufferAttribute(drainPositions,3));
  const drainMat=new THREE.LineBasicMaterial({color:'#80d9ef',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});materials.push(drainMat);
  const drainLines=new THREE.LineSegments(drainGeo,drainMat);drainLines.name='Practical light draining';drainLines.frustumCulled=false;root.add(drainLines);
  const landmark=(id,name,position,kind,object=null,offset=[0,0,0])=>landmarks.push({id,name,position,kind,object,offset});
  landmark('pier','Dock 61 fighting pier',[0,0,0],'stage');landmark('pier-edge','Harbour edge',[0,-.4,-5],'water');
  landmark('crane-hoist','Abbey chain hoist',[0,5.5,-13.8],'machinery',trolley,[0,5.5,0]);landmark('ferry','Funeral barge',[-6,.5,-25],'vehicle',ferry,[0,1,0]);
  landmark('container-stack','Arched mortuary stores',[-11,3,-10],'architecture');landmark('harbour-tower','Abbey moon beacon',[14,7.7,-18],'light');
  landmark('skyline','Flooded abbey skyline',[0,6,-42],'skyline');landmark('water','Black Tide surface',[0,-.78,-9],'water');
  let layout=0,visible=true,cinematic=normalizeEnvironmentCinematic(),clock=0;
  const temp=new THREE.Vector3(),focus=new THREE.Vector3(),plane=new THREE.Vector4(),normalV=new THREE.Vector3(),warmColor=new THREE.Color('#ffb47c');
  return {
    root, water, stage:BLACK_TIDE_STAGE,
    reflectionPlan(){return {enabled:visible&&useReflection,maxPasses:1,maxHz:18,excluded:[water,far,...searches.map(s=>s.beam),drainLines]};},
    setReflectionBudget(enabled){reflectionBudget=Boolean(enabled);if(!reflectionBudget){useReflection=false;water.material.uniforms.reflecting.value=0;}},
    updateReflection(renderer,scene,camera){return visible&&updateReflection(renderer,scene,camera);},
    setVisible(value){visible=Boolean(value);root.visible=visible;ownedLights.forEach(light=>light.visible=visible);},
    setCinematicState(value){cinematic=normalizeEnvironmentCinematic(value);},
    resetCinematicState(){cinematic=normalizeEnvironmentCinematic();slices.forEach(s=>{s.a.position.set(0,0,0);s.b.position.set(0,0,0);s.b.visible=false;s.ua.active.value=s.ub.active.value=0;});},
    landmarks(){root.updateMatrixWorld(true);return landmarks.map(entry=>({id:entry.id,name:entry.name,kind:entry.kind,position:entry.object?entry.object.localToWorld(temp.set(...entry.offset)).toArray():[...entry.position]}));},
    update(time,state,lightState,options={}){
      clock=options.reduced?0:time;layout=state.layout;variants.forEach((v,i)=>v.group.visible=i===layout);
      pierLighting.life.value.set(lightState.blackout?0:lightState.neon,lightState.blackout?0:lightState.practical);
      pierLighting.candles.value.set(...[0,1,2].map(i=>fixtureLightFactor(lightState,i,[-5.8+i*5.8,1.3,-5.13])));
      if(options.cinematic!==undefined)cinematic=normalizeEnvironmentCinematic(options.cinematic);
      trolley.position.x=Math.sin(clock*.14+state.cycle*.63)*5.8;trolley.rotation.z=Math.sin(clock*.53)*.016;
      gantry.position.z=layout===1?-19.4:layout===2?-24:-21;
      ferry.position.x=Math.sin(clock*.06+state.cycle*.57)*18;ferry.position.y=-.28+Math.sin(clock*.7)*.045;ferry.rotation.z=Math.sin(clock*.53)*.012;
      for(const entry of practicals){
        const amount=fixtureLightFactor(lightState,entry.index,entry.position,entry.family),flame=entry.family==='practical'?.965+Math.sin(clock*1.17+entry.index*1.73)*.035:1;
        entry.material.emissiveIntensity=entry.base*amount*flame;
        entry.material.emissive.copy(entry.colour).lerp(warmColor,lightState.warm*.35);
      }
      icy.emissiveIntensity=.7*lightState.neon+lightState.relightWave*.4;warm.emissiveIntensity=.8*Math.max(lightState.practical,lightState.relightWave);glass.emissiveIntensity=.2*Math.max(lightState.neon,lightState.relightWave);
      for(const {side,aim,light,beamMat} of searches){
        const a=side*.8+Math.sin(clock*.17+side)*.58;aim.rotation.set(0,0,a);aim.rotation.x=.8;
        temp.set(side*14-Math.sin(a)*18,-1,-20+Math.sin(clock*.13+side)*10);light.target.position.copy(temp);
        const factor=fixtureLightFactor(lightState,side<0?0:1,light.position.toArray());light.intensity=25*factor;light.visible=visible;
        beamMat.uniforms.strength.value=.042*factor;
      }
      useReflection=reflectionBudget&&options.reflections!==false&&!options.low&&!options.reduced&&!lightState.blackout;const u=water.material.uniforms;
      u.clock.value=clock;u.reflecting.value=useReflection?1:0;u.strength.value=lightState.arenaStrength;
      u.ripple.value=clamp(cinematic.ripple+(options.impact||0)*.6);u.ferry.value.set(ferry.position.x,ferry.position.z);u.focus.value.set(cinematic.focus[0],cinematic.focus[2]);
      u.color.value.set('#091d27').multiplyScalar(lightState.blackout?0:.25+lightState.arenaStrength*.75);
      deckWet.uniforms.clock.value=clock;deckWet.uniforms.strength.value=.38*lightState.arenaStrength;deckWet.uniforms.ripple.value=u.ripple.value;
      sheen.visible=u.ripple.value>.004;
      // Complementary clipped meshes really separate, then return to exact origin.
      plane.set(...cinematic.slicePlane);normalV.set(plane.x,plane.y,plane.z);
      slices.forEach(s=>{
        const progress=cinematic.slice;s.a.position.copy(normalV).multiplyScalar(progress*2.4);s.b.position.copy(normalV).multiplyScalar(-progress*2.4);s.b.visible=progress>.001;
        s.ua.active.value=s.ub.active.value=progress;s.ua.plane.value.copy(plane);s.ub.plane.value.copy(plane);s.ua.shift.value.copy(s.a.position);s.ub.shift.value.copy(s.b.position);
        // Keep material power coupled with the same practical banks as geometry.
        if(s.a.material.emissive.getHex()!==0){s.a.material.emissiveIntensity=s.base*Math.max(lightState.neon,lightState.relightWave);s.b.material.emissiveIntensity=s.a.material.emissiveIntensity;}
      });
      drainLines.visible=cinematic.lightDrain>.005;drainMat.opacity=cinematic.lightDrain*.42;focus.set(...cinematic.focus);
      for(let i=0;i<24;i++){
        const source=new THREE.Vector3((i%3-1)*12,2.8,-9.5-Math.floor(i/3)%4*5),p=(clock*.65+i*.137)%1;
        temp.copy(source).lerp(focus,p);temp.y+=Math.sin(p*Math.PI)*.5;drainPositions.set(temp.toArray(),i*6);
        temp.copy(source).lerp(focus,Math.min(1,p+.045));temp.y+=Math.sin(p*Math.PI)*.5;drainPositions.set(temp.toArray(),i*6+3);
      }drainGeo.attributes.position.needsUpdate=true;
    },
    snapshot(){let calls=0,triangles=0;root.traverseVisible(o=>{if(o.isMesh||o.isLineSegments){calls++;if(o.geometry)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});return {layout:BLACK_TIDE_LAYOUTS[layout],stage:BLACK_TIDE_STAGE,geometryDraws:calls,triangles:Math.round(triangles),planarReflection:useReflection,mirrorHz:18,parallaxLayers:3,propFamilies:6,clock};},
    dispose(){water.dispose();textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());ownedLights.forEach(l=>{l.removeFromParent();l.target.removeFromParent();});root.traverse(o=>{if(o.geometry)o.geometry.dispose();});root.removeFromParent();cube.dispose();cylinder.dispose();sphere.dispose();scratchGeo.dispose();railGeo.dispose();archGeo.dispose();ruinedArchGeo.dispose();windowGeo.dispose();coffinGeo.dispose();finialGeo.dispose();ringGeo.dispose();chainGeo.dispose();brokenRingGeo.dispose();capitalGeo.dispose();voussoirs.forEach(v=>v.geometry.dispose());},
  };
}
