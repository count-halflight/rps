import { DoubleSide, VSMShadowMap, Box3, Matrix4, Vector3 } from 'three';

export const SCENE_DRAW_BUDGET = 150;
// UnrealBloom: high pass + ten blurs + composite + blend; grade and output.
// The scene RenderPass is counted separately by estimateSceneDraws.
export const FILM_POST_DRAWS = 15;
export const FILM_LIGHT_POST_DRAWS = 2;

const massMeasures = new WeakMap();
const finiteCount = value => Math.max(0, Number.isFinite(value) ? Math.floor(value) : 0);

function visitVisible(root, excluded, callback, ignoreRootVisibility = false) {
  if (!root) return;
  const blocked = new Set(excluded || []);
  if (!ignoreRootVisibility) for (let parent = root.parent; parent; parent = parent.parent) {
    if (parent.visible === false || blocked.has(parent)) return;
  }
  const stack = [root];
  while (stack.length) {
    const object = stack.pop();
    if (blocked.has(object) || (object.visible === false && !(ignoreRootVisibility && object === root))) continue;
    callback(object);
    for (let i = object.children.length - 1; i >= 0; i--) stack.push(object.children[i]);
  }
}

function drawMaterials(object) {
  if (!(object.isMesh || object.isLine || object.isPoints || object.isSprite)) return [];
  // A positive instance count still issues a draw when all its transforms are
  // zero-scaled. Only count=0 or visible=false removes that GPU call.
  if (object.isInstancedMesh && object.count <= 0) return [];
  if (object.isSprite) return object.material?.visible !== false ? [object.material].filter(Boolean) : [];
  const geometry = object.geometry;
  if (!geometry?.attributes.position) return [];
  const available = geometry.index?.count ?? geometry.attributes.position.count;
  const drawStart = Math.max(0, geometry.drawRange?.start || 0);
  const drawEnd = Math.min(available, drawStart + (geometry.drawRange?.count ?? Infinity));
  if (!(drawEnd > drawStart)) return [];
  if (!Array.isArray(object.material)) return object.material?.visible !== false ? [object.material].filter(Boolean) : [];
  // WebGLRenderer renders an array material once per nonempty geometry group.
  // It does not render one pass per entry in the material array.
  return geometry.groups.filter(group => Math.min(drawEnd, group.start + group.count) > Math.max(drawStart, group.start))
    .map(group => object.material[group.materialIndex]).filter(material => material && material.visible !== false);
}

const colorPasses = material => material.transparent === true && material.side === DoubleSide && material.forceSinglePass === false ? 2 : 1;

function scenePass(scene, options = {}) {
  let color = scene.background?.isTexture ? 1 : 0, casters = 0, opaque = 0, transmissiveBacks = 0, hasTransmission = false;
  let shadowPasses = 0, shadowBlur = 0;
  const vsm = options.shadowType === VSMShadowMap;
  visitVisible(scene, options.exclude || options.excluded, object => {
    if (options.camera && object.layers && !object.layers.test(options.camera.layers)) return;
    if (object.isLight && object.castShadow) {
      shadowPasses += object.isPointLight ? 6 : 1;
      if (vsm && !object.isPointLight) shadowBlur += 2;
    }
    const materials = drawMaterials(object);
    for (const material of materials) {
      const renderedMaterial = scene.overrideMaterial || material;
      if (renderedMaterial.visible !== false) {
        color += colorPasses(renderedMaterial);
        if (!scene.overrideMaterial && material.transmission > 0) {
          hasTransmission = true;
          if (material.side === DoubleSide) transmissiveBacks++;
        } else if (!material.transparent) opaque += colorPasses(renderedMaterial);
      }
      if (object.castShadow || (vsm && object.receiveShadow)) casters++;
    }
  });
  const shadows = options.shadows !== false;
  if (!shadows) shadowPasses = shadowBlur = 0;
  const shadow = casters * shadowPasses + shadowBlur;
  // A transmissive material causes an additional opaque-scene render and,
  // conservatively, one back-face draw per DoubleSide transmissive group.
  const transmission = hasTransmission ? opaque + transmissiveBacks + (scene.background?.isTexture ? 1 : 0) : 0;
  return { color, shadow, transmission, shadowPasses, casters };
}

