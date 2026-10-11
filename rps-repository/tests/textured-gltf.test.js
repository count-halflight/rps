import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { createTexturedGltfLoader, decodePNG } from "./helpers/texturedGltfLoader.js";

// Tiny independently encoded fixtures. RGB uses filters 0, 1, 2, 3 and 4 on
// successive rows; the expected colors do not depend on the decoder's logic.
const RGB = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAMAAAAFCAIAAAAPE8H1AAAAJElEQVR4nGPgEpHTMLJxC4hiBDLkwICJCwaYJeWURcCABS4GAIm8BGFzY5BMAAAAAElFTkSuQmCC", "base64");
const RGBA = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAGklEQVR4nGPgUbL4H8Wj1MDAyMTMkJJXwQ4AI8kDxYkRKvQAAAAASUVORK5CYII=", "base64");
const GRAY = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAAAAABawyK/AAAAEklEQVR4nGNgCF31n4HrhNwHABD+A99XbUvnAAAAAElFTkSuQmCC", "base64");

function glbWithImage(jsonOverrides = {}) {
  const json = {
    asset: { version: "2.0" }, scene: 0, scenes: [{ nodes: [] }], nodes: [],
    buffers: [{ byteLength: RGBA.length }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: RGBA.length }],
    images: [{ bufferView: 0, mimeType: "image/png", name: "fixture-rgba" }],
    textures: [{ source: 0 }], ...jsonOverrides,
  };
  const source = Buffer.from(JSON.stringify(json));
  const jsonChunk = Buffer.alloc(Math.ceil(source.length / 4) * 4, 32); source.copy(jsonChunk);
  const binaryChunk = Buffer.alloc(Math.ceil(RGBA.length / 4) * 4); RGBA.copy(binaryChunk);
  const result = Buffer.alloc(28 + jsonChunk.length + binaryChunk.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(jsonChunk.length, 12); result.writeUInt32LE(0x4e4f534a, 16); jsonChunk.copy(result, 20);
  const binaryOffset = 20 + jsonChunk.length;
  result.writeUInt32LE(binaryChunk.length, binaryOffset); result.writeUInt32LE(0x004e4942, binaryOffset + 4);
  binaryChunk.copy(result, binaryOffset + 8);
  return result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength);
}

function channelRange(data, channel) {
  let min = 255, max = 0;
  for (let i = channel; i < data.length; i += 4) { min = Math.min(min, data[i]); max = Math.max(max, data[i]); }
  return max - min;
}

test("PNG decoding reconstructs every scanline filter and real unsigned 8-bit RGB pixels", () => {
  const decoded = decodePNG(RGB);
  assert.equal(decoded.width, 3); assert.equal(decoded.height, 5);
  assert.equal(decoded.bitDepth, 8); assert.equal(decoded.colorType, 2);
  assert.deepEqual(decoded.filters, [0, 1, 2, 3, 4]);
  assert.ok(decoded.data instanceof Uint8Array);
  assert.equal(decoded.data.length, 3 * 5 * 4);
  for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) {
    const value = 10 + y * 10 + x * 30;
    assert.deepEqual([...decoded.data.slice((y * 3 + x) * 4, (y * 3 + x + 1) * 4)], [value, value + 10, value + 20, 255]);
  }
  // A subview must decode its own bytes, without reading the containing buffer.
  const wrapped = Buffer.concat([Buffer.from([1, 2]), RGB, Buffer.from([3])]);
  assert.deepEqual(decodePNG(wrapped.subarray(2, 2 + RGB.length)).data, decoded.data);
});

test("RGBA transparency and grayscale values survive PNG decoding without placeholder colors", () => {
  const rgba = decodePNG(RGBA);
  assert.equal(rgba.colorType, 6);
  assert.deepEqual([...rgba.data], [12, 34, 56, 255, 90, 12, 34, 128, 1, 2, 3, 0, 100, 110, 120, 7]);
  const gray = decodePNG(GRAY);
  assert.equal(gray.colorType, 0);
  for (const [index, value] of [0, 85, 170, 255, 10, 200, 30, 240].entries()) {
    assert.deepEqual([...gray.data.slice(index * 4, index * 4 + 4)], [value, value, value, 255]);
  }
});

