import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const THEMES=[
 {name:'rain',sky:'#07142a',horizon:'#234553',accent:'#5befd9',fog:'#132b37'},
 {name:'foundry',sky:'#170f1e',horizon:'#763b25',accent:'#ff8647',fog:'#39272b'},
 {name:'vault',sky:'#0c112a',horizon:'#343361',accent:'#ae9fff',fog:'#22243b'},
 {name:'market',sky:'#291635',horizon:'#82554c',accent:'#ffb26e',fog:'#382735'},
 {name:'garden',sky:'#092531',horizon:'#376862',accent:'#a4f0b9',fog:'#203b3b'},
 {name:'docks',sky:'#151e3d',horizon:'#956056',accent:'#88d7ff',fog:'#293548'},
];
export function environmentVariantFor(level,seed=0) {
 const index=(Math.max(1,level)-1)%6, cycle=Math.floor((Math.max(1,level)-1)/6);
 return {index,cycle,theme:THEMES[index].name,layout:(cycle+((seed>>>0)%3))%3,dressingKey:(Math.imul(level,2654435761)+(seed>>>0))>>>0,weather:cycle%3,trafficSpeed:1+(cycle%5)*.12};
}
function canvasTexture(paint,w=512,h=512) {
 const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d'),w,h);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
const noiseGLSL=`float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}float fbm(vec2 p){float n=0.,a=.5;for(int i=0;i<4;i++){n+=a*noise(p);p=p*2.03+13.;a*=.5;}return n;}`;
function flowingMaterial(color,kind=0) {
 return new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
  uniforms:{time:{value:0},tint:{value:new THREE.Color(color)},kind:{value:kind},low:{value:0}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`varying vec2 vUv;uniform float time;uniform vec3 tint;uniform float kind;uniform float low;${noiseGLSL}
  void main(){vec2 p=vUv;float n=low>.5?noise(p*vec2(5.,3.)-vec2(time*.12,time*.19)):fbm(p*vec2(5.,3.)-vec2(time*.12,time*.19));float edges=smoothstep(0.,.18,p.x)*(1.-smoothstep(.82,1.,p.x))*smoothstep(0.,.1,p.y)*(1.-smoothstep(.68,1.,p.y));
  float a=edges*n*.30;if(kind>.5){float flame=1.-p.y-fbm(p*vec2(4.,5.)-vec2(time*.2,time*1.5))*.65;a=smoothstep(.03,.28,flame)*edges*.8;}gl_FragColor=vec4(tint*(kind>.5?2.:1.),a);}`});
}
export function createEnvironment(scene) {
 const root=new THREE.Group();root.name='World';scene.add(root);
 const stages=Array.from({length:6},(_,i)=>{const g=new THREE.Group();g.name=THEMES[i].name;root.add(g);return g;});
 const animations=[],flows=[],lights=[],textures=[],cityBlocks=[];
 const metal=new THREE.MeshStandardMaterial({color:'#344653',roughness:.35,metalness:.75});
 const concrete=new THREE.MeshStandardMaterial({color:'#33414b',roughness:.88});
 const dark=new THREE.MeshStandardMaterial({color:'#101723',roughness:.63,metalness:.2});
 const rounded=new RoundedBoxGeometry(1,1,1,2,.06),box=new THREE.BoxGeometry(1,1,1);
 const glow=color=>new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:2.4,roughness:.3});
 function add(geo,mat,pos,scale=[1,1,1],parent=root){const o=new THREE.Mesh(geo,mat);o.position.set(...pos);o.scale.set(...scale);o.castShadow=o.receiveShadow=true;parent.add(o);return o;}
 function pipe(points,radius,mat,parent){return add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),24,radius,8,false),mat,[0,0,0],[1,1,1],parent);}
 function sign(text,color,pos,size,parent){
  const map=canvasTexture((c,w,h)=>{c.fillStyle='#080f19';c.fillRect(0,0,w,h);c.strokeStyle=color;c.lineWidth=5;c.strokeRect(6,6,w-12,h-12);c.fillStyle=color;c.font='700 62px "Chakra Petch",sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,w/2,h/2);},512,128);textures.push(map);
  return add(new THREE.PlaneGeometry(...size),new THREE.MeshStandardMaterial({map,emissiveMap:map,emissive:'#ffffff',emissiveIntensity:1.6,roughness:.5}),pos,[1,1,1],parent);
 }
 const asphalt=canvasTexture((c,w,h)=>{
  c.fillStyle='#40444a';c.fillRect(0,0,w,h);
  for(let i=0;i<14000;i++){const x=(i*173)%w,y=(i*229)%h;c.fillStyle=i%3?'rgba(0,0,0,.11)':'rgba(255,255,255,.12)';c.fillRect(x,y,1+i%2,1);}
  c.strokeStyle='#292d32';c.lineWidth=2;for(let i=0;i<14;i++){c.beginPath();c.moveTo(i*43,0);c.lineTo(i*43+29,h);c.stroke();}
 });asphalt.wrapS=asphalt.wrapT=THREE.RepeatWrapping;asphalt.repeat.set(5,4);textures.push(asphalt);
 const floorMat=new THREE.MeshStandardMaterial({color:'#434b50',map:asphalt,roughness:.27,metalness:.25});
 const floorMaps=[asphalt,...Array.from({length:5},(_,n)=>{
  const index=n+1,map=canvasTexture((c,w,h)=>{
   c.fillStyle=['','#34353b','#172434','#554a47','#344443','#51473e'][index];c.fillRect(0,0,w,h);
   if(index===1){
    for(let y=0;y<h;y+=128){c.fillStyle=y%256?'#3d3d43':'#292e37';c.fillRect(0,y,w,126);
     for(let x=24;x<w;x+=96){c.fillStyle='#736a5e';c.beginPath();c.arc(x,y+14,3,0,Math.PI*2);c.fill();}}
    c.strokeStyle='rgba(144,92,44,.18)';for(let i=0;i<25;i++){c.beginPath();c.moveTo(i*23,0);c.lineTo(i*23+60,h);c.stroke();}
   }else if(index===2){
    c.strokeStyle='#385c69';c.lineWidth=2;for(let r=70;r<390;r+=85){c.beginPath();for(let k=0;k<4;k++){const a=k*Math.PI*2/3-Math.PI/2;c.lineTo(w/2+Math.cos(a)*r,h/2+Math.sin(a)*r);}c.stroke();}
    c.fillStyle='#51808a';for(let i=0;i<90;i++){const x=i*179%w,y=i*277%h;c.fillRect(x,y,1,1);}
   }else if(index===3){
    for(let y=0;y<h;y+=42)for(let x=-30;x<w;x+=76){const ox=y%84?34:0;c.fillStyle=['#635a53','#494541','#74665b'][(x+y+90)%3];c.beginPath();c.roundRect(x+ox,y,71,36,8);c.fill();}
   }else if(index===4){
    c.strokeStyle='#253936';c.lineWidth=3;for(let i=0;i<8;i++){c.beginPath();c.moveTo(i*70,0);c.lineTo(i*70+12,180);c.lineTo(i*70-30,h);c.stroke();}
    for(let i=0;i<1100;i++){c.fillStyle=i%5?'rgba(83,102,57,.24)':'rgba(135,186,120,.21)';c.fillRect(i*173%w,i*211%h,2,2);}
   }else{
    for(let y=0;y<h;y+=64){c.fillStyle=y%128?'#5b5046':'#423e39';c.fillRect(0,y,w,61);
     c.strokeStyle='rgba(22,29,30,.28)';for(let k=0;k<7;k++){c.beginPath();c.moveTo(0,y+8+k*7);c.bezierCurveTo(180,y+k*7,330,y+22+k*7,w,y+7+k*7);c.stroke();}
     for(const x of [14,w-14]){c.fillStyle='#282c2f';c.beginPath();c.arc(x,y+16,3,0,Math.PI*2);c.fill();}}
   }
  });map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(index===5?2:3,index===5?3:4);textures.push(map);return map;
 })];
 const ground=add(new THREE.PlaneGeometry(28,24),floorMat,[0,-.025,0]);ground.rotation.x=-Math.PI/2;
 const laneMat=new THREE.MeshStandardMaterial({color:'#c7b67a',roughness:.46,metalness:.15});
 for(const s of [-1,1])add(box,laneMat,[s*4.2,.006,0],[.05,.008,16]);
 const facade=canvasTexture((c,w,h)=>{
  c.fillStyle='#142332';c.fillRect(0,0,w,h);
  for(let y=0;y<30;y++)for(let x=0;x<10;x++){
   const v=(x*37+y*13)%11;
   c.fillStyle=v<4?'#20313d':v<8?'#476779':'#ae865b';c.fillRect(12+x*50,9+y*34,26,19);
   c.fillStyle='#0b151e';c.fillRect(24+x*50,9+y*34,2,19);c.fillRect(12+x*50,22+y*34,26,2);
   c.strokeStyle='#1b2c3c';c.strokeRect(x*50,y*34,49,33);
  }
 },512,1024);textures.push(facade);
 const towerMat=new THREE.MeshStandardMaterial({map:facade,emissiveMap:facade,emissive:'#648cba',emissiveIntensity:.28,roughness:.4,metalness:.25});
 function city(parent,offset=0){
  for(let i=0;i<13;i++){
   const x=(i%7-3)*5.8,z=-11-Math.floor(i/7)*8,h=4+(i*7%11);
   const block=new THREE.Group();parent.add(block);cityBlocks.push({block,near:i<7});
   add(rounded,towerMat,[x,h/2,z],[2.8,h,2.5],block);
   add(rounded,metal,[x,h+.12,z],[2.95,.2,2.7],block);
   if(i%3===0)pipe([[x-.5,h,z],[x-.5,h+1.8,z],[x+.5,h+1.8,z]],.025,metal,block);
  }
 }
 // Rain street: a real crosswalk, deep skyline, passing train and road traffic.
 city(stages[0]);
 for(let i=0;i<10;i++)add(rounded,new THREE.MeshStandardMaterial({color:'#9eacaf',roughness:.38}),[(i-4.5)*.48,.01,-1.2],[.27,.008,2.1],stages[0]);
 for(const s of [-1,1]){
  pipe([[s*5,0,-3],[s*5,3.8,-3],[s*3.8,3.8,-3]],.06,metal,stages[0]);
  add(rounded,glow('#cde9ef'),[s*3.8,3.75,-3],[.75,.045,.2],stages[0]);
  add(rounded,concrete,[s*5.2,.22,-2],[2.0,.4,8],stages[0]);
 }
 sign('夜市','#ff916b',[-5,3.1,-5],[2.1,.65],stages[0]);
 sign('AFTER HOURS','#6fe6d5',[4.8,4.2,-6],[2.7,.7],stages[0]);
 add(rounded,metal,[0,3.35,-5.8],[25,.22,1.5],stages[0]);
 const train=new THREE.Group();stages[0].add(train);
 for(let car=0;car<3;car++){
  add(rounded,metal,[(car-1)*4.1,0,0],[4,.85,1.1],train);
  for(let j=0;j<6;j++)add(rounded,glow('#acdce9'),[(car-1)*4.1-1.55+j*.61,.04,.557],[.43,.35,.012],train);
 }
 train.position.set(-10,3.87,-5.8);animations.push({o:train,type:'train',stage:0});
 for(let i=0;i<3;i++){
  const car=new THREE.Group();stages[0].add(car);add(rounded,dark,[0,.35,0],[1.7,.48,.75],car);add(rounded,metal,[-.15,.61,0],[.95,.28,.65],car);
  for(const side of [-1,1])add(rounded,glow('#ee724c'),[.86,.38,side*.23],[.025,.06,.14],car);
  animations.push({o:car,type:'traffic',stage:0,phase:i*8});
 }
 // Foundry: arched furnaces, pumping machinery, heat shimmer and falling sparks.
 for(const s of [-1,1]){
  add(rounded,dark,[s*5,2.3,-4],[3.1,4.6,3],stages[1]);
  const furnaceMat=flowingMaterial('#ff7629',1);flows.push(furnaceMat);
  add(new THREE.PlaneGeometry(2.6,2.4),furnaceMat,[s*5,1.8,-2.45],[1,1,1],stages[1]);
  pipe([[s*5-1.3,.5,-2.5],[s*5-1.3,2.5,-2.5],[s*5,3.1,-2.5],[s*5+1.3,2.5,-2.5],[s*5+1.3,.5,-2.5]],.12,metal,stages[1]);
  const turbine=new THREE.Group();stages[1].add(turbine);turbine.position.set(s*3.6,3.7,-3.5);
  add(new THREE.TorusGeometry(.7,.06,10,48),metal,[0,0,0],[1,1,1],turbine);
  for(let k=0;k<6;k++){const blade=add(rounded,metal,[0,0,0],[1.2,.11,.09],turbine);blade.rotation.z=k*Math.PI/6;}
  animations.push({o:turbine,type:'fan',stage:1,phase:s});
  for(let k=0;k<3;k++){
   const piston=add(new THREE.CylinderGeometry(.10,.12,1.7,16),metal,[s*(3.4+k*.42),1.1,-1.9]);stages[1].add(piston);animations.push({o:piston,type:'piston',stage:1,phase:k+s});
  }
  pipe([[s*6,0,-5],[s*6,5,-5],[s*1.7,5,-5],[s*1.7,2.7,-5]],.13,metal,stages[1]);
 }
 sign('FORGE 06','#ffa168',[0,4.6,-5],[3,.65],stages[1]);
 // Vault: curved glass structures and a suspended orbital mechanism.
 const glass=new THREE.MeshPhysicalMaterial({color:'#4e779a',metalness:.4,roughness:.13,transparent:true,opacity:.45,side:THREE.DoubleSide});
 for(const s of [-1,1]){
  const ring=add(new THREE.TorusGeometry(3.1,.055,12,80),glow('#968cff'),[s*3.9,2.2,-5],[1,1.25,1],stages[2]);
  ring.rotation.y=s*.35;animations.push({o:ring,type:'slowRing',stage:2,phase:s});
  add(new THREE.CylinderGeometry(2.8,2.8,5,40,1,true,0,Math.PI*.9),glass,[s*4.1,2.4,-6],[1,1,1],stages[2]);
 }
 for(let i=0;i<10;i++){
  const shard=add(new THREE.OctahedronGeometry(.38),new THREE.MeshPhysicalMaterial({color:'#8879c0',roughness:.14,metalness:.55,clearcoat:1}),[0,3,-4],[.7,1.8,.7],stages[2]);
  animations.push({o:shard,type:'orbit',stage:2,phase:i*Math.PI/5});
 }
 const vaultBeam=flowingMaterial('#a696ff');flows.push(vaultBeam);add(new THREE.PlaneGeometry(4,5),vaultBeam,[0,2.8,-5],[1,1,1],stages[2]);
 // Market: hanging lights, cloth canopies and stalls rather than another skyline.
 city(stages[3]);
 for(const s of [-1,1]){
  add(rounded,new THREE.MeshStandardMaterial({color:s<0?'#713b3d':'#326864',roughness:.8}),[s*4.5,.8,-3],[2.7,1.6,2],stages[3]);
  for(let k=0;k<4;k++)add(rounded,metal,[s*4.5+(k%2-.5)*2.5,1.8,-3+(Math.floor(k/2)-.5)*1.7],[.04,3.5,.04],stages[3]);
  const cloth=add(new THREE.PlaneGeometry(3.2,2.5,16,8),new THREE.MeshStandardMaterial({color:s<0?'#ad5356':'#66958c',side:THREE.DoubleSide,roughness:.9}),[s*4.5,2.7,-3],[1,1,1],stages[3]);cloth.rotation.x=-Math.PI/2;animations.push({o:cloth,type:'awning',stage:3,phase:s});
  sign(s<0?'麺':'花','#ffc293',[s*4.5,2.18,-1.97],[1.7,.45],stages[3]);
 }
 for(let i=0;i<20;i++){
  const x=(i%10-4.5)*1.0,y=3.9+Math.abs(x)*.07,z=-2.8-Math.floor(i/10)*2.2;
  const lantern=add(new THREE.SphereGeometry(.22,20,12),glow(i%3?'#ed855f':'#f5d493'),[x,y,z],[1,1.28,1],stages[3]);
  add(new THREE.CylinderGeometry(.12,.12,.055,12),metal,[0,.30,0],[1,1,1],lantern);animations.push({o:lantern,type:'lantern',stage:3,phase:i});
 }
 pipe([[-6,4.25,-2.8],[0,3.82,-2.8],[6,4.25,-2.8]],.012,metal,stages[3]);
 // Garden: arched greenhouse, individually curved leaves and running water.
 for(let i=0;i<6;i++)pipe([[-6,0,-3-i*1.5],[-5,4,-3-i*1.5],[0,6,-3-i*1.5],[5,4,-3-i*1.5],[6,0,-3-i*1.5]],.045,metal,stages[4]);
 const leafShape=new THREE.Shape();leafShape.moveTo(0,0);leafShape.bezierCurveTo(-.28,.22,-.21,.65,0,.85);leafShape.bezierCurveTo(.21,.65,.28,.22,0,0);
 const leafGeo=new THREE.ShapeGeometry(leafShape,10),leafMat=new THREE.MeshStandardMaterial({color:'#558959',roughness:.71,side:THREE.DoubleSide});
 for(const s of [-1,1]){
  const tree=new THREE.Group();stages[4].add(tree);tree.position.set(s*4.4,0,-3.7);
  pipe([[0,0,0],[.12,1.4,0],[-.10,2.6,0],[.20,3.4,0]],.12,new THREE.MeshStandardMaterial({color:'#564a40',roughness:.95}),tree);
  for(let k=0;k<9;k++){
   const a=k*2.399, h=1.4+k*.2, x=Math.cos(a)*1.25,z=Math.sin(a)*.6;
   pipe([[0,h,0],[x*.6,h+.18,z*.6],[x,h+.32,z]],.022,concrete,tree);
   for(let j=0;j<4;j++){const leaf=add(leafGeo,leafMat,[x*(.65+j*.1),h+.15+j*.09,z],[.7,.7,.7],tree);leaf.rotation.set(-.4,a+j*.6,Math.sin(a)*.4);}
  }
  animations.push({o:tree,type:'tree',stage:4,phase:s});
 }
 const waterfall=flowingMaterial('#85c5d3');flows.push(waterfall);add(new THREE.PlaneGeometry(4.2,3),waterfall,[0,1.8,-6],[1,1,1],stages[4]);
 // Docks: layered water, hulls, rigging and a moving harbour beacon.
 const waterMat=new THREE.ShaderMaterial({uniforms:{time:{value:0},sun:{value:new THREE.Color('#d98972')}},side:THREE.DoubleSide,
  vertexShader:'varying vec2 vUv;varying vec3 pos;uniform float time;void main(){vUv=uv;vec3 p=position;p.z+=sin(p.x*1.4+time)*.06+cos(p.y*1.7-time*.8)*.04;pos=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
  fragmentShader:`varying vec2 vUv;varying vec3 pos;uniform float time;uniform vec3 sun;${noiseGLSL}void main(){float n=fbm(pos.xy*1.8+time*.12);float stripe=pow(max(0.,sin(pos.y*14.+n*7.+time*1.7)),14.);float reflection=exp(-abs(pos.x)*.55)*(0.35+stripe*.65);gl_FragColor=vec4(mix(vec3(.03,.10,.17),sun,reflection*.47)+stripe*.055,1.);}`});flows.push(waterMat);
 const water=add(new THREE.PlaneGeometry(50,25,40,24),waterMat,[0,-.11,-11],[1,1,1],stages[5]);water.rotation.x=-Math.PI/2;
 for(const s of [-1,1]){
  for(let k=0;k<5;k++)add(new THREE.CylinderGeometry(.16,.19,1.8,12),concrete,[s*5,.25,-k*2],[1,1,1],stages[5]);
  pipe([[s*5,.8,-8],[s*5,.8,0]],.03,metal,stages[5]);
 }
 const ship=new THREE.Group();stages[5].add(ship);ship.position.set(-7,.15,-9);
 add(rounded,dark,[0,.4,0],[5.5,.8,1.8],ship);add(rounded,metal,[.6,1.2,0],[2.2,.9,1.5],ship);
 for(let k=0;k<5;k++)add(rounded,glow('#e5caa2'),[-.2+k*.4,1.2,.77],[.20,.25,.015],ship);
 pipe([[1,1.65,0],[1,3,0],[1.9,3,0]],.035,metal,ship);animations.push({o:ship,type:'ship',stage:5});
 const beacon=add(new THREE.ConeGeometry(1.5,9,32,1,true),new THREE.MeshBasicMaterial({color:'#9bc9db',transparent:true,opacity:.035,side:THREE.DoubleSide,depthWrite:false}),[6,4,-7],[1,1,1],stages[5]);beacon.rotation.z=Math.PI/2;animations.push({o:beacon,type:'beacon',stage:5});
 // Harbour cranes carry hanging containers with articulated booms and ropes.
 for(const side of [-1,1]){
  const crane=new THREE.Group();stages[5].add(crane);crane.position.set(side*7,0,-5);
  add(rounded,metal,[0,2.6,0],[.30,5.2,.3],crane);
  add(rounded,metal,[0,5.2,0],[.55,.45,.55],crane);
  const boom=new THREE.Group();crane.add(boom);boom.position.y=5.2;
  add(rounded,metal,[-side*1.7,0,0],[4.2,.2,.24],boom);
  const cargo=new THREE.Group();boom.add(cargo);cargo.position.set(-side*3, -2.5,0);
  const cargoMat=new THREE.MeshStandardMaterial({color:side<0?'#795340':'#34646e',roughness:.65,metalness:.45});
  add(rounded,cargoMat,[0,0,0],[1.6,.8,.9],cargo);
  for(let j=0;j<9;j++)add(box,metal,[(j-4)*.16,0,.46],[.02,.76,.02],cargo);
  for(const z of [-.32,.32])pipe([[-side*3,.0,z],[-side*3,-2.2,z]],.012,metal,boom);
  animations.push({o:boom,type:'crane',stage:5,phase:side});
 }
 // Three distinct dressing layouts per district, selected by the run seed.
 const layouts=stages.map((stage,index)=>Array.from({length:3},(_,layout)=>{
  const g=new THREE.Group();g.name=`${THEMES[index].name}-layout-${layout}`;stage.add(g);
  const sides=layout===0?[-1,1]:layout===1?[-1]:[1];
  for(const side of sides){
   const x=side*(5.5+layout*.55),z=-3-layout*1.5;
   if(index===0){
    for(let j=0;j<2+layout;j++){add(box,metal,[x+j*side*.45,1.7,z],[.06,3.4,.06],g);add(box,glow(j%2?'#db533e':'#68edb6'),[x+j*side*.45,2.8,z+.08],[.14,.25,.04],g);}
    pipe([[x,4,z],[x,4,z-5],[0,4,-7]],.012,metal,g);
   }else if(index===1){
    for(let j=0;j<3+layout;j++)add(new THREE.CylinderGeometry(.34,.4,1.4+j*.2,16),metal,[x+j*side*.5,.7+j*.1,z],[1,1,1],g);
    const channel=add(box,glow('#f98235'),[side*4.8,.01,-1],[.34,.014,7],g);channel.castShadow=false;
   }else if(index===2){
    for(let j=0;j<3+layout;j++){const q=add(new THREE.OctahedronGeometry(.6),glass,[x-side*j*.7,1+j*.55,z],[1,1.8,1],g);q.rotation.z=(j+layout)*.35;}
    sign('←  ∆  →','#b4a3ff',[0,4.5,-6-layout],[3,.6],g);
   }else if(index===3){
    for(let j=0;j<4+layout;j++){
     const person=new THREE.Group();g.add(person);person.position.set(side*(4.3+j*.25),0,z-j*.6);
     add(new THREE.CapsuleGeometry(.13,.65,4,8),dark,[0,.6,0],[1,1,1],person);add(new THREE.SphereGeometry(.12,10,8),dark,[0,1.12,0],[1,1,1],person);
     animations.push({o:person,type:'crowd',stage:3,phase:j+layout});
    }
   }else if(index===4){
    for(let j=0;j<4+layout;j++){
     const antenna=new THREE.Group();g.add(antenna);antenna.position.set(x-side*j*.4,0,z-j*.4);
     pipe([[0,0,0],[.1,1.2,0],[.25,2+j*.13,0]],.025,metal,antenna);
     add(new THREE.SphereGeometry(.065,12,8),glow('#ade7a3'),[.25,2+j*.13,0],[1,1,1],antenna);
     add(new THREE.TorusGeometry(.18,.012,6,24),glow('#68aeb4'),[.25,1.9+j*.13,0],[1,1,1],antenna);
    }
    pipe([[x,0,z],[side*3,.02,-2],[side*4,.01,3]],.035,dark,g);
   }else{
    for(let j=0;j<3+layout;j++){
     const mat=new THREE.MeshStandardMaterial({color:['#5c7077','#785143','#436064'][j%3],roughness:.72,metalness:.3});
     const container=add(rounded,mat,[x-side*(j%2)*1.4,.5+Math.floor(j/2)*1.02,z],[1.3,1.0,2.2],g);
     for(let k=0;k<7;k++)add(box,metal,[x-side*(j%2)*1.4+(k-3)*.17,.5+Math.floor(j/2)*1.02,z+1.11],[.015,.94,.02],g);
    }
   }
  }
  return g;
 }));
 // Physical rail edges, puddle reflections and wet splashes.
 for(const z of [-5.35,-6.25])add(box,metal,[0,3.49,z],[27,.045,.07],stages[0]);
 for(let j=0;j<5;j++){
  const puddle=add(new THREE.CircleGeometry(.65,32),new THREE.MeshStandardMaterial({color:'#548086',roughness:.05,metalness:.8,transparent:true,opacity:.42}),[-3+j*1.5,.014,1.5+(j%2)*.5],[1,.5,1],stages[0]);puddle.rotation.x=-Math.PI/2;
  const splash=add(new THREE.RingGeometry(.11,.12,16),new THREE.MeshBasicMaterial({color:'#9ad1dc',transparent:true,opacity:.4,side:THREE.DoubleSide}),[-3+j*1.5,.016,1.5+(j%2)*.5],[1,1,1],stages[0]);splash.rotation.x=-Math.PI/2;animations.push({o:splash,type:'splash',stage:0,phase:j});
 }
 // Soft atmosphere occupies the scene's middle distance, not just tiny dots.
 for(let i=0;i<6;i++){
  const steam=flowingMaterial('#8cbbcb');flows.push(steam);
  const plane=add(new THREE.PlaneGeometry(6,2.4),steam,[-8+i*3.2,1.1,-2.1-i%2],[1,1,1]);plane.castShadow=false;
  animations.push({o:plane,type:'steam',phase:i});
 }
 const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{time:{value:0},top:{value:new THREE.Color(THEMES[0].sky)},horizon:{value:new THREE.Color(THEMES[0].horizon)}},
  vertexShader:'varying vec3 vWorld;void main(){vWorld=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`varying vec3 vWorld;uniform float time;uniform vec3 top,horizon;${noiseGLSL}void main(){vec3 d=normalize(vWorld);float h=max(0.,d.y);vec2 p=d.xz/max(.3,d.y+.5);float clouds=noise(p*3.+vec2(time*.012,0.));vec3 c=mix(horizon,top,smoothstep(0.,.75,h));c+=pow(clouds,3.)*.075;gl_FragColor=vec4(c,1.);}`});
 const sky=add(new THREE.SphereGeometry(70,32,20),skyMat,[0,0,0]);sky.castShadow=sky.receiveShadow=false;
 const rainCount=360,rainPos=new Float32Array(rainCount*6),rainGeo=new THREE.BufferGeometry();rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPos,3));
 const rain=new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({color:'#99c4d8',transparent:true,opacity:.24,depthWrite:false}));root.add(rain);
 const moteCount=140,motePos=new Float32Array(moteCount*3),moteGeo=new THREE.BufferGeometry();moteGeo.setAttribute('position',new THREE.BufferAttribute(motePos,3));
 const moteMap=canvasTexture((c,w,h)=>{const g=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);g.addColorStop(0,'white');g.addColorStop(.2,'rgba(255,255,255,.8)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,w,h);},32,32);textures.push(moteMap);
 const motes=new THREE.Points(moteGeo,new THREE.PointsMaterial({color:'#ffc584',size:.09,map:moteMap,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));root.add(motes);
 for(const s of [-1,1]){const l=new THREE.PointLight(s<0?'#6eeed9':'#ff9576',18,13,2);l.position.set(s*4,3.3,-1);scene.add(l);lights.push(l);}
 let current=-1,variation=-1,state=environmentVariantFor(1),timeNow=0;
 return {root,theme:'rain',event:'train',
  update(time,level,district,frame,reduced=false,low=false,seed=0,bossPhase=0){
   state=environmentVariantFor(level,seed);const {index,cycle}=state;
   layouts.forEach((groups,i)=>groups.forEach((g,j)=>{g.visible=i===index&&j===state.layout;g.position.x=((state.dressingKey%101)/100-.5)*.8;g.position.z=((state.dressingKey%137)/136-.5)*1.3;g.rotation.y=((state.dressingKey%53)/52-.5)*.12;}));
   ground.scale.set(index===5?.34:1,index===5?.42:1,1);
   water.position.y=-.11+bossPhase*.13;
   if(index===2)stages[2].rotation.z=-(bossPhase*.025);const t=reduced?0:time;timeNow=t;
   if(current!==index || variation!==cycle){current=index;variation=cycle;stages.forEach((g,i)=>g.visible=i===index);
    const theme=THEMES[index];skyMat.uniforms.top.value.set(theme.sky);skyMat.uniforms.horizon.value.set(theme.horizon);
    scene.fog.color.set(theme.fog);scene.fog.density=index===1?.028:.022;floorMat.color.set(index===1?'#665452':index===3?'#6a6264':'#53656d');
    floorMat.map=floorMaps[index];floorMat.needsUpdate=true;
    floorMat.roughness=index===0||index===5?.21:.43;lights[0].color.set(theme.accent);
    root.userData.theme=theme.name;this.theme=theme.name;
   }
   skyMat.uniforms.time.value=t;flows.forEach(m=>{m.uniforms.time.value=t;if(m.uniforms.low)m.uniforms.low.value=low?1:0;});
   animations.forEach(({o,type,phase=0,stage})=>{
    if(stage!==undefined&&stage!==index)return;
    if(type==='train'){o.position.x=((t*(3.2+bossPhase)+cycle*5+14)%42)-21;this.event='train';}
    else if(type==='traffic'){o.position.set(((t*2.6*state.trafficSpeed+phase)%34)-17,.03,-4.5);}
    else if(type==='fan')o.rotation.z=t*2+phase;
    else if(type==='piston')o.position.y=1.15+Math.sin(t*2.3+phase)*.48;
    else if(type==='orbit'){o.position.set(Math.cos(t*.55*(bossPhase?-1:1)+phase)*3.7,2.6+Math.sin(t*.9+phase)*.75,-4.3+Math.sin(t*.55*(bossPhase?-1:1)+phase)*1.1);o.rotation.set(t*.32+phase,t*.45,phase);}
    else if(type==='slowRing')o.rotation.z=t*.15*phase;
    else if(type==='lantern'){if(bossPhase)o.material.emissiveIntensity=2.4*(.3+.7*Math.abs(Math.sin(t*1.2+phase)));o.rotation.z=Math.sin(t*1.6+phase)*.16;o.position.y=3.9+Math.abs(o.position.x)*.07+Math.sin(t+phase)*.06;}
    else if(type==='awning'){const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++)a.setZ(i,Math.sin(a.getX(i)*3+t*2+phase)*.045+Math.cos(a.getY(i)*2+t)*.04);a.needsUpdate=true;o.geometry.computeVertexNormals();}
    else if(type==='tree')o.rotation.z=Math.sin(t*(.9+bossPhase*.5)+phase)*(.03+bossPhase*.02);
    else if(type==='ship'){o.position.x=Math.sin(t*.13+cycle)*7;o.position.y=.18+Math.sin(t*1.4)*.065;o.rotation.z=Math.sin(t*.7)*.025;}
    else if(type==='crane'){o.rotation.y=Math.sin(t*.18+phase)*.3;o.rotation.z=Math.sin(t*.35+phase)*.025;}
    else if(type==='crowd')o.rotation.z=Math.sin(t+phase)*.035;
    else if(type==='splash'){const age=(t*1.3+phase*.3)%1;o.scale.setScalar(.2+age*1.6);o.material.opacity=(1-age)*.3;}
    else if(type==='beacon')o.rotation.y=t*.55;
    else if(type==='steam'){o.visible=!low||phase<2;o.position.x=-10+((t*.45+phase*3.2)%22);o.material.uniforms.tint.value.set(THEMES[index].horizon);}
   });
   rain.visible=index===0||index===5;rain.material.opacity=.18+(state.weather===1?.12:0);
   rainGeo.setDrawRange(0,low?200:rainCount*2);
   cityBlocks.forEach(({block,near})=>block.visible=near||!low);
   for(let i=0;i<rainCount;i++){
    const x=((i*7.31)%20)-10,y=9-((t*(4.5+state.weather)+i*.73)%9),z=((i*3.77)%13)-7;
    rainPos.set([x,y,z,x-.07,y+.24,z],i*6);
   }rainGeo.attributes.position.needsUpdate=true;
   motes.visible=index!==0;
   motes.material.color.set(index===1?'#ff9b55':index===4?'#cefaad':THEMES[index].accent);
   for(let i=0;i<moteCount;i++)motePos.set([Math.sin(i*2.399+t*.08)*7,((i*.127+t*(index===1?.55:.12))%5)+.2,-6+Math.cos(i*4.57+t*.12)*4],i*3);
   moteGeo.attributes.position.needsUpdate=true;
   lights[0].intensity=15+Math.sin(t*.6)*2+bossPhase*3;lights[1].intensity=11+Math.sin(t*.9)*2;
   if(bossPhase>0){skyMat.uniforms.horizon.value.lerp(new THREE.Color(THEMES[index].accent),bossPhase*.06);if(index===1)flows.forEach(m=>{if(m.uniforms.kind?.value===1)m.uniforms.tint.value.set('#ff9b48');});}

   this.event=['passing trains','working furnaces','orbital mechanism','lantern wind','garden wind','harbour traffic'][index];
  },
  snapshot(){return {theme:this.theme,variant:state.layout,cycle:state.cycle,event:this.event,time:timeNow};},
  dispose(){textures.forEach(t=>t.dispose());lights.forEach(l=>scene.remove(l));},
 };
}
