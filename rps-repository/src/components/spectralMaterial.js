import * as THREE from "three";

// Spectral copies expose the silhouette and the direction of each limb without
// filling the whole avatar with emissive colour. Per-copy alpha prevents a stack
// of ten clothing/body surfaces from becoming a white cutout.
export function createSpectralMaterial({ color = "#92b9ad", maximumAlpha = .28, bodyCoverage = .065, edgeCoverage = .44, strength = 1 } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.FrontSide, vertexColors: true,
    uniforms: { tint: { value: new THREE.Color(color) }, maximumAlpha: { value: maximumAlpha }, bodyCoverage: { value: bodyCoverage }, edgeCoverage: { value: edgeCoverage }, strength: { value: strength } },
    vertexShader: `
    #ifdef USE_INSTANCING
    attribute float ghostAlpha;
    #endif
    varying float vAlpha;varying float vSurface;varying vec3 vNormal;varying vec3 vView;
    vec3 safeNormal(vec3 v,vec3 fallback){float l2=dot(v,v);return l2>1.e-10?v*inversesqrt(l2):fallback;}
    void main(){mat4 instance=mat4(1.);vAlpha=1.;
    #ifdef USE_INSTANCING
    instance=instanceMatrix;vAlpha=ghostAlpha;
    #endif
    vSurface=.65;
    #ifdef USE_COLOR
    vSurface=dot(color,vec3(.2126,.7152,.0722));
    #endif
    vec4 p=modelViewMatrix*instance*vec4(position,1.);
    vNormal=safeNormal(normalMatrix*mat3(instance)*normal,vec3(0.,1.,0.));vView=safeNormal(-p.xyz,vec3(0.,0.,1.));gl_Position=projectionMatrix*p;}`,
    fragmentShader: `uniform vec3 tint;uniform float maximumAlpha,bodyCoverage,edgeCoverage,strength;
    varying float vAlpha;varying float vSurface;varying vec3 vNormal;varying vec3 vView;
    vec3 safeNormal(vec3 v,vec3 fallback){float l2=dot(v,v);return l2>1.e-10?v*inversesqrt(l2):fallback;}
    void main(){vec3 n=safeNormal(vNormal,vec3(0.,1.,0.));float edge=smoothstep(.22,.85,1.-abs(dot(n,safeNormal(vView,vec3(0.,0.,1.)))));
    float moon=.42+.42*max(0.,dot(n,vec3(-.339,.775,.533)));
    vec3 color=tint*(moon*(.36+clamp(vSurface,0.,1.)*.55)+edge*.065);float alpha=min(maximumAlpha,max(0.,vAlpha)*strength*(bodyCoverage+edgeCoverage*edge));
    if(alpha<.002)discard;gl_FragColor=vec4(color,alpha);}`,
  });
}
