import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { createPoseRig } from "./poseRig.js";
import { POSE_KEYS } from "../game/poseKeys.js";
import { reflectionAssetsForActor, reflectionAssetData } from "./reflectionAssets.js";
import { ECHO_REFLECTION_POSES, ECHO_REFLECTION_FAMILIES } from "../game/sequences/echo/reflectionPoses.js";

export const REFLECTION_POSE_KEYS = Object.freeze([
  "drawHit", "lowCut", "crossHit", "reverseCross", "riseCut", "mirrorHit", "stormHit", "thousandHit",
]);

// Bake the posed surface, including clothing and weapons, into one draw. The
// borrowed model is never changed and its geometry/materials stay with its owner.
export function bakeActorSurface(root, { sampleTextures = false } = {}) {
  // SkinnedMesh updates its attached bind inverse in updateMatrixWorld, not
  // Object3D.updateWorldMatrix. The renderer uses the same path before drawing.
  root.updateWorldMatrix(true, false); root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert(), transform = new THREE.Matrix4(), instance = new THREE.Matrix4(), vertex = new THREE.Vector3(), descriptors = [];
  let total = 0, vertexEvaluations = 0;
  root.traverse(object => {
    if (!object.isMesh || !object.geometry?.attributes.position) return;
    let visible = true;
    for (let parent = object; parent && parent !== root; parent = parent.parent) if (!parent.visible) visible = false;
    if (!visible) return;
    if (object.isSkinnedMesh) object.skeleton.update();
    transform.multiplyMatrices(inverse, object.matrixWorld);
    const count = object.geometry.index?.count ?? object.geometry.attributes.position.count;
    for (let i = 0; i < (object.isInstancedMesh ? object.count : 1); i++) {
      const matrix = transform.clone(), tint = new THREE.Color(1, 1, 1);
      if (object.isInstancedMesh) {
        object.getMatrixAt(i, instance); if (Math.max(Math.hypot(...instance.elements.slice(0, 3)), Math.hypot(...instance.elements.slice(4, 7)), Math.hypot(...instance.elements.slice(8, 11))) < 1e-6) continue;
        matrix.multiply(instance); if (object.instanceColor) object.getColorAt(i, tint);
      }
      descriptors.push({ object, matrix, tint, count }); total += count;
    }
  });
  const positions = new Float32Array(total * 3), colors = new Float32Array(total * 3), importance = new Uint8Array(total); let offset = 0;
  for (const { object, matrix, tint, count } of descriptors) {
    const attribute = object.geometry.attributes.position, indices = object.geometry.index, sourceColors = object.geometry.attributes.color;
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material], groups = object.geometry.groups, sourceUV = object.geometry.attributes.uv;
    const sampled = new Map(), uv = new THREE.Vector2();
    for (const material of objectMaterials) if (sampleTextures && sourceUV && material?.map?.image?.data) {
      material.map.updateMatrix(); sampled.set(material, { values: new Float32Array(attribute.count * 3), done: new Uint8Array(attribute.count) });
    }
    const memo = new Float64Array(attribute.count * 6), computed = new Uint8Array(attribute.count), features = new Uint8Array(attribute.count);
    let objectImportance = 0;
    for (let ancestor = object; ancestor && ancestor !== root; ancestor = ancestor.parent) {
      if (/blade|knife|sword|bow|string|arrow|staff|glaive|weapon/i.test(ancestor.name)) objectImportance = 2;
      else if (!objectImportance && /head|hand|wrist|jaw|eye/i.test(ancestor.name)) objectImportance = 1;
    }
    const skinIndices = object.geometry.attributes.skinIndex, skinWeights = object.geometry.attributes.skinWeight;
    const protectedBones = object.skeleton?.bones.map(bone => /finger|thumb|wrist|hand|head|jaw|eye/i.test(bone.name)) ?? [];
    let group = 0;
    for (let i = 0; i < count; i++) {
      const index = indices ? indices.getX(i) : i;
      if (!computed[index]) {
        if (object.getVertexPosition) object.getVertexPosition(index, vertex); else vertex.fromBufferAttribute(attribute, index);
        vertex.applyMatrix4(matrix); const address = index * 6; memo[address] = vertex.x; memo[address + 1] = vertex.y; memo[address + 2] = vertex.z; memo[address + 3] = sourceColors?.getX(index) ?? 1; memo[address + 4] = sourceColors?.getY(index) ?? 1; memo[address + 5] = sourceColors?.getZ(index) ?? 1;
        features[index] = objectImportance;
        if (!features[index] && skinIndices && skinWeights) for (let bone = 0; bone < 4; bone++) if (skinWeights.array[index * 4 + bone] > .18 && protectedBones[skinIndices.array[index * 4 + bone]]) features[index] = 1;
        computed[index] = 1; vertexEvaluations++;
      }
      while (group + 1 < groups.length && i >= groups[group].start + groups[group].count) group++;
      const material = objectMaterials[groups[group]?.materialIndex ?? 0], color = material?.color ?? { r: .5, g: .5, b: .5 }, address = index * 6, texels = sampled.get(material);
      let tr = 1, tg = 1, tb = 1;
      if (texels) {
        if (!texels.done[index]) {
          const map = material.map, image = map.image, channels = image.data.length / (image.width * image.height);
          uv.fromBufferAttribute(sourceUV, index); map.transformUv(uv);
          const pixel = (Math.min(image.height - 1, Math.max(0, Math.floor(uv.y * image.height))) * image.width + Math.min(image.width - 1, Math.max(0, Math.floor(uv.x * image.width)))) * channels;
          for (let channel = 0; channel < 3; channel++) {
            const value = image.data[pixel + Math.min(channel, channels - 1)] / 255;
            texels.values[index * 3 + channel] = map.colorSpace === THREE.SRGBColorSpace ? THREE.ColorManagement.colorSpaceToWorking(new THREE.Color(value, value, value), THREE.SRGBColorSpace).r : value;
          }
          texels.done[index] = 1;
        }
        tr = texels.values[index * 3]; tg = texels.values[index * 3 + 1]; tb = texels.values[index * 3 + 2];
      }
      positions[offset * 3] = memo[address]; positions[offset * 3 + 1] = memo[address + 1]; positions[offset * 3 + 2] = memo[address + 2];
      colors[offset * 3] = color.r * tint.r * memo[address + 3] * tr; colors[offset * 3 + 1] = color.g * tint.g * memo[address + 4] * tg; colors[offset * 3 + 2] = color.b * tint.b * memo[address + 5] * tb;
      importance[offset++] = features[index];
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("partImportance", new THREE.Uint8BufferAttribute(importance, 1)); geometry.userData.vertexEvaluations = vertexEvaluations;
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return geometry;
}

export function simplifyActorSnapshot(geometry, cellSize = .025, { featureCell = .022, weaponCell = .004, motionSurfaces = [] } = {}) {
  const positions = geometry.attributes.position, colors = geometry.attributes.color, sourceIndices = geometry.index, importance = geometry.attributes.partImportance;
  const vertices = [], vertexColors = [], vertexFeatures = [], sourceVertices = [], indices = [], cells = new Map(), triangles = new Set();
  for (let i = 0; i + 2 < (sourceIndices?.count ?? positions.count); i += 3) {
    const triangle = [];
    for (let j = 0; j < 3; j++) {
      const index = sourceIndices?.getX(i + j) ?? i + j, feature = importance?.getX(index) ?? 0, step = Math.min(cellSize, feature === 2 ? weaponCell : feature === 1 ? featureCell : cellSize);
      const x = Math.round(positions.getX(index) / step), y = Math.round(positions.getY(index) / step), z = Math.round(positions.getZ(index) / step), r = colors?.getX(index) ?? .5, g = colors?.getY(index) ?? .5, b = colors?.getZ(index) ?? .5;
      const motionKey = motionSurfaces.map(surface => {
        const p = surface.attributes.position;
        if (p.count !== positions.count) throw new Error("Authored reflection phases changed source topology");
        return `${Math.round(p.getX(index) / step)},${Math.round(p.getY(index) / step)},${Math.round(p.getZ(index) / step)}`;
      }).join(":");
      const key = `${step}:${x},${y},${z}:${Math.round(r * 32)},${Math.round(g * 32)},${Math.round(b * 32)}:${motionKey}`;
      if (!cells.has(key)) { cells.set(key, vertices.length / 3); vertices.push(x * step, y * step, z * step); vertexColors.push(r, g, b); vertexFeatures.push(feature); sourceVertices.push(index); }
      triangle.push(cells.get(key));
    }
    const [a, b, c] = triangle; if (a === b || b === c || a === c) continue;
    const ux = vertices[b * 3] - vertices[a * 3], uy = vertices[b * 3 + 1] - vertices[a * 3 + 1], uz = vertices[b * 3 + 2] - vertices[a * 3 + 2];
    const vx = vertices[c * 3] - vertices[a * 3], vy = vertices[c * 3 + 1] - vertices[a * 3 + 1], vz = vertices[c * 3 + 2] - vertices[a * 3 + 2];
    if ((uy * vz - uz * vy) ** 2 + (uz * vx - ux * vz) ** 2 + (ux * vy - uy * vx) ** 2 <= 1e-16) continue;
    const key = a < b && a < c ? `${a},${b},${c}` : b < c ? `${b},${c},${a}` : `${c},${a},${b}`;
    if (triangles.has(key)) continue; triangles.add(key); indices.push(a, b, c);
  }
  const result = new THREE.BufferGeometry(); result.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3)); result.setIndex(indices);
  result.setAttribute("color", new THREE.Float32BufferAttribute(vertexColors, 3));
  result.setAttribute("partImportance", new THREE.Uint8BufferAttribute(vertexFeatures, 1));
  result.setAttribute("sourceVertex", new THREE.Uint32BufferAttribute(sourceVertices, 1));
  result.computeVertexNormals(); result.computeBoundingBox(); result.computeBoundingSphere(); return result;
}

