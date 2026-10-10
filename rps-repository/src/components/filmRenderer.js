import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

export function createFilmRenderer(renderer, scene, camera) {
  const room = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const reflection = pmrem.fromScene(room,.04);
  scene.environment = reflection.texture;
  scene.environmentIntensity = .48;
  room.dispose();
  pmrem.dispose();
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1,1),.38,.65,1.15);
  composer.addPass(bloom);
  const grade = new ShaderPass({
    uniforms:{tDiffuse:{value:null},time:{value:0},impact:{value:0},glitch:{value:0}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`uniform sampler2D tDiffuse;uniform float time;uniform float impact;uniform float glitch;varying vec2 vUv;
    void main(){vec2 uv=vUv;float band=step(.97,fract(sin(floor(uv.y*80.)+floor(time*8.))*43758.5))*glitch;
      uv.x+=band*.008*sin(time*13.);vec3 c=texture2D(tDiffuse,uv).rgb;
      float chroma=impact*.004+band*.006;c.r=texture2D(tDiffuse,uv+vec2(chroma,0.)).r;c.b=texture2D(tDiffuse,uv-vec2(chroma,0.)).b;
      c*=1.-glitch*.045*(.5+.5*sin(uv.y*900.));float edge=smoothstep(.24,.8,length((vUv-.5)*vec2(1.,.7)));
      c*=1.-edge*.24;float grain=fract(sin(dot(vUv+fract(time),vec2(12.9898,78.233)))*43758.5453)-.5;
      c+=grain*.005;c*=vec3(1.025,1.,.98);c+=impact*.03;gl_FragColor=vec4(c,1.);}`,
  });
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  return {
    resize(w,h){composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(w,h);},
    render(low,time,impact=0,glitch=false){
      if(low)renderer.render(scene,camera);
      else{grade.uniforms.time.value=time;grade.uniforms.impact.value=impact;grade.uniforms.glitch.value=glitch?1:0;composer.render();}
    },
    dispose(){composer.passes.forEach(p=>p.dispose?.());composer.dispose();reflection.dispose();},
  };
}

// Fine weave and surface roughness remain visible even in lightweight mode.
export function createClothMaps() {
  const n=128, rough=new Uint8Array(n*n*4), normal=new Uint8Array(n*n*4);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const i=(y*n+x)*4, a=Math.sin(x*Math.PI*.5),b=Math.sin(y*Math.PI*.5);
    const noise=((x*13+y*79)%19)/19;
    rough.set([175+noise*35,175+noise*35,175+noise*35,255],i);
    normal.set([128+a*8,128+b*8,255,255],i);
  }
  const maps=[rough,normal].map(data=>{
    const t=new THREE.DataTexture(data,n,n,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;
    t.repeat.set(16,16);t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;
    t.generateMipmaps=true;t.needsUpdate=true;return t;
  });
  return {roughness:maps[0],normal:maps[1],dispose(){maps.forEach(t=>t.dispose());}};
}