test("malformed or unsupported PNGs reject explicitly instead of becoming blank test textures", () => {
  assert.throws(() => decodePNG(Buffer.from("not a png")), /signature/);
  assert.throws(() => decodePNG(RGB.subarray(0, RGB.length - 8)), /Truncated|lacks/);
  const sixteenBit = Buffer.from(RGB); sixteenBit[24] = 16;
  assert.throws(() => decodePNG(sixteenBit), /8-bit/);
  const interlaced = Buffer.from(RGB); interlaced[28] = 1;
  assert.throws(() => decodePNG(interlaced), /non-interlaced/);
});

test("the Node GLTF texture plugin applies real PNG pixels and glTF sampler defaults", async () => {
  const gltf = await createTexturedGltfLoader().parseAsync(glbWithImage(), "");
  const texture = await gltf.parser.getDependency("texture", 0);
  assert.ok(texture.isDataTexture);
  assert.equal(texture.type, THREE.UnsignedByteType); assert.equal(texture.format, THREE.RGBAFormat);
  assert.equal(texture.flipY, false);
  assert.equal(texture.magFilter, THREE.LinearFilter); assert.equal(texture.minFilter, THREE.LinearMipmapLinearFilter);
  assert.equal(texture.wrapS, THREE.RepeatWrapping); assert.equal(texture.wrapT, THREE.RepeatWrapping);
  assert.equal(texture.generateMipmaps, true);
  assert.deepEqual([...texture.image.data], [...decodePNG(RGBA).data]);
  assert.deepEqual(gltf.parser.associations.get(texture), { textures: 0 });
  assert.equal(texture.userData.png.rgbaByteLength, 16);
});

test("glTF texture transforms, color space and explicit samplers remain the parser's responsibility", async () => {
  const gltf = await createTexturedGltfLoader().parseAsync(glbWithImage({
    extensionsUsed: ["KHR_texture_transform"],
    samplers: [{ magFilter: 9728, minFilter: 9985, wrapS: 33071, wrapT: 33648 }],
    textures: [{ source: 0, sampler: 0 }],
    materials: [{ pbrMetallicRoughness: { baseColorTexture: {
      index: 0, extensions: { KHR_texture_transform: { offset: [.25, .125], scale: [2, 3], rotation: .4, texCoord: 1 } },
    } } }],
  }), "");
  const material = await gltf.parser.getDependency("material", 0), texture = material.map;
  assert.ok(texture.isDataTexture);
  assert.equal(texture.magFilter, THREE.NearestFilter); assert.equal(texture.minFilter, THREE.LinearMipmapNearestFilter);
  assert.equal(texture.wrapS, THREE.ClampToEdgeWrapping); assert.equal(texture.wrapT, THREE.MirroredRepeatWrapping);
  assert.equal(texture.colorSpace, THREE.SRGBColorSpace); assert.equal(texture.channel, 1);
  assert.deepEqual(texture.offset.toArray(), [.25, .125]); assert.deepEqual(texture.repeat.toArray(), [2, 3]);
  assert.equal(texture.rotation, .4); assert.equal(texture.flipY, false);
  assert.deepEqual([...texture.image.data], [...decodePNG(RGBA).data]);
  assert.deepEqual(gltf.parser.associations.get(texture), { textures: 0 });
});

