import * as THREE from "three";
import { createSpectralMaterial } from "./spectralMaterial.js";
import { reflectionAssetData } from "./reflectionAssets.js";

// Each reflection chooses a real baked pose in a vertex texture. All twenty-four
// people submit in one draw; choosing Light changes the source LOD, never the cast.
export function createReflectionPoseAtlas(snapshots, capacity = 24, { halfFloat = snapshots.length === 24 } = {}) {
  const cached = reflectionAssetData(snapshots)?.atlas;
  const counts = snapshots.map(geometry => geometry.index?.count ?? geometry.attributes.position.count), vertices = Math.max(3, ...counts);
  const width = 1024, height = Math.ceil(vertices * snapshots.length / width), positionData = cached?.positionData ?? new Float32Array(width * height * 4), normalData = cached?.normalData ?? new Float32Array(width * height * 4);
  if (!cached) snapshots.forEach((geometry, pose) => {
    const positions = geometry.attributes.position, normals = geometry.attributes.normal, colors = geometry.attributes.color;
    for (let i = 0; i < vertices; i++) {
      const address = (pose * vertices + i) * 4;
      if (i < counts[pose]) {
        const source = geometry.index ? geometry.index.getX(i) : i;
        positionData[address] = positions.getX(source); positionData[address + 1] = positions.getY(source); positionData[address + 2] = positions.getZ(source); positionData[address + 3] = colors ? colors.getX(source) * .2126 + colors.getY(source) * .7152 + colors.getZ(source) * .0722 : .65;
        const nx = normals.getX(source), ny = normals.getY(source), nz = normals.getZ(source), length = Math.hypot(nx, ny, nz);
        normalData.set(length > 1e-8 ? [nx / length, ny / length, nz / length, 1] : [0, 1, 0, 1], address);
      } else normalData.set([0, 1, 0, 0], address);
    }
  });
  const useHalfFloat = cached?.halfFloat ?? halfFloat;
  const encodedPositions = cached || !useHalfFloat ? positionData : Uint16Array.from(positionData, THREE.DataUtils.toHalfFloat), encodedNormals = cached || !useHalfFloat ? normalData : Uint16Array.from(normalData, THREE.DataUtils.toHalfFloat);
  const texture = data => { const value = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, useHalfFloat ? THREE.HalfFloatType : THREE.FloatType); value.minFilter = value.magFilter = THREE.NearestFilter; value.generateMipmaps = false; value.needsUpdate = true; return value; };
  const positions = texture(encodedPositions), normals = texture(encodedNormals), geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(vertices * 3), 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(new Float32Array(vertices * 3), 3));
  geometry.setAttribute("vertexAddress", new THREE.Float32BufferAttribute(Float32Array.from({ length: vertices }, (_, index) => index), 1));
  const alpha = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1), poseIndex = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
  const poseIndexB = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1), blend = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
  geometry.setAttribute("ghostAlpha", alpha); geometry.setAttribute("poseIndex", poseIndex); geometry.setAttribute("poseIndexB", poseIndexB); geometry.setAttribute("poseBlend", blend); geometry.userData.poseCount = snapshots.length;
  const material = createSpectralMaterial({ color: "#a4bcb8", maximumAlpha: .40, bodyCoverage: .58, edgeCoverage: .13 }); material.vertexColors = false;
  material.uniforms.posePositionMap = { value: positions }; material.uniforms.poseNormalMap = { value: normals }; material.uniforms.poseMapSize = { value: new THREE.Vector2(width, height) }; material.uniforms.poseVertexCount = { value: vertices };
  material.vertexShader = `attribute float vertexAddress;attribute float poseIndex;attribute float poseIndexB;attribute float poseBlend;uniform sampler2D posePositionMap,poseNormalMap;uniform vec2 poseMapSize;uniform float poseVertexCount;
  ${material.vertexShader}`;
  material.vertexShader = material.vertexShader.replace("vec4 p=modelViewMatrix*instance*vec4(position,1.);", `float address=vertexAddress+poseIndex*poseVertexCount;vec2 atlasUV=(vec2(mod(address,poseMapSize.x),floor(address/poseMapSize.x))+.5)/poseMapSize;
  float addressB=vertexAddress+poseIndexB*poseVertexCount;vec2 atlasUVB=(vec2(mod(addressB,poseMapSize.x),floor(addressB/poseMapSize.x))+.5)/poseMapSize;
  vec4 surface=mix(texture2D(posePositionMap,atlasUV),texture2D(posePositionMap,atlasUVB),clamp(poseBlend,0.,1.));
  vec3 posedNormal=safeNormal(mix(texture2D(poseNormalMap,atlasUV).xyz,texture2D(poseNormalMap,atlasUVB).xyz,clamp(poseBlend,0.,1.)),vec3(0.,1.,0.));vSurface=surface.w;
  vec4 p=modelViewMatrix*instance*vec4(surface.xyz,1.);`).replace("normalMatrix*mat3(instance)*normal", "normalMatrix*mat3(instance)*posedNormal");
  const mesh = new THREE.InstancedMesh(geometry, material, capacity); mesh.name = "Echo reflection poses"; mesh.frustumCulled = false; mesh.castShadow = false; mesh.renderOrder = 3;
  return { mesh, geometry, material, alpha, poseIndex, poseBankA: poseIndex, poseBankB: poseIndexB, blend, positions, normals, vertices, poseCounts: counts, textureBytes: encodedPositions.byteLength + encodedNormals.byteLength,
    dispose() { mesh.removeFromParent(); mesh.dispose(); geometry.dispose(); material.dispose(); positions.dispose(); normals.dispose(); } };
}