export function createActorSurfaceSlices(root, count = 16) {
  const surface = bakeActorSurface(root), positions = surface.attributes.position, bounds = surface.boundingBox;
  const buffers = Array.from({ length: count }, () => []), height = Math.max(.001, bounds.max.y - bounds.min.y), thickness = height / count;
  const clip = (polygon, boundary, above) => {
    const result = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length], insideA = above ? a.y >= boundary : a.y <= boundary, insideB = above ? b.y >= boundary : b.y <= boundary;
      if (insideA) result.push(a);
      if (insideA !== insideB) result.push(a.clone().lerp(b, (boundary - a.y) / (b.y - a.y)));
    }
    return result;
  };
  for (let i = 0; i + 2 < positions.count; i += 3) {
    const triangle = [0, 1, 2].map(j => new THREE.Vector3().fromBufferAttribute(positions, i + j));
    const minimum = Math.min(...triangle.map(v => v.y)), maximum = Math.max(...triangle.map(v => v.y));
    const start = Math.max(0, Math.min(count - 1, Math.floor((minimum - bounds.min.y) / thickness))), end = Math.max(0, Math.min(count - 1, Math.floor((maximum - bounds.min.y) / thickness)));
    for (let band = start; band <= end; band++) {
      const polygon = clip(clip(triangle, bounds.min.y + thickness * band, true), bounds.min.y + thickness * (band + 1), false);
      for (let j = 1; j + 1 < polygon.length; j++) {
        const a = polygon[0], b = polygon[j], c = polygon[j + 1];
        if (b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() <= 1e-16) continue;
        for (const v of [a, b, c]) buffers[band].push(v.x, v.y, v.z);
      }
    }
  }
  surface.dispose();
  return buffers.filter(buffer => buffer.length).map(buffer => {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(buffer, 3)); geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return geometry;
  });
}