test("all original 512px material maps decode to detailed, opaque production pixels", async () => {
  for (const stem of ["worn_leather", "ribbed_shirt", "fine_hair"]) {
    for (const suffix of ["baseColor", "normal", "roughness"]) {
      const png = await readFile(new URL(`../assets/generated/echo/${stem}_${suffix}.png`, import.meta.url));
      const image = decodePNG(png);
      assert.equal(image.width, 512); assert.equal(image.height, 512); assert.equal(image.bitDepth, 8);
      assert.ok(image.data instanceof Uint8Array); assert.equal(image.data.length, 512 * 512 * 4);
      assert.ok(channelRange(image.data, 0) > 2, `${stem} ${suffix} retains actual surface variation`);
      assert.equal(channelRange(image.data, 3), 0); assert.equal(image.data[3], 255);
      if (suffix === "roughness") {
        assert.equal(image.colorType, 0);
        for (let i = 0; i < image.data.length; i += 1024) {
          assert.equal(image.data[i], image.data[i + 1]); assert.equal(image.data[i], image.data[i + 2]);
        }
      }
    }
  }
});

test("the shipped textured Echo GLB preserves authored skin, leather, knit and hair pixels", async () => {
  const bytes = await readFile(new URL("../public/models/echo-human.glb", import.meta.url));
  const gltf = await createTexturedGltfLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
  const materials = new Map();
  gltf.scene.traverse((object) => {
    if (object.isMesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.set(material.name, material);
  });
  const skin = materials.get("Skin");
  assert.ok(skin?.map?.isDataTexture, "the production skin uses real authored pixels");
  assert.equal(skin.map.image.width, 2048); assert.equal(skin.map.image.height, 2048);
  assert.equal(skin.map.colorSpace, THREE.SRGBColorSpace);
  const sourceSkin = decodePNG(await readFile(new URL("../assets/source/makehuman/skins/young_asian_female/young_lightskinned_female_diffuse3.png", import.meta.url)));
  assert.deepEqual(skin.map.image.data, sourceSkin.data, "packing retains the exact CC0 skin atlas");
  let texturedFace = false;
  gltf.scene.traverse((object) => {
    if (object.isMesh && object.material === skin && object.morphTargetDictionary?.blink !== undefined) {
      assert.ok(object.geometry.attributes.uv?.count > 0, "the expressive face retains its source skin UVs");
      texturedFace = true;
    }
  });
  assert.ok(texturedFace, "the authored skin is on the actual expressive face");
  for (const [name, stem] of [["Tailored jacket", "worn_leather"], ["Leather", "worn_leather"], ["Shirt", "ribbed_shirt"], ["Hair", "fine_hair"], ["Hair strands", "fine_hair"]]) {
    const material = materials.get(name);
    assert.ok(material, `${name} exists in the production model`);
    for (const [property, suffix] of [["map", "baseColor"], ["normalMap", "normal"], ["roughnessMap", "roughness"]]) {
      const texture = material[property];
      assert.ok(texture?.isDataTexture, `${name} ${property} has decoded PNG pixels`);
      assert.equal(texture.image.width, 512); assert.equal(texture.image.height, 512);
      assert.equal(texture.type, THREE.UnsignedByteType); assert.equal(texture.flipY, false);
      assert.equal(texture.userData.png.bitDepth, 8); assert.ok(channelRange(texture.image.data, 1) > 2);
      assert.equal(texture.colorSpace, property === "map" ? THREE.SRGBColorSpace : THREE.NoColorSpace);
      assert.ok(texture.repeat.x > 1 && texture.repeat.y > 1, "exported KHR_texture_transform survives UV quantization");
      const original = decodePNG(await readFile(new URL(`../assets/generated/echo/${stem}_${suffix}.png`, import.meta.url)));
      if (property === "roughnessMap") {
        // glTF packs roughness in green and metallic in blue. Compare green
        // to the authored grayscale rather than asserting the packed layout.
        for (let i = 0; i < original.data.length; i += 1024) assert.equal(texture.image.data[i + 1], original.data[i + 1]);
      } else assert.deepEqual(texture.image.data, original.data, `${name} ${property} retains the authored PNG samples`);
    }
  }
});
