const MODEL_URL = "./assets/buddha-statue-datong.glb";
const MAX_PARTICLES = 1800000;

const canvas = document.getElementById("stage");
const gl = canvas.getContext("webgl", {
  alpha: false,
  antialias: false,
  depth: true,
  powerPreference: "high-performance",
});

if (!gl) {
  throw new Error("当前浏览器不支持 WebGL");
}

let width = 0;
let height = 0;
let dpr = 1;
let particleCount = 0;
let program = null;
let positionBuffer = null;
let colorBuffer = null;
let normalBuffer = null;
let seedBuffer = null;
let rotationX = -0.08;
let rotationY = 0;
let targetRotationX = rotationX;
let targetRotationY = rotationY;
let zoom = 1.62;
let targetZoom = 1.62;
let burstStartTime = -10;
let dragging = false;
let lastX = 0;
let lastY = 0;
let startTime = performance.now();
let loaded = false;

const status = document.createElement("div");
status.textContent = "加载百万级点云中";
status.style.cssText = [
  "position:fixed",
  "left:50%",
  "top:50%",
  "transform:translate(-50%,-50%)",
  "color:rgba(190,215,255,.86)",
  "font:14px system-ui,-apple-system,BlinkMacSystemFont,sans-serif",
  "pointer-events:none",
].join(";");
document.body.appendChild(status);

window.__particleDebug = { state: "boot" };

resize();
bindEvents();

async function load() {
  try {
    window.__particleDebug.state = "fetching-model";
    const response = await fetch(MODEL_URL);
    if (!response.ok) throw new Error(`模型加载失败 ${response.status}`);

    const buffer = await response.arrayBuffer();
    window.__particleDebug.state = "parsing-model";
    const meshes = await parseGlb(buffer);

    window.__particleDebug.state = "building-million-point-cloud";
    const cloud = buildPointCloud(meshes, MAX_PARTICLES);
    particleCount = cloud.count;

    uploadBuffer(positionBuffer, cloud.positions, 3);
    uploadBuffer(colorBuffer, cloud.colors, 3);
    uploadBuffer(normalBuffer, cloud.normals, 3);
    uploadBuffer(seedBuffer, cloud.seeds, 1);

    loaded = true;
    status.remove();
    window.__particleDebug = { state: "ready", particleCount };
  } catch (error) {
    console.error(error);
    status.textContent = "模型加载失败";
    window.__particleDebug = { state: "error", message: error.message };
  }
}

function initWebGL() {
  program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
  gl.useProgram(program);

  positionBuffer = gl.createBuffer();
  colorBuffer = gl.createBuffer();
  normalBuffer = gl.createBuffer();
  seedBuffer = gl.createBuffer();

  gl.clearColor(0, 0, 0, 1);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.depthMask(true);
  gl.disable(gl.BLEND);
}

function uploadBuffer(buffer, data, size) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

  let attributeName = "a_seed";
  if (buffer === positionBuffer) attributeName = "a_position";
  if (buffer === colorBuffer) attributeName = "a_color";
  if (buffer === normalBuffer) attributeName = "a_normal";
  const location = gl.getAttribLocation(program, attributeName);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
}