// Keep the actual clipped avatar surface, but submit all bands in one draw.
// A per-vertex band ID lets the shader separate each piece without an object or
// material for every cut. The source avatar is still owned by its caller.
export function createBatchedActorSlices(root, count = 16) {
  const slices = createActorSurfaceSlices(root, count), vertexCount = slices.reduce((sum, geometry) => sum + geometry.attributes.position.count, 0);
  const positions = new Float32Array(vertexCount * 3), normals = new Float32Array(vertexCount * 3), bands = new Float32Array(vertexCount), bandBounds = [];
  let offset = 0;
  slices.forEach((geometry, index) => {
    const vertices = geometry.attributes.position.count;
    positions.set(geometry.attributes.position.array, offset * 3); normals.set(geometry.attributes.normal.array, offset * 3); bands.fill(index, offset, offset + vertices);
    bandBounds.push([geometry.boundingBox.min.y, geometry.boundingBox.max.y]); offset += vertices; geometry.dispose();
  });
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3)); geometry.setAttribute("sliceIndex", new THREE.Float32BufferAttribute(bands, 1));
  geometry.userData.sliceCount = slices.length; geometry.userData.bandBounds = bandBounds; geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return geometry;
}

export function bakeReflectionPoses(actor, { sampleTextures = false } = {}) {
  if (!actor?.root) return [];
  const sourceObjects = [], copyObjects = [], temporary = clone(actor.root);
  actor.root.traverse(o => sourceObjects.push(o)); temporary.traverse(o => copyObjects.push(o));
  const corresponding = source => copyObjects[sourceObjects.indexOf(source)];
  const model = corresponding(actor.model), body = corresponding(actor.body);
  let rig = null;
  if (model?.getObjectByName("upperarm01L") && body) rig = createPoseRig(model, body, "blades", actor.standingHeight ?? 2.1);
  temporary.traverse(o => {
    if (/^EchoBlade[LR]$/.test(o.name)) o.visible = true;
    if (/^Echo(?:Sheath|StowedBlade)[LR]$/.test(o.name)) o.visible = false;
  });
  for (const group of actor.weaponGroups?.blades ?? []) { const copy = corresponding(group); if (copy) copy.visible = true; }
  for (const group of actor.weaponGroups?.sheaths ?? []) { const copy = corresponding(group); if (copy) copy.visible = false; }
  for (const group of actor.weaponGroups?.stowedBlades ?? []) { const copy = corresponding(group); if (copy) copy.visible = false; }
  const snapshots = REFLECTION_POSE_KEYS.map((key, i) => {
    if (rig) rig.pose({ ...POSE_KEYS[key], footL: [.17, .12, .27], footR: [-.17, .12, -.25], roll: (i % 3 - 1) * .09 }, 0);
    return bakeActorSurface(temporary, { sampleTextures });
  });
  const skeletons = new Set(); temporary.traverse(o => { if (o.isSkinnedMesh) skeletons.add(o.skeleton); });
  skeletons.forEach(skeleton => skeleton.dispose());
  return snapshots;
}