/** Conservative pre-frame upper bound for this renderer's submitted draws.
 * It intentionally ignores camera frustum/occlusion and shader discards.
 * Arbitrary render callbacks must declare their extra pass, as reflection does.
 * No WebGL context, scene mutation, or previous-frame telemetry is required.
 */
export function estimateSceneDraws(scene, options = {}) {
  const main = scenePass(scene, options), post = finiteCount(options.post || 0);
  const plan = options.reflection;
  let reflection = 0;
  if (plan?.enabled) {
    const passes = finiteCount(plan.maxPasses ?? plan.passes ?? 1);
    const reflected = scenePass(scene, {
      ...options, camera: plan.camera || options.camera,
      exclude: [...(options.exclude || options.excluded || []), ...(plan.exclude || plan.excluded || [])],
      shadows: plan.shadows === true,
    });
    reflection = passes * (reflected.color + reflected.shadow + reflected.transmission);
  }
  const baseTotal = main.color + main.shadow + main.transmission + post;
  return { ...main, post, reflection, baseTotal, total: baseTotal + reflection };
}

function geometryMass(object) {
  const geometry = object.geometry, position = geometry?.attributes.position;
  if (!position) return 0;
  let measure = massMeasures.get(geometry);
  if (!measure) {
    const bounds = geometry.boundingBox || new Box3().setFromBufferAttribute(position);
    const origin = bounds.getCenter(new Vector3()), a = new Vector3(), b = new Vector3(), c = new Vector3(), ab = new Vector3(), ac = new Vector3(), cross = new Vector3();
    let volume = 0, area = 0;
    const count = geometry.index?.count ?? position.count;
    for (let i = 0; i + 2 < count; i += 3) {
      a.fromBufferAttribute(position, geometry.index ? geometry.index.getX(i) : i).sub(origin);
      b.fromBufferAttribute(position, geometry.index ? geometry.index.getX(i + 1) : i + 1).sub(origin);
      c.fromBufferAttribute(position, geometry.index ? geometry.index.getX(i + 2) : i + 2).sub(origin);
      ab.subVectors(b, a); ac.subVectors(c, a); area += cross.crossVectors(ab, ac).length() * .5;
      volume += a.dot(cross.crossVectors(b, c)) / 6;
    }
    measure = { volume: Math.abs(volume), area }; massMeasures.set(geometry, measure);
  }
  const scales = new Vector3().setFromMatrixScale(object.matrixWorld);
  let instanceVolume = 1, instanceArea = 1;
  if (object.isInstancedMesh) {
    instanceVolume = instanceArea = 0;
    const matrix = new Matrix4(), scale = new Vector3();
    for (let i = 0; i < object.count; i++) {
      object.getMatrixAt(i, matrix); scale.setFromMatrixScale(matrix);
      if (scale.lengthSq() < 1e-12) continue;
      instanceVolume += Math.abs(matrix.determinant());
      instanceArea += Math.max(scale.x * scale.y, scale.y * scale.z, scale.x * scale.z);
    }
  }
  // Use actual triangle volume, not the bounding envelope: a mesh combining
  // boots and a small harness has a body-sized box full of empty space. A
  // small true-area term still ranks open cloth sensibly. Both are cached.
  return measure.volume * Math.abs(object.matrixWorld.determinant()) * instanceVolume
    + measure.area * Math.max(scales.x * scales.y, scales.y * scales.z, scales.x * scales.z) * instanceArea * .006;
}

/** Apply the actor shadow cap after equipping/phase updates, including armour.
 * A hidden actor can be prepared, but hidden gear descendants cannot be chosen.
 */
export function selectLargestShadowCasters(actorRoot, maximum = 3) {
  const all = [], candidates = []; actorRoot?.updateWorldMatrix(true, true);
  actorRoot?.traverse(object => { if (object.isMesh || object.isLine || object.isPoints) all.push(object); });
  visitVisible(actorRoot, [], object => {
    if (!object.isMesh || object.userData.noShadow) return;
    const materials = drawMaterials(object);
    if (!materials.length || materials.every(material => material.transparent || material.opacity < .5)) return;
    const mass = geometryMass(object);
    if (mass > 0) candidates.push({ object, mass });
  }, true);
  candidates.sort((a, b) => b.mass - a.mass || a.object.id - b.object.id);
  const selected = candidates.slice(0, finiteCount(maximum)).map(candidate => candidate.object), kept = new Set(selected);
  for (const object of all) object.castShadow = kept.has(object);
  return selected;
}
