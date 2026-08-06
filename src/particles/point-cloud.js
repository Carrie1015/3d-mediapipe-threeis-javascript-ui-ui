import { fract, hash01, readVec3, smoothstep } from "../math.js";
import { readNormal } from "../gl/glb-loader.js";

export function buildPointCloud(meshes, maxParticles) {
  const totalVertices = meshes.reduce((sum, mesh) => sum + mesh.positions.count, 0);
  const count = Math.min(Math.floor(totalVertices * 1.8), maxParticles);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const seeds = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const globalIndex = Math.floor(((i * 0.61803398875) % 1) * totalVertices);
    const selected = pickMeshForVertex(meshes, globalIndex);
    const vertexIndex = selected.localIndex;
    const offset = vertexIndex * selected.mesh.positions.componentCount;
    const p = readVec3(selected.mesh.positions.values, offset);
    const seed = hash01(i) * Math.PI * 2;
    const shell = Math.floor(i / totalVertices);
    const jitter = shell === 0 ? 0 : 0.0002 * shell;
    const color = sampleTextureColor(selected.mesh, vertexIndex, p);
    const normal = readNormal(selected.mesh, vertexIndex);
    const out = i * 3;

    positions[out] = p.x + Math.sin(seed * 1.7) * jitter;
    positions[out + 1] = p.y + Math.cos(seed * 1.3) * jitter;
    positions[out + 2] = p.z + Math.sin(seed * 2.1) * jitter;
    colors[out] = color.r / 255;
    colors[out + 1] = color.g / 255;
    colors[out + 2] = color.b / 255;
    normals[out] = normal.x;
    normals[out + 1] = normal.y;
    normals[out + 2] = normal.z;
    seeds[i] = seed;
  }

  return { positions, colors, normals, seeds, count };
}

function pickMeshForVertex(meshes, globalIndex) {
  let localIndex = globalIndex;
  for (const mesh of meshes) {
    if (localIndex < mesh.positions.count) return { mesh, localIndex };
    localIndex -= mesh.positions.count;
  }

  const mesh = meshes[meshes.length - 1];
  return { mesh, localIndex: Math.max(0, mesh.positions.count - 1) };
}

function sampleTextureColor(mesh, vertexIndex, point) {
  if (!mesh.texture || !mesh.uvs) {
    return fallbackModelColor(point);
  }

  const uvOffset = vertexIndex * mesh.uvs.componentCount;
  const u = fract(mesh.uvs.values[uvOffset]);
  const v = fract(mesh.uvs.values[uvOffset + 1]);
  const x = Math.min(mesh.texture.width - 1, Math.max(0, Math.floor(u * mesh.texture.width)));
  const y = Math.min(mesh.texture.height - 1, Math.max(0, Math.floor(v * mesh.texture.height)));
  const pixel = (y * mesh.texture.width + x) * 4;
  const factor = mesh.factor || [1, 1, 1, 1];

  return {
    r: mesh.texture.data[pixel] * factor[0],
    g: mesh.texture.data[pixel + 1] * factor[1],
    b: mesh.texture.data[pixel + 2] * factor[2],
  };
}

function fallbackModelColor(point) {
  const height = smoothstep(-1.8, 1.8, point.y);
  return {
    r: 142 + height * 50,
    g: 112 + height * 42,
    b: 78 + height * 30,
  };
}