export function createReflectionSnapshots(actor, quality = "medium") {
  if (!actor?.root) return [];
  const assets = reflectionAssetsForActor(actor, quality);
  if (assets) return assets;
  // Tiny procedural fixtures and legacy non-Echo silhouettes retain the CPU
  // path. A production Echo is required to complete its asynchronous preflight.
  const cell = quality === "high" ? .010 : quality === "light" ? .060 : .030;
  return bakeReflectionPoses(actor).map(surface => {
    const result = simplifyActorSnapshot(surface, cell); result.userData.sourceTriangles = surface.attributes.position.count / 3; surface.dispose(); return result;
  });
}

// The offline baker owns this actor. Calling its complete pose API preserves
// weapon orientation, expression and the same anatomical hand solver as play.
export function bakeAuthoredReflectionPoses(actor, { sampleTextures = false } = {}) {
  if (!actor?.pose || !actor?.weaponSegments) throw new Error("Authored reflection baking requires the complete fighter rig");
  return ECHO_REFLECTION_POSES.map(definition => {
    actor.pose(definition.pose, 0); actor.root.updateWorldMatrix(true, true);
    const family = ECHO_REFLECTION_FAMILIES[Math.floor(definition.index / 3)];
    const segment = actor.weaponSegments()[family.primaryBlade];
    if (!segment) throw new Error(`Missing real blade for ${definition.id}`);
    const local = segment.map(point => actor.root.worldToLocal(point.clone()));
    const surface = bakeActorSurface(actor.root, { sampleTextures });
    surface.userData.bladeAnchor = local[0].clone().lerp(local[1], family.contactFraction).toArray();
    surface.userData.bladeSegment = local.map(point => point.toArray());
    surface.userData.poseId = definition.id;
    return surface;
  });
}