async function parseGlb(arrayBuffer) {
  const data = new DataView(arrayBuffer);
  if (data.getUint32(0, true) !== 0x46546c67) {
    throw new Error("不是有效 GLB 文件");
  }

  const jsonLength = data.getUint32(12, true);
  const jsonText = new TextDecoder().decode(new Uint8Array(arrayBuffer, 20, jsonLength));
  const gltf = JSON.parse(jsonText);
  let offset = 20 + jsonLength;
  let binChunk = null;

  while (offset + 8 <= arrayBuffer.byteLength) {
    const chunkLength = data.getUint32(offset, true);
    const chunkType = data.getUint32(offset + 4, true);
    if (chunkType === 0x004e4942) {
      binChunk = arrayBuffer.slice(offset + 8, offset + 8 + chunkLength);
      break;
    }
    offset += 8 + chunkLength;
  }

  if (!binChunk) throw new Error("GLB BIN chunk 缺失");

  const textureCanvases = await decodeTextures(gltf, binChunk);
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
      const material = gltf.materials?.[primitive.material];
      const textureIndex = material?.pbrMetallicRoughness?.baseColorTexture?.index;
      const texture = textureIndex === undefined ? null : textureCanvases[textureIndex];
      const factor = material?.pbrMetallicRoughness?.baseColorFactor || [1, 1, 1, 1];
      meshes.push({ positions, normals, uvs, texture, factor });
    }
  }

  return normalizeMeshes(meshes);
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

    const bytes = binChunk.slice(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
    const blob = new Blob([bytes], { type: image.mimeType || "image/jpeg" });
    const bitmap = await createImageBitmap(blob);
    const textureCanvas = document.createElement("canvas");
    const maxTextureSize = 768;
    const textureScale = Math.min(1, maxTextureSize / Math.max(bitmap.width, bitmap.height));
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
      const x = mesh.positions.values[offset];
      const y = mesh.positions.values[offset + 1];
      const z = mesh.positions.values[offset + 2];
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

function buildPointCloud(meshes, maxParticles) {
  const totalVertices = meshes.reduce((sum, mesh) => sum + mesh.positions.count, 0);
  const count = Math.min(Math.floor(totalVertices * 1.8), maxParticles);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const seeds = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const globalIndex = Math.floor((i * 0.61803398875 % 1) * totalVertices);
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

function readVec3(values, offset) {
  return {
    x: values[offset],
    y: values[offset + 1],
    z: values[offset + 2],
  };
}

function readNormal(mesh, vertexIndex) {
  if (!mesh.normals) return { x: 0, y: 0, z: 1 };
  const offset = vertexIndex * mesh.normals.componentCount;
  return normalizeVec3(readVec3(mesh.normals.values, offset));
}

function normalizeVec3(vector) {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
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

function smoothstep(edge0, edge1, value) {
  const x = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return x * x * (3 - 2 * x);
}

function clampColor(value) {
  return Math.max(0, Math.min(255, value));
}

function fract(value) {
  return value - Math.floor(value);
}

function hash01(value) {
  const x = Math.sin(value * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function bindEvents() {
  window.addEventListener("resize", resize);
  canvas.addEventListener("pointerdown", (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    targetRotationY += dx * 0.008;
    targetRotationX += dy * 0.006;
    targetRotationX = Math.max(-1.2, Math.min(1.2, targetRotationX));
    lastX = event.clientX;
    lastY = event.clientY;
  });
  canvas.addEventListener("pointerup", (event) => {
    dragging = false;
    canvas.releasePointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointercancel", () => {
    dragging = false;
  });
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.0012);
    targetZoom = Math.max(0.9, Math.min(3.2, targetZoom * factor));
  }, { passive: false });
  canvas.addEventListener("dblclick", () => {
    burstStartTime = (performance.now() - startTime) / 1000;
  });
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  gl.viewport(0, 0, canvas.width, canvas.height);
}

function animate() {
  requestAnimationFrame(animate);

  if (!dragging) targetRotationY += 0.0014;
  rotationX += (targetRotationX - rotationX) * 0.1;
  rotationY += (targetRotationY - rotationY) * 0.1;
  zoom += (targetZoom - zoom) * 0.12;

  gl.clear(gl.COLOR_BUFFER_BIT);
  if (!loaded) return;
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.useProgram(program);
  const time = (performance.now() - startTime) / 1000;
  gl.uniform1f(gl.getUniformLocation(program, "u_time"), time);
  gl.uniform1f(gl.getUniformLocation(program, "u_burstAge"), time - burstStartTime);
  gl.uniform1f(gl.getUniformLocation(program, "u_rotationX"), rotationX);
  gl.uniform1f(gl.getUniformLocation(program, "u_rotationY"), rotationY);
  gl.uniform1f(gl.getUniformLocation(program, "u_aspect"), height / Math.max(1, width));
  gl.uniform1f(gl.getUniformLocation(program, "u_zoom"), zoom);
  gl.uniform1f(gl.getUniformLocation(program, "u_pointSize"), 5.2 * dpr);
  gl.drawArrays(gl.POINTS, 0, particleCount);
}

function createProgram(context, vertexSource, fragmentSource) {
  const vertexShader = createShader(context, context.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(context, context.FRAGMENT_SHADER, fragmentSource);
  const linkedProgram = context.createProgram();
  context.attachShader(linkedProgram, vertexShader);
  context.attachShader(linkedProgram, fragmentShader);
  context.linkProgram(linkedProgram);

  if (!context.getProgramParameter(linkedProgram, context.LINK_STATUS)) {
    throw new Error(context.getProgramInfoLog(linkedProgram));
  }

  return linkedProgram;
}

function createShader(context, type, source) {
  const shader = context.createShader(type);
  context.shaderSource(shader, source);
  context.compileShader(shader);

  if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
    throw new Error(context.getShaderInfoLog(shader));
  }

  return shader;
}

const vertexShaderSource = `
  attribute vec3 a_position;
  attribute vec3 a_color;
  attribute vec3 a_normal;
  attribute float a_seed;

  uniform float u_time;
  uniform float u_rotationX;
  uniform float u_rotationY;
  uniform float u_aspect;
  uniform float u_zoom;
  uniform float u_pointSize;
  uniform float u_burstAge;

  varying vec3 v_color;
  varying float v_alpha;
  varying float v_keep;
  varying float v_flow;

  void main() {
    vec3 p = a_position;
    float topOrder = smoothstep(-1.9, 2.0, a_position.y);
    float randomA = fract(sin(a_seed * 13.71) * 43758.5453);
    float randomB = fract(sin(a_seed * 6.43) * 24634.6345);
    float verticalDelay = (1.0 - topOrder) * 1.75;
    float delay = verticalDelay + randomA * 0.12;
    float age = max(0.0, u_burstAge - delay);
    float scatter = smoothstep(0.0, 1.05, age);
    float returnDelay = topOrder * 0.74 + randomB * 0.42;
    float returnFlow = smoothstep(3.85 + returnDelay, 5.75 + returnDelay, age);
    float mist = max(0.0, scatter * (1.0 - returnFlow));

    float side = sin(a_seed * 2.41);
    float grain = fract(sin(a_seed * 9.17) * 43758.5453);
    float strandId = floor(grain * 11.0);
    float strandPhase = strandId * 0.73 + a_seed * 0.19;
    float heightBand = fract((a_position.y + 2.2) * 2.8 + strandId * 0.17);
    float strandCore = abs(sin(strandId * 1.37 + a_position.y * 5.2 + a_position.x * 2.7 + a_position.z * 1.8));
    float layerGate = smoothstep(0.72, 0.98, heightBand) * (1.0 - smoothstep(0.98, 1.0, heightBand));
    float strandGate = max(smoothstep(0.955, 0.996, strandCore), layerGate * 0.88);
    float filamentGate = max(strandGate, smoothstep(0.9975, 1.0, randomA));
    vec3 laneDir = normalize(vec3(
      sin(strandId * 1.91 + side * 0.35) * 0.48,
      1.0,
      cos(strandId * 1.37 + grain * 2.0) * 0.34
    ));
    vec3 crossDir = normalize(cross(laneDir, vec3(0.0, 0.0, 1.0)));
    vec3 normalFlow = normalize(a_normal + vec3(0.0, 0.8, 0.0));
    float curl = age * (3.1 + grain * 1.2) + strandPhase + a_position.y * 2.4;
    float wave = sin(curl) * 0.5 + sin(curl * 0.63 + strandId) * 0.5;
    float thread = sin((a_position.y + age * 0.85) * 8.4 + strandId * 1.9 + a_position.x * 1.35);
    vec3 ribbon = normalize(
      laneDir * (1.24 + 0.56 * wave) +
      crossDir * (0.32 * thread) +
      normalFlow * (0.28 + strandGate * 0.16)
    );
    vec3 filament = vec3(
      sin(age * 2.65 + a_seed * 1.9 + a_position.y * 2.1),
      sin(age * 1.38 + a_seed * 1.3),
      cos(age * 2.3 + a_seed * 2.2 + a_position.x * 1.8)
    ) * (0.045 + strandGate * 0.085);
    float peel = smoothstep(0.0, 0.36, scatter);
    float longTrail = 0.48 + grain * 0.58 + topOrder * 1.35;
    float sparsePull = 0.01 + filamentGate * 1.36;
    vec3 flowOffset = (ribbon * longTrail * sparsePull + filament) * mist;
    flowOffset += normalFlow * peel * mist * filamentGate * 0.38;
    float flowLimit = 0.82 + topOrder * 0.82 + strandGate * 0.28;
    float flowLength = length(flowOffset);
    if (flowLength > flowLimit) {
      flowOffset = normalize(flowOffset) * flowLimit;
    }
    vec3 dissolvedPosition = a_position + flowOffset;
    p = mix(dissolvedPosition, a_position, returnFlow);
    p += vec3(
      sin(u_time * 0.9 + a_seed + p.y * 2.1) * 0.0008,
      cos(u_time * 0.8 + a_seed) * 0.0006,
      sin(u_time * 0.85 + a_seed + p.x * 1.9) * 0.0008
    );

    float sy = sin(u_rotationY);
    float cy = cos(u_rotationY);
    float sx = sin(u_rotationX);
    float cx = cos(u_rotationX);

    vec3 yRot = vec3(
      p.x * cy - p.z * sy,
      p.y,
      p.x * sy + p.z * cy
    );
    vec3 nYRot = vec3(
      a_normal.x * cy - a_normal.z * sy,
      a_normal.y,
      a_normal.x * sy + a_normal.z * cy
    );
    vec3 xRot = vec3(
      yRot.x,
      yRot.y * cx - yRot.z * sx,
      yRot.y * sx + yRot.z * cx
    );
    vec3 nRot = normalize(vec3(
      nYRot.x,
      nYRot.y * cx - nYRot.z * sx,
      nYRot.y * sx + nYRot.z * cx
    ));

    float depth = 7.0 + xRot.z;
    float perspective = u_zoom / max(2.4, depth);
    float clipZ = clamp(((depth - 3.8) / 7.2) * 2.0 - 1.0, -0.95, 0.95);
    gl_Position = vec4(xRot.x * perspective * u_aspect, xRot.y * perspective, clipZ, 1.0);
    gl_PointSize = max(0.38, (u_pointSize * (1.0 + mist * 0.32)) / max(2.2, depth));

    vec3 keyLight = normalize(vec3(-0.42, 0.68, 0.78));
    vec3 fillLight = normalize(vec3(0.5, 0.25, 0.82));
    float diffuse = max(dot(nRot, keyLight), 0.0);
    float fill = max(dot(nRot, fillLight), 0.0);
    float rim = pow(1.0 - max(dot(nRot, vec3(0.0, 0.0, 1.0)), 0.0), 2.0);
    float shade = 0.98 + diffuse * 0.3 + fill * 0.13 + rim * 0.08;
    float airy = 1.0 + mist * (0.08 + fract(sin(a_seed * 5.31) * 43758.5453) * 0.1);
    v_color = clamp(a_color * shade * airy, 0.0, 1.0);
    v_alpha = 1.0;
    float dissolveLines = 1.0 - smoothstep(1.65, 2.45, age);
    float gatherLines = smoothstep(3.18 + returnDelay, 3.78 + returnDelay, age);
    float filamentWindow = clamp(max(dissolveLines, gatherLines), 0.0, 1.0);
    float hiddenHold = smoothstep(2.65, 3.0, age) * (1.0 - smoothstep(3.15 + returnDelay, 3.58 + returnDelay, age));
    float transitionKeep = max(filamentGate * filamentWindow, 0.001);
    float returnReveal = smoothstep(0.86, 1.0, returnFlow);
    v_keep = mix(1.0, transitionKeep, mist * (1.0 - returnReveal));
    v_keep *= 1.0 - hiddenHold * (1.0 - returnReveal) * 0.995;
    v_flow = mist * filamentWindow * filamentGate * (0.45 + strandGate * 0.55);
  }
`;

const fragmentShaderSource = `
  precision mediump float;

  varying vec3 v_color;
  varying float v_alpha;
  varying float v_keep;
  varying float v_flow;

  void main() {
    if (v_keep < 0.48) discard;
    vec2 uv = gl_PointCoord - vec2(0.5);
    float dist = length(uv);
    if (dist > 0.5) discard;
    float dotSoft = smoothstep(0.5, 0.12, dist);
    vec2 streakUv = vec2(uv.x * 6.8 + uv.y * 1.15, uv.y * 0.42);
    float streakDist = length(streakUv);
    float streakSoft = smoothstep(0.48, 0.08, streakDist);
    float soft = mix(dotSoft, streakSoft, smoothstep(0.02, 0.35, v_flow));
    vec3 edgeColor = v_color * mix(0.34, 0.78, smoothstep(0.0, 0.45, v_flow));
    gl_FragColor = vec4(mix(edgeColor, v_color, soft), 1.0);
  }
`;

initWebGL();
load();
animate();
