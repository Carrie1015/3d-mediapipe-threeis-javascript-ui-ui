import { normalizeVec3, readVec3 } from "../math.js";

const GLB_MAGIC = 0x46546c67;
const BIN_CHUNK = 0x004e4942;
const MAX_TEXTURE_SIZE = 768;

export async function parseGlb(arrayBuffer) {
  const data = new DataView(arrayBuffer);
  if (data.getUint32(0, true) !== GLB_MAGIC) {
    throw new Error("不是有效 GLB 文件");
  }

  const jsonLength = data.getUint32(12, true);
  const jsonText = new TextDecoder().decode(new Uint8Array(arrayBuffer, 20, jsonLength));
  const gltf = JSON.parse(jsonText);
  const binChunk = getBinChunk(arrayBuffer, data, 20 + jsonLength);

  const textures = await decodeTextures(gltf, binChunk);
  const meshes = [];

  for (const mesh of gltf.meshes || []) {
    for (const primitive of mesh.primitives || []) {
      const positionAccessorIndex = primitive.attributes?.POSITION;
      if (positionAccessorIndex === undefined) continue;

      const positions = readAccessor(gltf, binChunk, positionAccessorIndex);
      const normals = primitive.attributes?.NORMAL === undefined
        ? null
        : readAccessor(gltf, binChunk, primitive.attributes.NORMAL);
      const uvs = primitive.attributes?.TEXCOORD_0 === undefined
        ? null
        : readAccessor(gltf, binChunk, primitive.attributes.TEXCOORD_0);
      const indices = primitive.indices === undefined
        ? null
        : readAccessor(gltf, binChunk, primitive.indices);
      const material = gltf.materials?.[primitive.material];
      const textureIndex = material?.pbrMetallicRoughness?.baseColorTexture?.index;
      const texture = textureIndex === undefined ? null : textures[textureIndex];
      const factor = material?.pbrMetallicRoughness?.baseColorFactor || [1, 1, 1, 1];

      meshes.push({ positions, normals, uvs, indices, texture, factor });
    }
  }

  return normalizeMeshes(meshes);
}

function getBinChunk(arrayBuffer, data, startOffset) {
  let offset = startOffset;

  while (offset + 8 <= arrayBuffer.byteLength) {
    const chunkLength = data.getUint32(offset, true);
    const chunkType = data.getUint32(offset + 4, true);
    if (chunkType === BIN_CHUNK) {
      return arrayBuffer.slice(offset + 8, offset + 8 + chunkLength);
    }
    offset += 8 + chunkLength;
  }

  throw new Error("GLB BIN chunk 缺失");
}

async function decodeTextures(gltf, binChunk) {
  const textures = [];

  for (const texture of gltf.textures || []) {
    const image = gltf.images?.[texture.source];
    const view = gltf.bufferViews?.[image?.bufferView];
    if (!image || !view) {
      textures.push(null);
      continue;
    }

    const viewOffset = view.byteOffset || 0;
    const bytes = binChunk.slice(viewOffset, viewOffset + view.byteLength);
    const blob = new Blob([bytes], { type: image.mimeType || "image/jpeg" });
    const bitmap = await createImageBitmap(blob);
    const textureCanvas = document.createElement("canvas");
    const textureScale = Math.min(1, MAX_TEXTURE_SIZE / Math.max(bitmap.width, bitmap.height));

    textureCanvas.width = Math.max(1, Math.round(bitmap.width * textureScale));
    textureCanvas.height = Math.max(1, Math.round(bitmap.height * textureScale));

    const textureContext = textureCanvas.getContext("2d", { willReadFrequently: true });
    textureContext.imageSmoothingEnabled = true;
    textureContext.imageSmoothingQuality = "high";
    textureContext.drawImage(bitmap, 0, 0, textureCanvas.width, textureCanvas.height);
    textures.push({
      width: textureCanvas.width,
      height: textureCanvas.height,
      data: textureContext.getImageData(0, 0, textureCanvas.width, textureCanvas.height).data,
    });
    bitmap.close();
  }

  return textures;
}

function readAccessor(gltf, binChunk, accessorIndex) {
  const accessor = gltf.accessors[accessorIndex];
  const view = gltf.bufferViews[accessor.bufferView];
  const componentSize = getComponentSize(accessor.componentType);
  const componentCount = getTypeSize(accessor.type);
  const byteOffset = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const byteStride = view.byteStride || componentSize * componentCount;
  const count = accessor.count;

  if (accessor.componentType === 5126 && byteStride === componentSize * componentCount && byteOffset % 4 === 0) {
    return {
      values: new Float32Array(binChunk, byteOffset, count * componentCount).slice(),
      componentCount,
      count,
    };
  }

  const values = new Float32Array(count * componentCount);
  const source = new DataView(binChunk);

  for (let i = 0; i < count; i += 1) {
    const itemOffset = byteOffset + i * byteStride;
    for (let c = 0; c < componentCount; c += 1) {
      values[i * componentCount + c] = readComponent(
        source,
        itemOffset + c * componentSize,
        accessor.componentType
      );
    }
  }

  return { values, componentCount, count };
}

function readComponent(view, byteOffset, componentType) {
  switch (componentType) {
    case 5120: return view.getInt8(byteOffset);
    case 5121: return view.getUint8(byteOffset);
    case 5122: return view.getInt16(byteOffset, true);
    case 5123: return view.getUint16(byteOffset, true);
    case 5125: return view.getUint32(byteOffset, true);
    case 5126: return view.getFloat32(byteOffset, true);
    default: throw new Error(`不支持的组件类型 ${componentType}`);
  }
}

function getComponentSize(componentType) {
  if (componentType === 5120 || componentType === 5121) return 1;
  if (componentType === 5122 || componentType === 5123) return 2;
  if (componentType === 5125 || componentType === 5126) return 4;
  throw new Error(`不支持的组件类型 ${componentType}`);
}

function getTypeSize(type) {
  return { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[type] || 1;
}

function normalizeMeshes(meshes) {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (const mesh of meshes) {
    for (let i = 0; i < mesh.positions.count; i += 1) {
      const offset = i * mesh.positions.componentCount;
      const { x, y, z } = readVec3(mesh.positions.values, offset);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    }
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const scale = 4.3 / Math.max(maxX - minX, maxY - minY, maxZ - minZ, 0.001);

  for (const mesh of meshes) {
    for (let i = 0; i < mesh.positions.count; i += 1) {
      const offset = i * mesh.positions.componentCount;
      mesh.positions.values[offset] = (mesh.positions.values[offset] - centerX) * scale;
      mesh.positions.values[offset + 1] = (mesh.positions.values[offset + 1] - centerY) * scale;
      mesh.positions.values[offset + 2] = (mesh.positions.values[offset + 2] - centerZ) * scale;
    }
  }

  return meshes;
}

export function readNormal(mesh, vertexIndex) {
  if (!mesh.normals) return { x: 0, y: 0, z: 1 };
  const offset = vertexIndex * mesh.normals.componentCount;
  return normalizeVec3(readVec3(mesh.normals.values, offset));
}