// All three poses use the contact mesh's exact vertex correspondence. A
// different decimation per pose would interpolate unrelated limbs and faces.
export function transferSnapshotTopology(surface, topology) {
  const mapping = topology.attributes.sourceVertex;
  if (!mapping) throw new Error("Reflection topology has no source correspondence");
  const geometry = new THREE.BufferGeometry();
  for (const name of ["position", "color"]) {
    const source = surface.attributes[name], values = new Float32Array(mapping.count * 3);
    for (let i = 0; i < mapping.count; i++) {
      const index = mapping.getX(i);
      if (index >= source.count) throw new Error("Authored reflection poses changed surface topology");
      values.set(source.array.subarray(index * 3, index * 3 + 3), i * 3);
    }
    geometry.setAttribute(name, new THREE.BufferAttribute(values, 3));
  }
  geometry.setIndex(new THREE.BufferAttribute(topology.index.array, 1));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.userData = { ...surface.userData, sourceTriangles: surface.attributes.position.count / 3, sharedReflectionTopology: true };
  return geometry;
}

export function createReflectionVariantSnapshots(actor, quality = "medium") {
  if (!actor?.root) return [];
  const assets = reflectionAssetsForActor(actor, quality, { variants: true });
  if (assets) return assets;
  // Small anatomical test fixtures have no production fighter API. They still
  // exercise all authored phases and shared topology without borrowing state.
  const sources = [], copies = [], temporary = clone(actor.root);
  actor.root.traverse(o => sources.push(o)); temporary.traverse(o => copies.push(o));
  const model = copies[sources.indexOf(actor.model)], body = copies[sources.indexOf(actor.body)];
  const rig = model?.getObjectByName("upperarm01L") && body ? createPoseRig(model, body, "blades", actor.standingHeight ?? 2.1) : null;
  temporary.traverse(o => { if (/^EchoBlade[LR]$/.test(o.name)) o.visible = true; if (/^Echo(?:Sheath|StowedBlade)[LR]$/.test(o.name)) o.visible = false; });
  const raw = ECHO_REFLECTION_POSES.map(definition => { rig?.pose(definition.pose, 0); const geometry = bakeActorSurface(temporary); geometry.userData.poseId = definition.id; return geometry; });
  const snapshots = [];
  for (let family = 0; family < 8; family++) {
    const topology = simplifyActorSnapshot(raw[family * 3 + 1], quality === "light" ? .06 : quality === "high" ? .01 : .03, { motionSurfaces: [raw[family * 3], raw[family * 3 + 2]] });
    for (let phase = 0; phase < 3; phase++) snapshots.push(transferSnapshotTopology(raw[family * 3 + phase], topology));
    topology.dispose();
  }
  raw.forEach(geometry => geometry.dispose());
  const skeletons = new Set(); temporary.traverse(o => { if (o.isSkinnedMesh) skeletons.add(o.skeleton); }); skeletons.forEach(skeleton => skeleton.dispose());
  return snapshots;
}

