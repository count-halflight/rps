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
  for(const target of [composer.renderTarget1,composer.renderTarget2]) target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
  composer.addPass(new RenderPass(scene,camera));
  const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.27,.52,1.3);
  composer.addPass(bloom);
  const grade=new ShaderPass({
    uniforms:{tDiffuse:{value:null},time:{value:0},impact:{value:0},glitch:{value:0},texel:{value:new THREE.Vector2(1,1)},health:{value:1},soft:{value:1},fade:{value:0},invert:{value:0},warp:{value:0},warpCenter:{value:new THREE.Vector2(.5,.5)},districtGrade:{value:new THREE.Vector3(1,1,1)},tDepth:{value:null},nearFar:{value:new THREE.Vector2(camera.near,camera.far)},focusDepth:{value:6},dof:{value:0},motion:{value:new THREE.Vector2()},heat:{value:0},ripple:{value:0},ripplePhase:{value:0},impactDark:{value:0},chromaPulse:{value:0}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform sampler2D tDiffuse,tDepth;uniform float time,impact,glitch,health,soft,fade,invert,warp,focusDepth,dof,heat,ripple,ripplePhase,impactDark,chromaPulse;uniform vec2 texel,warpCenter,nearFar,motion;uniform vec3 districtGrade;varying vec2 vUv;
      float linearDepth(float depth){return 2.*nearFar.x*nearFar.y/(nearFar.y+nearFar.x-(depth*2.-1.)*(nearFar.y-nearFar.x));}
      void main(){
        vec2 uv=vUv;
        vec2 radial=uv-warpCenter;
        float lens=exp(-dot(radial,radial)*26.)*warp;
        uv+=radial*lens*.16;
        float radius=length(radial);
        float waveRadius=.08+ripplePhase*.72;
        float rippleDistance=(radius-waveRadius)*32.;
        float rippleBand=exp(-rippleDistance*rippleDistance);
        vec2 rippleDirection=radial*inversesqrt(max(dot(radial,radial),.00000001));
        uv+=rippleDirection*rippleBand*ripple*.004;
        uv+=vec2(sin(uv.y*58.+time*11.),cos(uv.x*42.-time*8.))*heat*.0018*exp(-dot(radial,radial)*9.);
        float band=step(.987,fract(sin(floor(uv.y*80.)+floor(time*7.))*43758.5))*glitch;
        uv.x+=band*.005*sin(time*13.);
        float blur=0.;
        if(dof>.0){float depth=linearDepth(texture2D(tDepth,uv).r);blur=clamp(abs(depth-focusDepth)/max(.5,focusDepth)*.8,0.,1.)*dof;}
        vec2 blurStep=texel*blur*3.2;
        vec3 c=texture2D(tDiffuse,uv).rgb;
        if(blur>.01)c=c*.4+(texture2D(tDiffuse,uv+vec2(blurStep.x,0.)).rgb+texture2D(tDiffuse,uv-vec2(blurStep.x,0.)).rgb+texture2D(tDiffuse,uv+vec2(0.,blurStep.y)).rgb+texture2D(tDiffuse,uv-vec2(0.,blurStep.y)).rgb)*.15;
        if(length(motion)>.00001)c=c*.5+(texture2D(tDiffuse,uv-motion).rgb+texture2D(tDiffuse,uv-motion*.5).rgb)*.25;
        // A restrained reconstruction sharpen compensates for the adaptive
        // rendering resolution. It does not add ringing to bright outlines.
        vec3 neighbours=(texture2D(tDiffuse,uv+vec2(texel.x,0.)).rgb+texture2D(tDiffuse,uv-vec2(texel.x,0.)).rgb+
          texture2D(tDiffuse,uv+vec2(0.,texel.y)).rgb+texture2D(tDiffuse,uv-vec2(0.,texel.y)).rgb)*.25;
        c=max(vec3(0.),c+clamp(c-neighbours,vec3(-.08),vec3(.08))*.17*(1.-blur));
        float chroma=(impact*.0023+band*.003+chromaPulse*.0016)*(1.-soft);
        if(chroma>.00001){c.r=texture2D(tDiffuse,uv+vec2(chroma,0.)).r;c.b=texture2D(tDiffuse,uv-vec2(chroma,0.)).b;}
        float luma=dot(c,vec3(.2126,.7152,.0722));
        float hurt=1.-smoothstep(.08,.30,health);
        c=mix(vec3(luma),c,1.03-hurt*.22);
        // Cool shadows and a small warm highlight keep skin readable against
        // the district palettes instead of applying a heavy teal filter.
        c*=mix(vec3(.985,1.003,1.028),vec3(1.028,1.009,.989),smoothstep(.05,.9,luma));
        float edge=smoothstep(.28,.75,length((vUv-.5)*vec2(1.,.82)));
        c*=1.-edge*(.20+hurt*.26);
        c*=districtGrade;
        float grain=fract(sin(dot(vUv+fract(time),vec2(12.9898,78.233)))*43758.5453)-.5;
        c+=grain*.0025*(1.-smoothstep(.2,1.,luma));
        c*=1.-glitch*.022*(.5+.5*sin(uv.y*850.));
        c+=impact*.008*(1.-soft);
        vec3 negative=vec3(1.)-vec3(dot(c,vec3(.2126,.7152,.0722)));
        c=mix(c,mix(negative,vec3(luma)*.78,soft),invert);
        c*=1.-max(fade,impactDark);
        gl_FragColor=vec4(c,1.);
      }`,
  });
  composer.addPass(grade);composer.addPass(new OutputPass());
  return {
    resize(w,h){
      const ratio=renderer.getPixelRatio();composer.setPixelRatio(ratio);composer.setSize(w,h);
      grade.uniforms.texel.value.set(1/Math.max(1,w*ratio),1/Math.max(1,h*ratio));
    },
    render(low,time,impact=0,glitch=false,options={}){
      {
        bloom.enabled=!low;
        grade.uniforms.tDepth.value=composer.readBuffer.depthTexture;
        grade.uniforms.nearFar.value.set(camera.near,camera.far);
        grade.uniforms.focusDepth.value=Math.max(.2,options.focusDepth||6);
        grade.uniforms.dof.value=!low&&options.quality==='high'&&!options.reduced?1:0;
        grade.uniforms.motion.value.fromArray(!low&&options.quality==='high'&&!options.reduced?options.motion||[0,0]:[0,0]);
        grade.uniforms.heat.value=low||options.reduced?0:Math.max(0,Math.min(1,options.heat||0));
        grade.uniforms.ripple.value=low||options.reduced?0:Math.max(0,Math.min(1,options.ripple||0));
        grade.uniforms.ripplePhase.value=options.ripplePhase||0;
        grade.uniforms.chromaPulse.value=low||options.reduced?0:Math.max(0,Math.min(.6,options.chromaPulse||0));
        grade.uniforms.impactDark.value=Math.max(0,Math.min(.12,options.impactDark||0));
        grade.uniforms.time.value=time;grade.uniforms.impact.value=low?0:impact;grade.uniforms.glitch.value=!low&&glitch?1:0;
        grade.uniforms.health.value=options.playerHpRatio??1;
        grade.uniforms.soft.value=options.reduceFlashes===false?0:1;
        grade.uniforms.fade.value=Math.max(0,Math.min(1,options.fade||0));
        grade.uniforms.invert.value=Math.max(0,Math.min(1,options.invert||0));
        grade.uniforms.warp.value=low?0:options.warp||0;
        grade.uniforms.warpCenter.value.fromArray(options.warpCenter||[.5,.5]);
        if (options.grade?.isVector3) grade.uniforms.districtGrade.value.copy(options.grade);
        else grade.uniforms.districtGrade.value.fromArray(options.grade||[1,1,1]);
        bloom.strength=options.quality==='high'?.32:.22;
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
