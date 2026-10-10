import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export function createFilmRenderer(renderer,scene,camera) {
  const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);
  const reflection=pmrem.fromScene(room,.06);
  scene.environment=reflection.texture;
  // Keep a useful studio reflection in metal, without filling every shadow
  // with the same grey and making cloth resemble a glossy plastic toy.
  scene.environmentIntensity=.36;
  room.dispose();pmrem.dispose();
  const composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.27,.52,1.3);
  composer.addPass(bloom);
  const grade=new ShaderPass({
    uniforms:{tDiffuse:{value:null},time:{value:0},impact:{value:0},glitch:{value:0},texel:{value:new THREE.Vector2(1,1)}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform sampler2D tDiffuse;uniform float time,impact,glitch;uniform vec2 texel;varying vec2 vUv;
      void main(){
        vec2 uv=vUv;
        float band=step(.987,fract(sin(floor(uv.y*80.)+floor(time*7.))*43758.5))*glitch;
        uv.x+=band*.005*sin(time*13.);
        vec3 c=texture2D(tDiffuse,uv).rgb;
        // A restrained reconstruction sharpen compensates for the adaptive
        // rendering resolution. It does not add ringing to bright outlines.
        vec3 neighbours=(texture2D(tDiffuse,uv+vec2(texel.x,0.)).rgb+texture2D(tDiffuse,uv-vec2(texel.x,0.)).rgb+
          texture2D(tDiffuse,uv+vec2(0.,texel.y)).rgb+texture2D(tDiffuse,uv-vec2(0.,texel.y)).rgb)*.25;
        c=max(vec3(0.),c+clamp(c-neighbours,vec3(-.08),vec3(.08))*.17);
        float chroma=impact*.0023+band*.004;
        if(chroma>.00001){c.r=texture2D(tDiffuse,uv+vec2(chroma,0.)).r;c.b=texture2D(tDiffuse,uv-vec2(chroma,0.)).b;}
        float luma=dot(c,vec3(.2126,.7152,.0722));
        c=mix(vec3(luma),c,1.035);
        // Cool shadows and a small warm highlight keep skin readable against
        // the district palettes instead of applying a heavy teal filter.
        c*=mix(vec3(.985,1.003,1.028),vec3(1.028,1.009,.989),smoothstep(.05,.9,luma));
        float edge=smoothstep(.28,.75,length((vUv-.5)*vec2(1.,.82)));
        c*=1.-edge*.16;
        float grain=fract(sin(dot(vUv+fract(time),vec2(12.9898,78.233)))*43758.5453)-.5;
        c+=grain*.0025*(1.-smoothstep(.2,1.,luma));
        c*=1.-glitch*.022*(.5+.5*sin(uv.y*850.));
        c+=impact*.016;
        gl_FragColor=vec4(c,1.);
      }`,
  });
  composer.addPass(grade);composer.addPass(new OutputPass());
  return {
    resize(w,h){
      const ratio=renderer.getPixelRatio();composer.setPixelRatio(ratio);composer.setSize(w,h);
      grade.uniforms.texel.value.set(1/Math.max(1,w*ratio),1/Math.max(1,h*ratio));
    },
    render(low,time,impact=0,glitch=false){
      if(low)renderer.render(scene,camera);
      else{
        grade.uniforms.time.value=time;grade.uniforms.impact.value=impact;grade.uniforms.glitch.value=glitch?1:0;
        composer.render();
      }
    },
    dispose(){composer.passes.forEach(pass=>pass.dispose?.());composer.dispose();reflection.dispose();},
  };
}

// Original procedural woven fabric. Both lightweight and full modes use the
// maps, so selecting Light rendering never substitutes different character art.
export function createClothMaps() {
  const size=128,rough=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4,warp=Math.sin(x*Math.PI*.5),weft=Math.sin(y*Math.PI*.5);
    const noise=((x*13+y*79)%19)/19;
    const thread=(x%4<2)!==(y%4<2)?1:-1;
    const r=218+noise*21+thread*4;
    rough.set([r,r,r,255],i);
    normal.set([128+warp*5,128+weft*5,255,255],i);
  }
  const maps=[rough,normal].map(data=>{
    const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.repeat.set(16,16);texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps=true;texture.needsUpdate=true;return texture;
  });
  return {roughness:maps[0],normal:maps[1],dispose(){maps.forEach(map=>map.dispose());}};
}