// A small authored reflection atlas, rasterised from the actual posed surfaces.
// It lets the existing glass draw contain a fighter image without a render
// target, an extra camera pass, a glyph substitute or a white studio rectangle.
export function createActorMirrorAtlas(snapshots, tileWidth = 96, tileHeight = 160) {
  const baked = reflectionAssetData(snapshots)?.mirror;
  if (baked) {
    const texture = new THREE.DataTexture(baked.data, baked.width, baked.height, THREE.RGBAFormat);
    texture.colorSpace = THREE.SRGBColorSpace; texture.magFilter = texture.minFilter = THREE.LinearFilter; texture.repeat.set(1 / snapshots.length, 1); texture.needsUpdate = true; return texture;
  }
  const width = tileWidth * snapshots.length, pixels = new Uint8Array(width * tileHeight * 4), depth = new Float32Array(width * tileHeight).fill(-Infinity), color = new THREE.Color();
  for (let i = 0; i < width * tileHeight; i++) pixels.set([40, 55, 63, 70], i * 4);
  snapshots.forEach((geometry, pose) => {
    geometry.computeBoundingBox(); const bounds = geometry.boundingBox, size = bounds.getSize(new THREE.Vector3());
    const fit = Math.min((tileWidth - 10) / Math.max(.01, size.x), (tileHeight - 12) / Math.max(.01, size.y)), left = tileWidth * pose + tileWidth / 2 - (bounds.min.x + bounds.max.x) * .5 * fit, top = (tileHeight - size.y * fit) * .5;
    const positions = geometry.attributes.position, colors = geometry.attributes.color, normals = geometry.attributes.normal, indices = geometry.index;
    for (let i = 0; i + 2 < (indices?.count ?? positions.count); i += 3) {
      const vertices = [0, 1, 2].map(j => indices?.getX(i + j) ?? i + j), x = vertices.map(v => positions.getX(v) * fit + left), y = vertices.map(v => (positions.getY(v) - bounds.min.y) * fit + top), z = vertices.map(v => positions.getZ(v));
      const area = (y[1] - y[2]) * (x[0] - x[2]) + (x[2] - x[1]) * (y[0] - y[2]); if (Math.abs(area) < 1e-8) continue;
      const normalZ = vertices.reduce((sum, v) => sum + (normals?.getZ(v) ?? 1), 0) / 3, light = .50 + .40 * Math.max(0, normalZ);
      color.setRGB(...["r", "g", "b"].map((_, channel) => Math.min(.65, .035 + light * vertices.reduce((sum, v) => sum + (colors ? colors.array[v * 3 + channel] : .3), 0) / 3))).convertLinearToSRGB();
      const minX = Math.max(tileWidth * pose, Math.floor(Math.min(...x))), maxX = Math.min(tileWidth * (pose + 1) - 1, Math.ceil(Math.max(...x))), minY = Math.max(0, Math.floor(Math.min(...y))), maxY = Math.min(tileHeight - 1, Math.ceil(Math.max(...y)));
      for (let py = minY; py <= maxY; py++) for (let px = minX; px <= maxX; px++) {
        const a = ((y[1] - y[2]) * (px + .5 - x[2]) + (x[2] - x[1]) * (py + .5 - y[2])) / area, b = ((y[2] - y[0]) * (px + .5 - x[2]) + (x[0] - x[2]) * (py + .5 - y[2])) / area, c = 1 - a - b;
        if (a < -.00001 || b < -.00001 || c < -.00001) continue;
        const d = a * z[0] + b * z[1] + c * z[2], address = py * width + px; if (d < depth[address]) continue; depth[address] = d;
        pixels.set([color.r * 255, color.g * 255, color.b * 255, 238], address * 4);
      }
    }
  });
  const texture = new THREE.DataTexture(pixels, width, tileHeight, THREE.RGBAFormat); texture.colorSpace = THREE.SRGBColorSpace; texture.magFilter = texture.minFilter = THREE.LinearFilter; texture.repeat.set(1 / snapshots.length, 1); texture.needsUpdate = true; return texture;
}
