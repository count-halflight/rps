import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { assetUrl } from '../game/assets.js';
import { createBlackTide } from './environments/blackTide.js';
import { environmentLightState, normalizeEnvironmentCinematic } from './environmentLighting.js';

// Architecture is deliberately separated into silhouettes, a middle distance,
// and the fighting lane. No district is a wall of the same repeated window.
const THEMES = [
  { name:'rain', sky:'#030917', horizon:'#172e49', accent:'#5ee8d1', warm:'#ff8068', fog:'#0f2633' },
  { name:'foundry', sky:'#100b13', horizon:'#6a3224', accent:'#ff853b', warm:'#ffc371', fog:'#2e1e21' },
  { name:'vault', sky:'#07091d', horizon:'#292b57', accent:'#b29dff', warm:'#59dadd', fog:'#151c34' },
  { name:'market', sky:'#180e28', horizon:'#66434c', accent:'#ffbf75', warm:'#fa7369', fog:'#2d2036' },
  { name:'garden', sky:'#071a27', horizon:'#1f5960', accent:'#83e6bc', warm:'#d3e99d', fog:'#173238' },
  { name:'docks', sky:'#030b12', horizon:'#172c39', accent:'#76c8ff', warm:'#bcd9e3', fog:'#11232e' },
];
export function environmentVariantFor(level, seed=0) {
  const index=(Math.max(1,level)-1)%6, cycle=Math.floor((Math.max(1,level)-1)/6);
  return {index,cycle,theme:THEMES[index].name,layout:(cycle+((seed>>>0)%3))%3,
    dressingKey:(Math.imul(level,2654435761)+(seed>>>0))>>>0,weather:cycle%3,trafficSpeed:1+(cycle%5)*.12};
}
const NOISE = `float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){float n=0.,a=.5;for(int i=0;i<4;i++){n+=a*noise(p);p=p*2.03+13.;a*=.5;}return n;}`;
function paintedTexture(draw,w=512,h=512) {
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  draw(canvas.getContext('2d'),w,h);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;return map;
}
function deterministicNoise(ctx,w,h,count=9000,light='.07',dark='.09') {
  for(let i=0;i<count;i++){
    ctx.fillStyle=i%3?`rgba(0,0,0,${dark})`:`rgba(255,255,255,${light})`;
    ctx.fillRect((i*173)%w,(i*229+Math.floor(i/w)*17)%h,1+i%2,1);
  }
}
function atmosphereMaterial(color,mode='mist') {
  return new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{time:{value:0},tint:{value:new THREE.Color(color)},strength:{value:mode==='flame'?.8:.2},low:{value:0}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 vUv;uniform float time,low,strength;uniform vec3 tint;${NOISE}
      void main(){vec2 p=vUv;float n=low>.5?noise(p*vec2(5.,3.)-vec2(time*.08,time*.16)):fbm(p*vec2(5.,3.)-vec2(time*.08,time*.16));
      float edge=smoothstep(0.,.2,p.x)*(1.-smoothstep(.8,1.,p.x))*smoothstep(0.,.12,p.y)*(1.-smoothstep(.65,1.,p.y));
      ${mode==='flame'?'float f=1.-p.y-fbm(p*vec2(5.,6.)-vec2(time*.2,time*1.8))*.62;float a=smoothstep(.02,.30,f)*edge*strength;':'float a=edge*n*strength;'}
      gl_FragColor=vec4(tint${mode==='flame'?'*2.2':''},a);}`});
}
export function createEnvironment(scene) {
  const root=new THREE.Group();root.name='World';scene.add(root);
  const stages=THEMES.map(theme=>{const group=new THREE.Group();group.name=theme.name;root.add(group);return group;});
  const textures=[],animations=[],flows=[],lights=[],distanceGroups=[],optional=[];
  const backdropState={settled:0,statuses:Array(6).fill('loading')};
  const backdropMeshes=[];
  const backdropFiles=THEMES.map(theme=>`art/arena-${theme.name}.webp`);
  const backdropLoader=new THREE.TextureLoader();
  // Independent 1672 × 941 landscapes retain six times the district detail
  // of the former atlas tiles. Each theme uploads its own texture only when
  // that visible stage needs it. The originals remain in the source artifacts.
  stages.forEach((stage,index)=>{
    const geometry=new THREE.CylinderGeometry(36,36,36,80,1,true,Math.PI-1.3,2.6);
    const uv=geometry.attributes.uv;
    for(let i=0;i<uv.count;i++){
      // Cylinder UVs run right-to-left when viewed from inside its rear arc.
      uv.setX(i,1-uv.getX(i));
    }
    const texture=backdropLoader.load(assetUrl(backdropFiles[index]),()=>{
      backdropState.settled++;backdropState.statuses[index]='loaded';
      backdropMeshes[index].visible=index!==5;
    },undefined,()=>{
      // A missing image keeps the procedural stage playable. Waiting for one
      // failed asset can never keep the hand controls disabled indefinitely.
      backdropState.settled++;backdropState.statuses[index]='procedural';
    });
    texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.LinearFilter;
    texture.minFilter=THREE.LinearMipmapLinearFilter;texture.anisotropy=4;
    texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;textures.push(texture);
    const backdropMaterial=new THREE.MeshBasicMaterial({map:texture,fog:false,toneMapped:false,side:THREE.BackSide});
    const backdrop=new THREE.Mesh(geometry,backdropMaterial);backdrop.position.set(0,9,0);
    backdrop.visible=false;backdrop.frustumCulled=false;
    backdrop.name=`${THEMES[index].name}-distant-architecture`;stage.add(backdrop);backdropMeshes.push(backdrop);
    if(index===5){backdrop.scale.setScalar(1.8);backdropMaterial.color.setScalar(.28);backdrop.name='Distant faint harbour atmosphere';}
  });
  const box=new THREE.BoxGeometry(1,1,1),rounded=new RoundedBoxGeometry(1,1,1,3,.075);
  const cylinder=new THREE.CylinderGeometry(1,1,1,24),sphere=new THREE.SphereGeometry(1,24,16);
  const metal=new THREE.MeshStandardMaterial({color:'#34444e',roughness:.31,metalness:.78});
  const brushed=new THREE.MeshStandardMaterial({color:'#707e81',roughness:.44,metalness:.68});
  const concrete=new THREE.MeshStandardMaterial({color:'#303b45',roughness:.91,metalness:.04});
  const dark=new THREE.MeshStandardMaterial({color:'#0c131d',roughness:.55,metalness:.42});
  const weatheredMetal=paintedTexture((c,w,h)=>{
    c.fillStyle='#a3afb0';c.fillRect(0,0,w,h);
    deterministicNoise(c,w,h,19000,'.09','.16');
    for(let i=0;i<90;i++){
      const x=(i*173)%w,y=(i*227)%h;
      c.strokeStyle=i%3?'rgba(35,42,43,.17)':'rgba(215,226,224,.2)';c.lineWidth=i%4?1:2;
      c.beginPath();c.moveTo(x,y);c.lineTo(x+17+i%43,y+(i%7-3));c.stroke();
    }
    for(let i=0;i<24;i++){
      const x=i*157%w,y=i*233%h;const stain=c.createLinearGradient(x,y,x,y+60);
      stain.addColorStop(0,'rgba(89,60,41,.20)');stain.addColorStop(1,'rgba(89,60,41,0)');
      c.fillStyle=stain;c.fillRect(x,y,9+i%13,60);
    }
  },512,512);textures.push(weatheredMetal);
  for(const material of [metal,brushed]){material.map=weatheredMetal;material.bumpMap=weatheredMetal;material.bumpScale=.018;}
  const wornWall=paintedTexture((c,w,h)=>{
    c.fillStyle='#b6bcba';c.fillRect(0,0,w,h);deterministicNoise(c,w,h,21000,'.04','.16');
    for(let i=0;i<26;i++){
      const x=i*139%w;const stain=c.createLinearGradient(x,0,x,h);
      stain.addColorStop(0,'rgba(17,35,43,.34)');stain.addColorStop(.7,'rgba(27,41,47,.04)');stain.addColorStop(1,'rgba(27,41,47,.23)');
      c.fillStyle=stain;c.fillRect(x,0,5+i%22,h);
    }
    c.strokeStyle='rgba(31,49,54,.28)';c.lineWidth=3;
    for(const y of [27,245,487]){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
    for(let i=0;i<90;i++){
      const x=i*109%w,y=i*257%h;c.fillStyle=i%3?'rgba(202,208,200,.15)':'rgba(49,60,59,.22)';c.fillRect(x,y,2+i%7,1+i%3);
    }
  });textures.push(wornWall);concrete.map=wornWall;concrete.bumpMap=wornWall;concrete.bumpScale=.035;
  const lampCache=new Map();
  const glow=(color,intensity=1.7)=>{
    const key=color+intensity;if(!lampCache.has(key))lampCache.set(key,new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:intensity,roughness:.28,metalness:.2}));
    return lampCache.get(key);
  };
  function mesh(geometry,material,position,scale=[1,1,1],parent=root) {
    const object=new THREE.Mesh(geometry,material);object.position.set(...position);object.scale.set(...scale);
    object.receiveShadow=!material.isShaderMaterial;object.castShadow=position[2]>-5&&!material.transparent&&!(material.emissiveIntensity>1);
    parent.add(object);return object;
  }
  function tube(points,radius,material,parent,segments=24) {
    return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),segments,radius,8,false),material,[0,0,0],[1,1,1],parent);
  }
  function cable(points,parent){return tube(points,.015,dark,parent,20);}
  function lightBeam(position,color,parent,width=.55,length=4,rotation=[0,0,0]) {
    const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
      uniforms:{tint:{value:new THREE.Color(color)}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'varying vec2 vUv;uniform vec3 tint;void main(){float a=pow(1.-abs(vUv.x*2.-1.),1.5)*(1.-vUv.y)*.045;gl_FragColor=vec4(tint,a);}'});
    const o=mesh(new THREE.ConeGeometry(width,length,28,1,true),mat,position,[1,1,1],parent);o.rotation.set(...rotation);optional.push(o);return o;
  }
  function sign(text,color,position,size,parent,style='wide') {
    const map=paintedTexture((c,w,h)=>{
      c.fillStyle='#081018';c.fillRect(0,0,w,h);
      c.strokeStyle=color;c.lineWidth=4;c.strokeRect(10,10,w-20,h-20);
      c.fillStyle=color;c.textBaseline='middle';c.textAlign='center';
      c.font=`700 ${style==='vertical'?96:72}px "Barlow Condensed",sans-serif`;
      if(style==='vertical')text.split('').forEach((letter,i)=>c.fillText(letter,w/2,62+i*98));
      else c.fillText(text,w/2,h*.52);
      // Illuminated perimeter and mounting rivets make a real shop fixture.
      c.fillStyle='#79929a';for(const x of [7,w-7])for(const y of [7,h-7])c.fillRect(x-2,y-2,4,4);
    },style==='vertical'?128:768,style==='vertical'?512:160);textures.push(map);
    const material=new THREE.MeshStandardMaterial({map,emissiveMap:map,emissive:'#ffffff',emissiveIntensity:1.2,roughness:.28,metalness:.35});
    mesh(rounded,dark,[position[0],position[1],position[2]-.045],[size[0]+.10,size[1]+.10,.075],parent);
    return mesh(new THREE.PlaneGeometry(...size),material,position,[1,1,1],parent);
  }
  function floorTexture(index) {
    const map=paintedTexture((c,w,h)=>{
      c.fillStyle=['#333f43','#36373a','#19262f','#504a47','#344542','#4c473f'][index];c.fillRect(0,0,w,h);
      if(index===0){
        c.strokeStyle='#17262b';c.lineWidth=4;
        for(let i=0;i<16;i++){c.beginPath();c.moveTo(i*79,0);c.lineTo(i*79-30,180);c.lineTo(i*79+48,h);c.stroke();}
        for(let i=0;i<32;i++){c.fillStyle='rgba(15,35,40,.23)';c.beginPath();c.ellipse(i*179%w,i*277%h,24+i%20,9+i%12,.3,0,Math.PI*2);c.fill();}
      }else if(index===1){
        for(let y=0;y<h;y+=128){c.fillStyle=y%256?'#3c3d3e':'#282f33';c.fillRect(0,y,w,124);
          for(let x=24;x<w;x+=96){c.fillStyle='#756857';c.beginPath();c.arc(x,y+14,3,0,Math.PI*2);c.fill();}}
        c.strokeStyle='rgba(169,94,40,.12)';for(let i=0;i<25;i++){c.beginPath();c.moveTo(i*43,0);c.lineTo(i*43+90,h);c.stroke();}
      }else if(index===2){
        c.strokeStyle='#304952';c.lineWidth=2;for(let r=90;r<700;r+=132){c.beginPath();for(let k=0;k<4;k++){const a=k*Math.PI*2/3-Math.PI/2;c.lineTo(w/2+Math.cos(a)*r,h/2+Math.sin(a)*r);}c.stroke();}
        const gradient=c.createLinearGradient(0,0,w,h);gradient.addColorStop(0,'rgba(108,137,150,.03)');gradient.addColorStop(.5,'rgba(175,202,202,.16)');gradient.addColorStop(1,'rgba(29,36,66,.05)');c.fillStyle=gradient;c.fillRect(0,0,w,h);
      }else if(index===3){
        for(let y=0;y<h;y+=44)for(let x=-40;x<w;x+=82){const shift=y%88?38:0;c.fillStyle=['#615852','#454443','#71635b'][Math.abs(Math.floor((x+y)/7))%3];c.beginPath();c.roundRect(x+shift,y,77,39,5);c.fill();}
      }else if(index===4){
        c.strokeStyle='#20352e';c.lineWidth=4;for(let i=0;i<16;i++){c.beginPath();c.moveTo(i*73,0);c.lineTo(i*73+12,180);c.lineTo(i*73-30,h);c.stroke();}
        for(let i=0;i<1900;i++){c.fillStyle=i%5?'rgba(62,88,43,.23)':'rgba(135,185,123,.19)';c.fillRect(i*173%w,i*211%h,4,3);}
      }else{
        for(let y=0;y<h;y+=74){c.fillStyle=y%148?'#544b43':'#3c3c38';c.fillRect(0,y,w,70);
          c.strokeStyle='rgba(14,25,29,.35)';for(let k=0;k<9;k++){c.beginPath();c.moveTo(0,y+5+k*7);c.bezierCurveTo(280,y+k*7,660,y+22+k*7,w,y+7+k*7);c.stroke();}
          for(const x of [20,w-20]){c.fillStyle='#282e2f';c.beginPath();c.arc(x,y+16,4,0,Math.PI*2);c.fill();}}
      }
      deterministicNoise(c,w,h,18000);
    },1024,1024);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(index===5?2:3,index===5?3:3);textures.push(map);return map;
  }
  const floorMaps=THEMES.map((_,i)=>floorTexture(i));
  const floorMat=new THREE.MeshStandardMaterial({color:'#899397',map:floorMaps[0],bumpMap:floorMaps[0],bumpScale:.014,roughness:.24,metalness:.38});
  const ground=mesh(new THREE.PlaneGeometry(32,34),floorMat,[0,-.028,0]);ground.rotation.x=-Math.PI/2;
  // A faint, broken neon reflection belongs to the pavement, rather than a
  // mirror render which would double the cost on phones.
  const reflectionMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
    uniforms:{time:{value:0},tint:{value:new THREE.Color(THEMES[0].accent)},warm:{value:new THREE.Color(THEMES[0].warm)},strength:{value:.22}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 vUv;uniform float time,strength;uniform vec3 tint,warm;${NOISE}
    void main(){vec2 p=vUv;float n=fbm(p*vec2(25.,8.)+vec2(0.,time*.04));float streak=pow(max(0.,sin(p.x*46.+n*3.)),18.);float pool=smoothstep(.27,.66,n);float fade=smoothstep(0.,.25,p.y)*(1.-smoothstep(.72,1.,p.y));
      vec3 c=mix(tint,warm,smoothstep(.28,.74,p.x));gl_FragColor=vec4(c,(pool*.15+streak*.5)*fade*strength);}`});
  const reflections=mesh(new THREE.PlaneGeometry(18,15),reflectionMat,[0,.009,-2]);reflections.rotation.x=-Math.PI/2;
  const facadeMaps=Array.from({length:4},(_,variant)=>{
    const map=paintedTexture((c,w,h)=>{
      c.fillStyle=['#172532','#25282e','#182834','#252531'][variant];c.fillRect(0,0,w,h);
      for(let row=0;row<22;row++)for(let col=0;col<8;col++){
        const x=13+col*62,y=13+row*46,v=(row*19+col*37+variant*11)%17;
        c.fillStyle=v<10?'#101b26':v<14?['#b29169','#879ea6','#779ba7','#b49779'][variant]:'#557381';
        c.fillRect(x,y,35+(variant%2)*11,25);c.fillStyle='#0d1821';c.fillRect(x+17,y,3,25);
        if(variant===1){c.fillStyle='#323840';c.fillRect(0,y+32,w,5);}
      }
      deterministicNoise(c,w,h,7000,'.025','.08');
    },512,1024);textures.push(map);return map;
  });
  const facades=facadeMaps.map(map=>new THREE.MeshStandardMaterial({map,emissiveMap:map,emissive:'#9badaf',emissiveIntensity:.14,roughness:.53,metalness:.28}));
  function skyline(parent,mode='city') {
    // Leave the centre open so the skyline reads as a city, not a theatre wall.
    const locations=[[-17,-20,16],[-12,-25,20],[-8,-24,12],[9,-23,17],[15,-20,12],[21,-31,24],[-23,-37,22],[1,-39,25],[7,-36,28],[-5,-43,17],[28,-43,30]];
    locations.forEach(([x,z,h],i)=>{
      const group=new THREE.Group();parent.add(group);distanceGroups.push({group,near:i<6||i===7||i===8});
      const width=3.2+(i%3)*1.2;
      const block=mesh(rounded,facades[(i+(mode==='market'?1:0))%4],[x,h/2,z],[width,h,3.5+(i%2)],group);block.castShadow=false;
      mesh(rounded,metal,[x,h+.1,z],[width+0.25,.25,3.7+(i%2)],group);
      if(i%3===0){
        mesh(rounded,dark,[x,h+1.1,z],[width*.58,2,width*.7],group);
        tube([[x,h+2,z],[x,h+4,z],[x+.9,h+4,z]],.028,brushed,group);
        mesh(sphere,glow('#ff7b67',1),[x,h+4.02,z],[.075,.075,.075],group);
      }
      if(i===2||i===3){
        mesh(rounded,glow(i===2?'#60c4c9':'#b481c1',.7),[x-width*.49,h*.55,z+1.83],[.055,h*.7,.025],group);
      }
    });
  }
  function shopFront(x,z,color,parent,style=0) {
    const group=new THREE.Group();parent.add(group);group.position.set(x,0,z);
    const mat=new THREE.MeshStandardMaterial({color,map:wornWall,bumpMap:wornWall,bumpScale:.025,roughness:.82,metalness:.12});
    mesh(rounded,mat,[0,1.9,0],[3.6,3.8,2],group);
    mesh(rounded,dark,[0,1.3,1.04],[2.8,2.5,.10],group);
    const shutters=new THREE.MeshStandardMaterial({color:'#25373e',roughness:.44,metalness:.6});
    for(let i=0;i<12;i++)mesh(box,shutters,[.9,1.3+(i-5.5)*.14,1.12],[.9,.1,.02],group);
    mesh(rounded,new THREE.MeshPhysicalMaterial({color:'#69878b',roughness:.14,metalness:.4,transparent:true,opacity:.26}),[-.62,1.6,1.12],[1.1,1.35,.02],group);
    for(const dx of [-1.65,1.65])mesh(rounded,brushed,[dx,1.9,1.15],[.11,3.8,.12],group);
    mesh(rounded,dark,[0,3.9,0],[3.95,.16,2.15],group);
    const awning=mesh(rounded,new THREE.MeshStandardMaterial({color:style?'#735059':'#385b5b',roughness:.8}),[0,2.78,1.55],[3.85,.10,1.15],group);awning.rotation.x=.18;
    sign(style?'NIGHT SHIFT':'24 / 7',style?'#faaf75':'#87e7cf',[0,3.35,1.17],[2.9,.57],group);
    tube([[-1.76,0,1.1],[-1.76,3.1,1.1],[1.76,3.1,1.1],[1.76,0,1.1]],.025,glow(style?'#db776b':'#61bcb3',1),group);
    return group;
  }
  // Rain district: side streets and staggered silhouettes create an actual
  // distance behind the fighters. An elevated train passes behind the shops.
  skyline(stages[0]);
  shopFront(-6,-6,'#33434b',stages[0]);shopFront(6.3,-7.1,'#3a3443',stages[0],1);
  for(const side of [-1,1]){
    mesh(rounded,concrete,[side*5.65,.14,-1.1],[1.6,.25,12],stages[0]);
    for(let i=0;i<3;i++)mesh(box,dark,[side*5.3,.275,-4+i*3.5],[.6,.035,.33],stages[0]);
    tube([[side*4.7,0,-2.5],[side*4.7,3.8,-2.5],[side*3.9,3.8,-2.5]],.044,brushed,stages[0]);
    mesh(rounded,glow('#d7e6de',1),[side*3.9,3.75,-2.5],[.68,.04,.16],stages[0]);
    lightBeam([side*3.9,1.8,-2.5],'#a8d6d4',stages[0],1.25,3.8);
    mesh(rounded,metal,[side*6.6,.65,-.8],[.55,1.3,.7],stages[0]);
    for(let i=0;i<5;i++)mesh(box,dark,[side*6.6,.7+(i-2)*.11,-.437],[.38,.04,.02],stages[0]);
    cable([[side*8,5.2,-6],[side*5,4.8,-4],[side*4.5,5.1,2]],stages[0]);
  }
  const roadPaint=new THREE.MeshStandardMaterial({color:'#bfc6c0',roughness:.7});
  for(let i=0;i<9;i++)mesh(rounded,roadPaint,[(i-4)*.45,.006,-1.8],[.23,.009,1.8],stages[0]);
  for(const side of [-1,1])mesh(box,new THREE.MeshStandardMaterial({color:'#b9a879',roughness:.52}),[side*4,.003,0],[.043,.004,15],stages[0]);
  mesh(rounded,metal,[0,4.5,-12.7],[31,.25,1.7],stages[0]);
  for(const side of [-1,1])mesh(rounded,concrete,[side*9,2.2,-12.7],[.65,4.4,.9],stages[0]);
  const train=new THREE.Group();stages[0].add(train);
  for(let car=0;car<3;car++){
    mesh(rounded,new THREE.MeshStandardMaterial({color:'#59626a',roughness:.4,metalness:.65}),[(car-1)*4.2,0,0],[4.1,1.15,1.25],train);
    mesh(box,glow('#d6c89b',.9),[(car-1)*4.2,-.23,.632],[4.0,.045,.013],train);
    for(let j=0;j<6;j++)mesh(rounded,glow('#80aeb6',.85),[(car-1)*4.2-1.6+j*.63,.15,.633],[.39,.43,.02],train);
  }
  train.position.set(0,5.2,-12.7);animations.push({o:train,type:'train',stage:0});
  for(let i=0;i<3;i++){
    const car=new THREE.Group();stages[0].add(car);
    mesh(rounded,dark,[0,.3,0],[1.75,.43,.75],car);mesh(rounded,metal,[-.1,.57,0],[.93,.24,.64],car);
    for(const side of [-1,1])mesh(rounded,glow('#ee8165',1.2),[.88,.32,side*.25],[.025,.055,.12],car);
    animations.push({o:car,type:'traffic',stage:0,phase:i*11});
  }
  // Foundry: an industrial cathedral around a hot, rotating circular reactor.
  const iron=new THREE.MeshStandardMaterial({color:'#403b3a',map:weatheredMetal,bumpMap:weatheredMetal,bumpScale:.028,roughness:.61,metalness:.8});
  for(const side of [-1,1]){
    for(let j=0;j<3;j++){
      mesh(rounded,iron,[side*(5.3+j*.4),2.7,-5-j*3.2],[.23,5.4,.30],stages[1]);
      tube([[side*(5.3+j*.4),5.3,-5-j*3.2],[side*3.3,6.7,-5-j*3.2],[0,7.1,-5-j*3.2]],.12,iron,stages[1]);
    }
    const housing=mesh(new THREE.CylinderGeometry(1.15,1.3,3.8,28),iron,[side*5,1.9,-5.5],[1,1,1],stages[1]);
    for(const y of [.4,1.45,2.7,3.7])mesh(new THREE.TorusGeometry(1.21,.065,8,36),brushed,[side*5,y,-5.5],[1,1,1],stages[1]).rotation.x=Math.PI/2;
    const fire=atmosphereMaterial('#ff7629','flame');flows.push(fire);
    mesh(new THREE.PlaneGeometry(1.5,1.9),fire,[side*5,1.2,-4.12],[1,1,1],stages[1]);
    tube([[side*5-.82,.15,-4.16],[side*5-.82,1.65,-4.16],[side*5,2.15,-4.16],[side*5+.82,1.65,-4.16],[side*5+.82,.15,-4.16]],.08,brushed,stages[1]);
    tube([[side*6,0,-7],[side*6,5.9,-7],[side*1.8,5.9,-7],[side*1.8,3.8,-7]],.14,iron,stages[1]);
    for(let j=0;j<3;j++){
      const piston=mesh(cylinder,brushed,[side*(3.8+j*.34),1.15,-3.8],[.085,1.7,.085],stages[1]);
      animations.push({o:piston,type:'piston',stage:1,phase:j+side});
    }
    mesh(rounded,dark,[side*5,.065,0],[.45,.12,10],stages[1]);
    mesh(rounded,glow('#dc6b2d',1.7),[side*5,.075,0],[.11,.015,9.7],stages[1]);
  }
  const reactor=new THREE.Group();stages[1].add(reactor);reactor.position.set(0,3.7,-10);
  const reactorRing=mesh(new THREE.TorusGeometry(2.15,.24,14,80),iron,[0,0,0],[1,1,1],reactor);
  mesh(new THREE.TorusGeometry(1.87,.07,8,72),glow('#ff8738',2),[0,0,.11],[1,1,1],reactor);
  mesh(new THREE.CircleGeometry(1.72,60),glow('#963814',.8),[0,0,-.10],[1,1,1],reactor);
  const turbine=new THREE.Group();reactor.add(turbine);turbine.position.z=.16;
  for(let k=0;k<8;k++){const blade=mesh(rounded,iron,[0,.94,0],[.25,1.6,.09],turbine);blade.rotation.z=k*Math.PI/4;blade.position.set(Math.sin(k*Math.PI/4)*.94,Math.cos(k*Math.PI/4)*.94,0);}
  mesh(sphere,brushed,[0,0,.16],[.4,.4,.28],turbine);animations.push({o:turbine,type:'fan',stage:1,phase:0});
  for(const side of [-1,1])tube([[side*1.6,0,-10],[side*1.6,2,-10],[side*2.1,3.7,-10]],.19,iron,stages[1]);
  sign('FORGE 06','#dfb17e',[0,6.3,-11],[3.1,.63],stages[1]);
  // Prism vault: a floating faceted nucleus in a circular observatory.
  const vaultMetal=new THREE.MeshStandardMaterial({color:'#455064',roughness:.27,metalness:.79});
  const glass=new THREE.MeshPhysicalMaterial({color:'#638ba1',metalness:.38,roughness:.13,transparent:true,opacity:.28,side:THREE.DoubleSide,clearcoat:1});
  for(const side of [-1,1]){
    const arch=tube([[side*5.8,0,-5.8],[side*5.8,4.5,-5.8],[side*3.7,6,-6.4],[0,6.4,-6.6]],.12,vaultMetal,stages[2],40);
    tube([[side*5.7,0,-5.65],[side*5.7,4.4,-5.65],[side*3.6,5.9,-6.2],[0,6.3,-6.4]],.018,glow('#8879c4',1),stages[2],40);
    mesh(new THREE.CylinderGeometry(4.4,4.4,4.7,44,1,true,side<0?Math.PI*.12:Math.PI*1.05,Math.PI*.62),glass,[0,2.7,-8],[1,1,1],stages[2]);
    mesh(rounded,vaultMetal,[side*5.4,.2,-1],[1.2,.4,9],stages[2]);
  }
  const nucleus=new THREE.Group();stages[2].add(nucleus);nucleus.position.set(0,3.2,-8.2);
  const crystalMat=new THREE.MeshPhysicalMaterial({color:'#c0afd9',emissive:'#645ca0',emissiveIntensity:.26,roughness:.13,metalness:.4,clearcoat:1});
  mesh(new THREE.OctahedronGeometry(1.1,1),crystalMat,[0,0,0],[.72,1.45,.72],nucleus);
  animations.push({o:nucleus,type:'nucleus',stage:2});
  for(let i=0;i<3;i++){
    const ring=mesh(new THREE.TorusGeometry(1.65+i*.36,.025,10,72),glow(i===1?'#70c3d0':'#a392e0',1.1),[0,3.2,-8.2],[1,1,1],stages[2]);
    ring.rotation.set(i*.8,.65+i*.6,i*.42);animations.push({o:ring,type:'gimbal',stage:2,phase:i});
  }
  for(let i=0;i<9;i++){
    const shard=mesh(new THREE.OctahedronGeometry(.32),crystalMat,[0,3,-7],[.55,1.8,.55],stages[2]);animations.push({o:shard,type:'orbit',stage:2,phase:i*Math.PI*2/9});
  }
  const glyphMat=glow('#6b9da9',.65);
  for(let i=0;i<3;i++){const ring=mesh(new THREE.RingGeometry(2.4+i*1.5,2.425+i*1.5,72),glyphMat,[0,.015,-3],[1,1,1],stages[2]);ring.rotation.x=-Math.PI/2;}
  sign('OBSERVATORY','#a9a3d2',[0,6.1,-10.5],[3.8,.5],stages[2]);
  // Lantern market: the storefronts are deeper than the stall counters, and
  // lanterns give the district a warm ceiling with moving colour on cobbles.
  skyline(stages[3],'market');
  shopFront(-5.9,-6.3,'#57434a',stages[3],1);shopFront(6.0,-7,'#344c49',stages[3]);
  for(const side of [-1,1]){
    const stall=new THREE.Group();stages[3].add(stall);stall.position.set(side*5.2,0,-2.9);
    mesh(rounded,new THREE.MeshStandardMaterial({color:side<0?'#603e38':'#30534d',roughness:.84}),[0,.65,0],[2.2,1.3,1.65],stall);
    mesh(rounded,new THREE.MeshStandardMaterial({color:'#9d8772',roughness:.6}),[0,1.32,.2],[2.45,.1,1.9],stall);
    for(const dx of [-1.15,1.15])mesh(cylinder,brushed,[dx,1.5,-.6],[.035,3.0,.035],stall);
    const cloth=mesh(new THREE.PlaneGeometry(2.9,2.5,14,8),new THREE.MeshStandardMaterial({color:side<0?'#b86158':'#5b8a75',side:THREE.DoubleSide,roughness:.95}),[0,2.75,0],[1,1,1],stall);cloth.rotation.x=-Math.PI/2;animations.push({o:cloth,type:'awning',stage:3,phase:side});
    for(let i=0;i<14;i++)mesh(sphere,new THREE.MeshStandardMaterial({color:['#dba869','#8b9b4e','#bc6654'][i%3],roughness:.66}),[(i%7-3)*.25,1.42+Math.floor(i/7)*.13,.3+Math.floor(i/7)*.22],[.12,.13,.12],stall);
    sign(side<0?'NOODLES':'FLOWERS','#ffd09a',[0,2.13,1.03],[1.85,.43],stall);
    const kettle=mesh(sphere,brushed,[side<0?.72:-.72,1.65,-.12],[.28,.27,.28],stall);
    mesh(cylinder,brushed,[side<0?.72:-.72,1.92,-.12],[.10,.07,.1],stall);
    const steam=atmosphereMaterial('#d8cdbb');flows.push(steam);mesh(new THREE.PlaneGeometry(.65,1.0),steam,[side<0?.72:-.72,2.42,-.12],[1,1,1],stall);
  }
  for(let row=0;row<3;row++){
    cable([[-7,4.8,-3-row*2.3],[0,4.0,-3-row*2.3],[7,4.8,-3-row*2.3]],stages[3]);
    for(let i=0;i<9;i++){
      const x=(i-4)*1.35,y=4.08+Math.abs(x)*.09,z=-3-row*2.3;
      const lamp=new THREE.Group();stages[3].add(lamp);lamp.position.set(x,y,z);
      lamp.material=glow(i%3?'#dd8368':'#efc58e',1.3);
      mesh(sphere,lamp.material,[0,0,0],[.20,.30,.20],lamp);
      for(const yy of [-.27,.27])mesh(cylinder,dark,[0,yy,0],[.105,.055,.105],lamp);
      animations.push({o:lamp,type:'lantern',stage:3,phase:i+row*7,baseY:y});
    }
  }
  sign('LATE HOURS','#ef986e',[0,5.55,-11],[3.5,.67],stages[3]);
  // Conservatory: curved ribs, hundreds of instanced leaves, hanging vines,
  // hydroponic tanks and a flowing water wall, not the same neon city again.
  const botanicalMetal=new THREE.MeshStandardMaterial({color:'#445956',roughness:.54,metalness:.61});
  for(let i=0;i<7;i++){
    tube([[-6.5,0,-3-i*1.8],[-6.1,3.8,-3-i*1.8],[-3.8,6.6,-3-i*1.8],[0,7.3,-3-i*1.8],[3.8,6.6,-3-i*1.8],[6.1,3.8,-3-i*1.8],[6.5,0,-3-i*1.8]],.053,botanicalMetal,stages[4],40);
  }
  for(const side of [-1,1])for(const y of [2.5,4.6])tube([[side*6.2,y,-2],[side*6.2,y,-15]],.032,botanicalMetal,stages[4]);
  const leafShape=new THREE.Shape();leafShape.moveTo(0,0);leafShape.bezierCurveTo(-.30,.28,-.26,.77,0,1);leafShape.bezierCurveTo(.26,.77,.30,.28,0,0);
  const leafGeo=new THREE.ShapeGeometry(leafShape,10);
  const leafMat=new THREE.MeshStandardMaterial({color:'#447c57',roughness:.73,side:THREE.DoubleSide});
  const paleLeafMat=new THREE.MeshStandardMaterial({color:'#6d9676',roughness:.76,side:THREE.DoubleSide});
  const leafDummy=new THREE.Object3D();
  for(const side of [-1,1]){
    const tree=new THREE.Group();stages[4].add(tree);tree.position.set(side*5.2,0,-5.0);
    mesh(rounded,new THREE.MeshStandardMaterial({color:'#36514a',roughness:.86}),[0,.24,0],[2.4,.48,2.4],tree);
    const bark=new THREE.MeshStandardMaterial({color:'#554d3d',roughness:.92});
    tube([[0,0,0],[side*.18,1.6,0],[-side*.15,3.0,0],[side*.12,4.5,0]],.17,bark,tree);
    const leaves=new THREE.InstancedMesh(leafGeo,side<0?leafMat:paleLeafMat,90);tree.add(leaves);
    for(let k=0;k<15;k++){
      const a=k*2.399,h=1.7+k*.19,x=Math.cos(a)*1.8,z=Math.sin(a)*1.2;
      tube([[0,h,0],[x*.55,h+.22,z*.55],[x,h+.42,z]],.025,bark,tree);
      for(let j=0;j<6;j++){
        leafDummy.position.set(x*(.58+j*.09),h+.23+j*.055,z*(.6+j*.08));leafDummy.rotation.set(-.6,a+j*.35,Math.sin(a)*.7);leafDummy.scale.set(.68,.84,.68);leafDummy.updateMatrix();leaves.setMatrixAt(k*6+j,leafDummy.matrix);
      }
    }
    animations.push({o:tree,type:'tree',stage:4,phase:side});
    for(let i=0;i<4;i++){
      const x=side*(4.9-i*.45),z=-7.4-i*.6;
      tube([[x,6.5,z],[x+.1,5.1,z],[x-.15,3.7-i*.2,z]],.026,leafMat,stages[4]);
      for(let j=0;j<5;j++){const leaf=mesh(leafGeo,paleLeafMat,[x,5.9-j*.40,z],[.35,.43,.35],stages[4]);leaf.rotation.z=(j%2?1:-1)*1.15;}
    }
    const tank=mesh(cylinder,new THREE.MeshPhysicalMaterial({color:'#4d8d87',roughness:.16,metalness:.2,transparent:true,opacity:.35}),[side*5.7,1.0,-.7],[.7,1.6,.7],stages[4]);
    for(const y of [.3,1.8])mesh(new THREE.TorusGeometry(.72,.055,8,40),botanicalMetal,[side*5.7,y,-.7],[1,1,1],stages[4]).rotation.x=Math.PI/2;
    mesh(cylinder,glow('#63a698',.6),[side*5.7,.8,-.7],[.5,.9,.5],stages[4]);
  }
  const waterWall=atmosphereMaterial('#79b6c6');waterWall.uniforms.strength.value=.48;flows.push(waterWall);
  mesh(new THREE.PlaneGeometry(4.6,4.5),waterWall,[0,2.5,-10],[1,1,1],stages[4]);
  for(const side of [-1,1])mesh(rounded,botanicalMetal,[side*2.5,2.3,-10.1],[.15,4.6,.3],stages[4]);
  mesh(rounded,botanicalMetal,[0,4.65,-10.1],[5.3,.17,.3],stages[4]);
  sign('SEED BANK','#b1d9ac',[0,6.1,-13.4],[3.5,.55],stages[4]);
  const blackTide=createBlackTide(stages[5]);
  // Three alternate prop arrangements per district retain a familiar district
  // identity while changing its stage silhouette as the endless floors climb.
  const layouts=stages.map((stage,index)=>Array.from({length:3},(_,layout)=>{
    const group=new THREE.Group();stage.add(group);group.name=`${THEMES[index].name}-layout-${layout}`;
    const sides=layout===0?[-1,1]:layout===1?[-1]:[1];
    for(const side of sides){
      const x=side*(6.0+layout*.7),z=-4.8-layout*1.6;
      if(index===0){
        sign(layout===1?'OPEN':'AFTER HOURS',side<0?'#ff947d':'#79d8d3',[x,3.95,z],[2.4,.56],group);
        mesh(cylinder,metal,[x,.7,z+1.3],[.37,1.4,.37],group);
      }else if(index===1){
        for(let j=0;j<3+layout;j++)mesh(cylinder,iron,[x+side*j*.5,.6+j*.08,z],[.28,1.2+j*.16,.28],group);
        const fan=mesh(new THREE.TorusGeometry(.65,.06,8,40),metal,[x,3.9,z],[1,1,1],group);
        for(let k=0;k<4;k++){const blade=mesh(rounded,brushed,[0,0,0],[1.1,.11,.06],fan);blade.rotation.z=k*Math.PI/4;}animations.push({o:fan,type:'fan',stage:1,phase:side});
      }else if(index===2){
        for(let j=0;j<3+layout;j++){
          const shard=mesh(new THREE.OctahedronGeometry(.52),crystalMat,[x-side*j*.6,1+j*.45,z],[.7,1.8,.7],group);shard.rotation.z=(j+layout)*.23;
        }
      }else if(index===3){
        for(let j=0;j<4+layout;j++){
          const person=new THREE.Group();group.add(person);person.position.set(x-side*j*.32,0,z-j*.55);
          mesh(new THREE.CapsuleGeometry(.14,.70,4,8),dark,[0,.70,0],[1,1,1],person);mesh(sphere,dark,[0,1.29,0],[.13,.15,.13],person);
          for(const dx of [-.065,.065])mesh(cylinder,dark,[dx,.20,0],[.045,.42,.045],person);
          animations.push({o:person,type:'crowd',stage:3,phase:j+layout});
        }
      }else if(index===4){
        for(let j=0;j<4+layout;j++){
          const stalk=tube([[x-side*j*.3,0,z-j*.4],[x-side*j*.3+.1,1.3,z-j*.4],[x-side*j*.3-.15,2.5+j*.13,z-j*.4]],.025,botanicalMetal,group);
          mesh(sphere,glow('#a9d9ae',.6),[x-side*j*.3-.15,2.5+j*.13,z-j*.4],[.065,.065,.065],group);
        }
      }
    }
    return group;
  }));
  // Low lying mist breaks up the geometric horizon without obscuring faces.
  for(let i=0;i<4;i++){
    const mist=atmosphereMaterial('#61999f');flows.push(mist);
    const object=mesh(new THREE.PlaneGeometry(8,2.0),mist,[-9+i*6,.65,-6-i%2],[1,1,1]);animations.push({o:object,type:'mist',phase:i});optional.push(object);
  }
  const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,
    uniforms:{time:{value:0},top:{value:new THREE.Color(THEMES[0].sky)},horizon:{value:new THREE.Color(THEMES[0].horizon)},stars:{value:1},life:{value:1}},
    vertexShader:'varying vec3 vWorld;void main(){vWorld=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 vWorld;uniform float time,stars,life;uniform vec3 top,horizon;${NOISE}
      void main(){vec3 d=normalize(vWorld);float h=max(0.,d.y);vec2 p=d.xz/max(.22,d.y+.35);float cloud=fbm(p*2.7+vec2(time*.011,time*.003));vec3 c=mix(horizon,top,smoothstep(0.,.67,h));
      c+=pow(cloud,4.)*.062;float sparkle=step(.996,hash(floor(p*145.)))*smoothstep(.12,.6,h);c+=sparkle*stars*.35;
      float moon=1.-smoothstep(.035,.04,length(d-vec3(-.40,.51,-.76)));c+=moon*vec3(.22,.31,.35)*stars;gl_FragColor=vec4(c*life,1.);}`});
  const sky=mesh(new THREE.SphereGeometry(78,40,24),skyMat,[0,0,0]);sky.castShadow=sky.receiveShadow=false;
  const rainCount=320,rainPos=new Float32Array(rainCount*6),rainGeo=new THREE.BufferGeometry();rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPos,3));
  const rain=new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({color:'#aac5d0',transparent:true,opacity:.21,depthWrite:false}));root.add(rain);
  const moteCount=110,motePos=new Float32Array(moteCount*3),moteGeo=new THREE.BufferGeometry();moteGeo.setAttribute('position',new THREE.BufferAttribute(motePos,3));
  const moteMap=paintedTexture((c,w,h)=>{const gradient=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);gradient.addColorStop(0,'white');gradient.addColorStop(.22,'rgba(255,255,255,.8)');gradient.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=gradient;c.fillRect(0,0,w,h);},32,32);textures.push(moteMap);
  const motes=new THREE.Points(moteGeo,new THREE.PointsMaterial({color:'#ffc584',size:.055,map:moteMap,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));root.add(motes);
  for(const side of [-1,1]){
    const light=new THREE.PointLight(side<0?THEMES[0].accent:THEMES[0].warm,17,17,2);light.position.set(side*4.4,3.6,-1.4);scene.add(light);lights.push(light);
  }
  const landmarkLight=new THREE.PointLight(THEMES[0].accent,10,16,2);landmarkLight.position.set(0,3.5,-7);scene.add(landmarkLight);lights.push(landmarkLight);
  const illuminatedMaterials=new Map(),flowStrengths=new Map(flows.filter(m=>m.uniforms.strength).map(m=>[m,m.uniforms.strength.value]));
  root.traverse(object=>{
    if(object.isMesh&&!object.isReflector)for(const material of Array.isArray(object.material)?object.material:[object.material]){
      if(material?.isMeshStandardMaterial&&!illuminatedMaterials.has(material)&&!blackTide.root.getObjectById(object.id))illuminatedMaterials.set(material,material.emissiveIntensity||0);
    }
  });
  let current=-1,variation=-1,state=environmentVariantFor(1),timeNow=0,visible=true;
  let manualLight={},cinematic=normalizeEnvironmentCinematic(),life=environmentLightState(),defeatAt=null,lastLevel=1;
  let rainTime=0;
  const grade=new THREE.Vector3(1,1,1);
  return {root,theme:'rain',event:'passing trains',
    grade,
    get ready(){return backdropState.settled===6;},
    get backdropReady(){return current!==5&&backdropState.statuses[Math.max(0,current)]==='loaded';},
    get lightState(){return life;},
    reflectionPlan(){return state.index===5?blackTide.reflectionPlan():{enabled:false,maxPasses:0,maxHz:0,excluded:[]};},
    setReflectionBudget(enabled){blackTide.setReflectionBudget(enabled);},
    updateReflection(renderer,camera){return visible&&state.index===5&&blackTide.updateReflection(renderer,scene,camera);},
    setVisible(value){visible=Boolean(value);root.visible=visible;lights.forEach(light=>light.visible=visible);blackTide.setVisible(visible&&state.index===5);},
    setLightState(options={}){manualLight={...options};},
    setCinematicState(value){cinematic=normalizeEnvironmentCinematic(value);blackTide.setCinematicState(cinematic);},
    resetCinematicState(){cinematic=normalizeEnvironmentCinematic();blackTide.resetCinematicState();},
    landmarks(){
      if(state.index===5)return blackTide.landmarks();
      const name=['Night railway','Foundry reactor','Prism nucleus','Lantern avenue','Conservatory canopy'][state.index];
      return [{id:'stage',name:'Fighting lane',kind:'stage',position:[0,0,0]},{id:'district-landmark',name,kind:'architecture',position:[0,4,-9]},
        {id:'skyline',name:`${THEMES[state.index].name} skyline`,kind:'skyline',position:[0,7,-25]}];
    },
    landmark(id){return this.landmarks().find(value=>value.id===id)||null;},
    update(time,level,district,frame,reduced=false,low=false,seed=0,bossPhase=0,options={}){
      state=environmentVariantFor(level,seed);const {index,cycle}=state,theme=THEMES[index],t=reduced?0:time;timeNow=t;
      const lighting={...manualLight,...options};
      if(options.cinematic!==undefined)cinematic=normalizeEnvironmentCinematic(options.cinematic);
      if(level!==lastLevel||(lighting.rivalHpRatio??1)>0)defeatAt=null;
      else if(defeatAt===null)defeatAt=time;
      lastLevel=level;
      life=environmentLightState({...lighting,cinematic,defeatElapsed:Number.isFinite(lighting.defeatElapsed)?lighting.defeatElapsed:defeatAt===null?undefined:time-defeatAt},time);
      grade.set(1+life.warm*.07,1-life.warm*.015,1-life.warm*.09);
      if(scene.fog){scene.fog.color.set(theme.fog);scene.fog.density=index===1?.027:index===4?.018:.019;}
      layouts.forEach((groups,i)=>groups.forEach((group,j)=>{
        group.visible=i===index&&j===state.layout;
        group.position.x=((state.dressingKey%101)/100-.5)*.65;group.position.z=((state.dressingKey%137)/136-.5)*1.1;
      }));
      ground.visible=index!==5;ground.scale.set(1,1,1);
      reflections.visible=index!==2&&index!==5;reflectionMat.uniforms.time.value=t;reflectionMat.uniforms.strength.value=index===0?.34:index===3?.17:index===5?.12:.065;
      stages[2].rotation.z=index===2?-(bossPhase*.012):0;
      if(current!==index||variation!==cycle){
        current=index;variation=cycle;stages.forEach((group,i)=>group.visible=i===index);
        skyMat.uniforms.top.value.set(theme.sky);skyMat.uniforms.horizon.value.set(theme.horizon);skyMat.uniforms.stars.value=index===0?.4:index===1?0:1;
        floorMat.color.set(index===1?'#8d8074':index===3?'#95918b':'#829498');floorMat.map=floorMaps[index];floorMat.bumpMap=floorMaps[index];floorMat.needsUpdate=true;
        floorMat.roughness=index===0?.21:index===2?.23:index===5?.48:.59;floorMat.metalness=index===0?.36:index===2?.50:.22;
        reflectionMat.uniforms.tint.value.set(theme.accent);reflectionMat.uniforms.warm.value.set(theme.warm);
        lights[0].color.set(theme.accent);lights[1].color.set(theme.warm);landmarkLight.color.set(theme.accent);
        root.userData.theme=theme.name;this.theme=theme.name;
      }
      skyMat.uniforms.time.value=t*(1+cinematic.sky*18);
      // Re-apply the stable horizon each frame so a phase pulse never compounds
      // into a different colour when the game is paused or runs at a high FPS.
      skyMat.uniforms.horizon.value.set(theme.horizon);
      if(bossPhase)skyMat.uniforms.horizon.value.lerp(new THREE.Color(theme.accent),bossPhase*.08);
      skyMat.uniforms.top.value.set(theme.sky).multiplyScalar(life.blackout?0:.22+life.arenaStrength*.78);
      skyMat.uniforms.horizon.value.multiplyScalar(life.blackout?0:.22+life.arenaStrength*.78);
      skyMat.uniforms.life.value=life.blackout?0:1;
      flows.forEach(material=>{material.uniforms.time.value=t;if(material.uniforms.low)material.uniforms.low.value=low?1:0;});
      animations.forEach(({o,type,phase=0,stage,baseY})=>{
        if(stage!==undefined&&stage!==index)return;
        if(type==='train')o.position.x=((t*(3.5+bossPhase*.7)+cycle*6+16)%50)-25;
        else if(type==='traffic')o.position.set(((t*2.4*state.trafficSpeed+phase)%39)-19,.02,-10.1);
        else if(type==='fan')o.rotation.z=t*(1.45+bossPhase*.4)+phase;
        else if(type==='piston')o.position.y=1.2+Math.sin(t*2.3+phase)*.32;
        else if(type==='nucleus'){o.rotation.y=t*.20;o.position.y=3.2+Math.sin(t*.65)*.14;}
        else if(type==='gimbal'){o.rotation.x=phase*.8+Math.sin(t*.15+phase)*.28;o.rotation.y=.65+phase*.6+t*.09*(phase%2?-1:1);o.rotation.z=phase*.42+t*.08;}
        else if(type==='orbit'){const a=t*.4*(bossPhase?-1:1)+phase;o.position.set(Math.cos(a)*3.2,2.8+Math.sin(t*.8+phase)*.64,-7.5+Math.sin(a)*1.15);o.rotation.set(t*.25+phase,t*.36,phase);}
        else if(type==='lantern'){o.rotation.z=Math.sin(t*1.4+phase)*.13;o.position.y=baseY+Math.sin(t+phase)*.035;o.material.emissiveIntensity=1.3*(bossPhase?.65+.35*Math.abs(Math.sin(t*.7+phase)):1);}
        else if(type==='awning'){
          if(!low){const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++)a.setZ(i,Math.sin(a.getX(i)*2.6+t*1.7+phase)*.035+Math.cos(a.getY(i)*2+t)*.03);a.needsUpdate=true;o.geometry.computeVertexNormals();}
        }
        else if(type==='tree')o.rotation.z=Math.sin(t*(.7+bossPhase*.25)+phase)*(.025+bossPhase*.011);
        else if(type==='crowd')o.rotation.z=Math.sin(t*.85+phase)*.028;
        else if(type==='mist'){o.visible=index!==5&&(!low||phase<2);o.position.x=-10+((t*.35+phase*5)%25);o.material.uniforms.tint.value.set(theme.horizon);}
      });
      optional.forEach(o=>{if(!animations.some(a=>a.o===o&&a.type==='mist'))o.visible=!low;});
      distanceGroups.forEach(({group,near})=>group.visible=near||!low);
      rain.visible=index===0||index===5;rain.material.opacity=.16+(state.weather===1?.10:0);rainGeo.setDrawRange(0,low?190:rainCount*2);
      if(!lighting.freezeRain)rainTime=t;
      for(let i=0;i<rainCount;i++){
        const x=((i*7.31)%22)-11,y=9-((rainTime*(4.5+state.weather)+i*.73)%9),z=((i*3.77)%18)-12;
        rainPos.set([x,y,z,x-.055,y+.26,z],i*6);
      }rainGeo.attributes.position.needsUpdate=true;
      motes.visible=index!==0&&index!==5;motes.material.color.set(index===1?'#e98f54':index===4?'#cff1b1':theme.accent);motes.geometry.setDrawRange(0,low?55:moteCount);
      for(let i=0;i<moteCount;i++)motePos.set([Math.sin(i*2.399+t*.075)*8,((i*.127+t*(index===1?.5:.10))%6)+.2,-8+Math.cos(i*4.57+t*.10)*5],i*3);
      moteGeo.attributes.position.needsUpdate=true;
      lights[0].intensity=15+Math.sin(t*.65)*1.0+bossPhase*2;lights[1].intensity=12+Math.sin(t*.83)*1.1;
      landmarkLight.intensity=index===1?24+Math.sin(t*2.2)*3:index===2?14:index===4?8:5;
      lights[0].intensity*=life.arenaStrength;lights[1].intensity*=life.arenaStrength;landmarkLight.intensity*=life.arenaStrength;
      illuminatedMaterials.forEach((base,material)=>{material.emissiveIntensity=base*Math.max(life.neon,life.relightWave);});
      flowStrengths.forEach((base,material)=>{material.uniforms.strength.value=base*life.arenaStrength;});
      backdropMeshes.forEach((backdrop,i)=>backdrop.material.color.setScalar((i===5?.28:1)*(life.blackout?0:.18+life.arenaStrength*.82)));
      reflectionMat.uniforms.strength.value*=life.arenaStrength;
      rain.material.opacity*=life.arenaStrength;motes.material.opacity=life.arenaStrength;
      blackTide.setVisible(visible&&index===5);
      if(index===5)blackTide.update(time,state,life,{low,reduced,cinematic,reflections:lighting.reflections,impact:frame?.impact||frame?.impulse||0});
      this.event=['passing trains','working furnaces','orbital mechanism','lantern wind','garden wind','harbour traffic'][index];
    },
    snapshot(){return {theme:this.theme,variant:state.layout,cycle:state.cycle,event:this.event,time:timeNow,
      backdrop:state.index===5?'authored-3d':backdropState.statuses[state.index],asset:state.index===5?null:backdropFiles[state.index],lightStage:life.stage,blackout:life.blackout,
      ...(state.index===5?{harbour:blackTide.snapshot()}:{})};},
    dispose(){blackTide.dispose();textures.forEach(t=>t.dispose());lights.forEach(light=>scene.remove(light));},
  };
}
