// Node-only test adapter. It decodes the embedded PNG pixels rather than
// installing browser globals or allowing texture loading to fail silently.
import { inflateSync } from "node:zlib";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const FILTERS = {
  9728: THREE.NearestFilter,
  9729: THREE.LinearFilter,
  9984: THREE.NearestMipmapNearestFilter,
  9985: THREE.LinearMipmapNearestFilter,
  9986: THREE.NearestMipmapLinearFilter,
  9987: THREE.LinearMipmapLinearFilter,
};
const WRAPPINGS = {
  33071: THREE.ClampToEdgeWrapping,
  33648: THREE.MirroredRepeatWrapping,
  10497: THREE.RepeatWrapping,
};

function asBuffer(bytes) {
  if (bytes instanceof ArrayBuffer) return Buffer.from(bytes);
  if (ArrayBuffer.isView(bytes)) return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  throw new TypeError("PNG input must be an ArrayBuffer or a byte view");
}

function paeth(left, above, upperLeft) {
  const prediction = left + above - upperLeft;
  const a = Math.abs(prediction - left), b = Math.abs(prediction - above), c = Math.abs(prediction - upperLeft);
  return a <= b && a <= c ? left : b <= c ? above : upperLeft;
}

/** Decode non-interlaced, 8-bit RGB, RGBA or grayscale PNG into real RGBA. */
export function decodePNG(bytes) {
  const png = asBuffer(bytes);
  if (png.length < 33 || !png.subarray(0, 8).equals(SIGNATURE)) throw new Error("Invalid PNG signature");
  let width, height, bitDepth, colorType, channels, transparency;
  let ended = false;
  const compressed = [];
  for (let offset = 8; offset < png.length;) {
    if (offset + 12 > png.length) throw new Error("Truncated PNG chunk header");
    const length = png.readUInt32BE(offset);
    if (offset + 12 + length > png.length) throw new Error("Truncated PNG chunk data");
    const type = png.toString("ascii", offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      if (width !== undefined || length !== 13 || offset !== 8) throw new Error("Invalid PNG header");
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
      channels = { 0: 1, 2: 3, 6: 4 }[colorType];
      if (!width || !height || width * height > 16_777_216) throw new Error("Invalid or excessive PNG dimensions");
      if (bitDepth !== 8 || !channels || data[10] !== 0 || data[11] !== 0 || data[12] !== 0) {
        throw new Error("Only non-interlaced 8-bit RGB, RGBA and grayscale PNGs are supported");
      }
    } else if (type === "IDAT") {
      if (width === undefined) throw new Error("PNG image data precedes its header");
      compressed.push(data);
    } else if (type === "tRNS") {
      transparency = data;
    } else if (type === "IEND") {
      if (length !== 0) throw new Error("Invalid PNG end marker");
      ended = true;
      break;
    }
    offset += length + 12;
  }
  if (width === undefined || !ended || compressed.length === 0) throw new Error("PNG lacks required image chunks");
  const stride = width * channels;
  const expectedBytes = (stride + 1) * height;
  const rows = inflateSync(Buffer.concat(compressed), { maxOutputLength: expectedBytes });
  if (rows.length !== expectedBytes) throw new Error("PNG scanline byte count does not match its dimensions");
  const pixels = new Uint8Array(stride * height);
  const usedFilters = new Set();
  for (let y = 0; y < height; y++) {
    const filter = rows[y * (stride + 1)];
    if (filter > 4) throw new Error(`Unsupported PNG scanline filter ${filter}`);
    usedFilters.add(filter);
    for (let x = 0; x < stride; x++) {
      const index = y * stride + x;
      const left = x >= channels ? pixels[index - channels] : 0;
      const above = y > 0 ? pixels[index - stride] : 0;
      const upperLeft = y > 0 && x >= channels ? pixels[index - stride - channels] : 0;
      const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? above
        : filter === 3 ? Math.floor((left + above) / 2) : paeth(left, above, upperLeft);
      pixels[index] = (rows[y * (stride + 1) + x + 1] + predictor) & 255;
    }
  }
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const source = i * channels, target = i * 4;
    if (colorType === 0) {
      data[target] = data[target + 1] = data[target + 2] = pixels[source];
      data[target + 3] = transparency?.length === 2 && pixels[source] === transparency.readUInt16BE(0) ? 0 : 255;
    } else {
      data[target] = pixels[source]; data[target + 1] = pixels[source + 1]; data[target + 2] = pixels[source + 2];
      const transparent = colorType === 2 && transparency?.length === 6
        && pixels[source] === transparency.readUInt16BE(0)
        && pixels[source + 1] === transparency.readUInt16BE(2)
        && pixels[source + 2] === transparency.readUInt16BE(4);
      data[target + 3] = colorType === 6 ? pixels[source + 3] : transparent ? 0 : 255;
    }
  }
  return { data, width, height, bitDepth, colorType, filters: [...usedFilters].sort(), sourceByteLength: png.length };
}

/** A real PNG loader for embedded GLB images. Production still uses GLTFLoader. */
export function createTexturedGltfLoader() {
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).register((parser) => ({
    name: "NodePNGTextures",
    loadTexture(index) {
      const definition = parser.json.textures?.[index];
      const image = parser.json.images?.[definition?.source];
      if (!image || image.bufferView === undefined || image.mimeType !== "image/png") return null;
      const key = `node-png:${image.bufferView}:${definition.sampler ?? "default"}`;
      if (parser.textureCache[key]) return parser.textureCache[key];
      const loading = parser.getDependency("bufferView", image.bufferView).then((bytes) => {
        const decoded = decodePNG(bytes);
        const texture = new THREE.DataTexture(decoded.data, decoded.width, decoded.height, THREE.RGBAFormat, THREE.UnsignedByteType);
        texture.name = definition.name || image.name || "";
        texture.flipY = false;
        const sampler = parser.json.samplers?.[definition.sampler] || {};
        texture.magFilter = FILTERS[sampler.magFilter] ?? THREE.LinearFilter;
        texture.minFilter = FILTERS[sampler.minFilter] ?? THREE.LinearMipmapLinearFilter;
        texture.wrapS = WRAPPINGS[sampler.wrapS] ?? THREE.RepeatWrapping;
        texture.wrapT = WRAPPINGS[sampler.wrapT] ?? THREE.RepeatWrapping;
        texture.generateMipmaps = texture.minFilter !== THREE.NearestFilter && texture.minFilter !== THREE.LinearFilter;
        texture.userData.png = {
          width: decoded.width, height: decoded.height, bitDepth: decoded.bitDepth, colorType: decoded.colorType,
          filters: decoded.filters, sourceByteLength: decoded.sourceByteLength, rgbaByteLength: decoded.data.byteLength,
        };
        parser.associations.set(texture, { textures: index });
        texture.needsUpdate = true;
        return texture;
      });
      parser.textureCache[key] = loading;
      return loading;
    },
  }));
}
