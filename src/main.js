import {
  INITIAL_ROTATION_X,
  INITIAL_ZOOM,
  BUDDHA_INFO,
  DEFAULT_MOTION_PARAMS,
  MAX_DPR,
  MAX_PARTICLES,
  MODEL_OPTIONS,
} from "./config.js?v=solid-original-preview-3";
import { createControls } from "./controls.js";
import { createDebugPanel } from "./debug-panel.js?v=solid-original-preview-3";
import { parseGlb } from "./gl/glb-loader.js";
import {
  bindAttribute,
  createProgram,
  getAttributeLocations,
  getUniformLocations,
  uploadAttribute,
} from "./gl/program.js";
import { readVec3 } from "./math.js";
import { buildPointCloud, sampleTextureColor } from "./particles/point-cloud.js";
import { fragmentShaderSource, vertexShaderSource } from "./shaders.js?v=solid-original-preview-3";

const solidVertexShaderSource = `
  attribute vec3 a_position;
  attribute vec3 a_color;
  attribute vec3 a_normal;

  uniform float u_rotationX;
  uniform float u_rotationY;
  uniform float u_aspect;
  uniform float u_zoom;

  varying vec3 v_color;
  varying vec3 v_normal;

  void main() {
    float sy = sin(u_rotationY);
    float cy = cos(u_rotationY);
    float sx = sin(u_rotationX);
    float cx = cos(u_rotationX);

    vec3 yRot = vec3(
      a_position.x * cy - a_position.z * sy,
      a_position.y,
      a_position.x * sy + a_position.z * cy
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
    v_color = a_color;
    v_normal = nRot;
  }
`;

const solidFragmentShaderSource = `
  precision mediump float;

  varying vec3 v_color;
  varying vec3 v_normal;

  void main() {
    vec3 keyLight = normalize(vec3(-0.36, 0.72, 0.72));
    vec3 fillLight = normalize(vec3(0.58, 0.18, 0.76));
    float diffuse = max(dot(normalize(v_normal), keyLight), 0.0);
    float fill = max(dot(normalize(v_normal), fillLight), 0.0);
    float rim = pow(1.0 - max(dot(normalize(v_normal), vec3(0.0, 0.0, 1.0)), 0.0), 2.3);
    vec3 lit = v_color * (0.72 + diffuse * 0.42 + fill * 0.18) + vec3(1.0, 0.72, 0.32) * rim * 0.12;
    gl_FragColor = vec4(clamp(lit, 0.0, 1.0), 1.0);
  }
`;

const MAX_SOLID_PREVIEW_VERTICES = 6500000;

const canvas = document.getElementById("stage");
const infoPanel = document.getElementById("buddhaInfo");
const gl = canvas.getContext("webgl", {
  alpha: false,
  antialias: false,
  depth: true,
  powerPreference: "high-performance",
});

if (!gl) {
  throw new Error("当前浏览器不支持 WebGL");
}

class ParticleApp {
  constructor(canvasElement, context) {
    this.canvas = canvasElement;
    this.gl = context;
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.particleCount = 0;
    this.solidVertexCount = 0;
    this.loaded = false;
    this.loadVersion = 0;
    this.activeModelId = MODEL_OPTIONS[0].id;
    this.startTime = performance.now();
    this.motionParams = { ...DEFAULT_MOTION_PARAMS };
    this.state = {
      rotationX: INITIAL_ROTATION_X,
      rotationY: 0,
      targetRotationX: INITIAL_ROTATION_X,
      targetRotationY: 0,
      zoom: INITIAL_ZOOM,
      targetZoom: INITIAL_ZOOM,
      burstStartTime: -10,
      dragging: false,
      lastX: 0,
      lastY: 0,
    };

    this.status = createStatus();
    this.program = createProgram(context, vertexShaderSource, fragmentShaderSource);
    this.solidProgram = createProgram(context, solidVertexShaderSource, solidFragmentShaderSource);
    this.attributes = getAttributeLocations(context, this.program, [
      "a_position",
      "a_color",
      "a_normal",
      "a_seed",
    ]);
    this.solidAttributes = getAttributeLocations(context, this.solidProgram, [
      "a_position",
      "a_color",
      "a_normal",
    ]);
    this.uniforms = getUniformLocations(context, this.program, [
      "u_time",
      "u_burstAge",
      "u_rotationX",
      "u_rotationY",
      "u_aspect",
      "u_zoom",
      "u_layoutOffsetX",
      "u_layoutOffsetY",
      "u_pointSize",
      "u_verticalDelay",
      "u_scatterDuration",
      "u_returnStart",
      "u_returnDuration",
      "u_flowStrength",
      "u_flowLimit",
      "u_filamentDensity",
      "u_motionNoise",
    ]);
    this.solidUniforms = getUniformLocations(context, this.solidProgram, [
      "u_rotationX",
      "u_rotationY",
      "u_aspect",
      "u_zoom",
    ]);
    this.buffers = {
      position: context.createBuffer(),
      color: context.createBuffer(),
      normal: context.createBuffer(),
      seed: context.createBuffer(),
    };
    this.solidBuffers = {
      position: context.createBuffer(),
      color: context.createBuffer(),
      normal: context.createBuffer(),
    };

    this.resize = this.resize.bind(this);
    this.animate = this.animate.bind(this);
  }

  start() {
    window.__particleDebug = { state: "boot" };
    renderBuddhaInfo(this.activeModelId);
    this.initWebGL();
    this.resize();
    window.addEventListener("resize", this.resize);
    createControls(this.canvas, this.state, () => this.elapsedTime);
    this.motionParams = createDebugPanel(DEFAULT_MOTION_PARAMS, MODEL_OPTIONS, {
      onChange: (params) => {
        this.motionParams = { ...params };
      },
      onBurst: () => {
        this.state.burstStartTime = this.elapsedTime;
      },
      onSelect: (model) => {
        renderBuddhaInfo(model.id);
      },
      onModelChange: (model) => {
        this.loadModel(model, true);
      },
    });
    this.loadModel(MODEL_OPTIONS[0], false);
    this.animate();
  }

  get elapsedTime() {
    return (performance.now() - this.startTime) / 1000;
  }

  async loadModel(model, triggerBurst) {
    if (!model) return;

    const loadVersion = this.loadVersion + 1;
    this.loadVersion = loadVersion;
    this.activeModelId = model.id;
    renderBuddhaInfo(model.id);
    this.showStatus(`加载${model.label}中`);

    try {
      window.__particleDebug.state = "fetching-model";
      const response = await fetch(model.url);
      if (!response.ok) throw new Error(`模型加载失败 ${response.status}`);

      const buffer = await response.arrayBuffer();
      if (loadVersion !== this.loadVersion) return;

      window.__particleDebug.state = "parsing-model";
      const meshes = await parseGlb(buffer);
      if (loadVersion !== this.loadVersion) return;

      window.__particleDebug.state = "building-million-point-cloud";
      const cloud = buildPointCloud(meshes, MAX_PARTICLES);
      const solidPreview = buildSolidPreview(meshes, MAX_SOLID_PREVIEW_VERTICES);
      if (loadVersion !== this.loadVersion) return;

      this.particleCount = cloud.count;
      this.solidVertexCount = solidPreview.count;
      this.uploadPointCloud(cloud);
      this.uploadSolidPreview(solidPreview);

      this.loaded = true;
      this.hideStatus();
      this.state.burstStartTime = triggerBurst
        ? this.elapsedTime - (this.motionParams.returnStart + 0.22)
        : this.elapsedTime - 20;
      window.__particleDebug = {
        state: "ready",
        modelId: model.id,
        particleCount: this.particleCount,
      };
    } catch (error) {
      console.error(error);
      this.status.textContent = "模型加载失败";
      window.__particleDebug = { state: "error", modelId: model.id, message: error.message };
    }
  }

  initWebGL() {
    const { gl } = this;
    gl.useProgram(this.program);
    gl.clearColor(0, 0, 0, 1);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  uploadPointCloud(cloud) {
    const { gl, attributes, buffers } = this;
    uploadAttribute(gl, buffers.position, cloud.positions, attributes.a_position, 3);
    uploadAttribute(gl, buffers.color, cloud.colors, attributes.a_color, 3);
    uploadAttribute(gl, buffers.normal, cloud.normals, attributes.a_normal, 3);
    uploadAttribute(gl, buffers.seed, cloud.seeds, attributes.a_seed, 1);
  }

  uploadSolidPreview(preview) {
    const { gl, solidAttributes, solidBuffers } = this;
    uploadAttribute(gl, solidBuffers.position, preview.positions, solidAttributes.a_position, 3);
    uploadAttribute(gl, solidBuffers.color, preview.colors, solidAttributes.a_color, 3);
    uploadAttribute(gl, solidBuffers.normal, preview.normals, solidAttributes.a_normal, 3);
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  animate() {
    requestAnimationFrame(this.animate);

    const { gl, state } = this;
    if (!state.dragging) state.targetRotationY += this.motionParams.autoRotateSpeed;
    state.rotationX += (state.targetRotationX - state.rotationX) * 0.1;
    state.rotationY += (state.targetRotationY - state.rotationY) * 0.1;
    state.zoom += (state.targetZoom - state.zoom) * 0.12;

    gl.clear(gl.COLOR_BUFFER_BIT);
    if (!this.loaded) return;

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);
    this.bindPointCloudAttributes();
    this.updateUniforms();
    gl.drawArrays(gl.POINTS, 0, this.particleCount);
    this.drawSolidPreview();
  }

  bindPointCloudAttributes() {
    const { gl, attributes, buffers } = this;
    bindAttribute(gl, buffers.position, attributes.a_position, 3);
    bindAttribute(gl, buffers.color, attributes.a_color, 3);
    bindAttribute(gl, buffers.normal, attributes.a_normal, 3);
    bindAttribute(gl, buffers.seed, attributes.a_seed, 1);
  }

  drawSolidPreview() {
    if (!this.solidVertexCount) return;

    const { gl, state, solidUniforms } = this;
    const size = Math.round(Math.min(this.width, this.height) * this.dpr * 0.28);
    const padding = Math.round(34 * this.dpr);
    const x = this.canvas.width - size - padding;
    const y = this.canvas.height - size - padding;

    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(x, y, size, size);
    gl.viewport(x, y, size, size);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.BLEND);
    gl.useProgram(this.solidProgram);
    this.bindSolidAttributes();
    gl.uniform1f(solidUniforms.u_rotationX, state.rotationX * 0.72 - 0.02);
    gl.uniform1f(solidUniforms.u_rotationY, state.rotationY);
    gl.uniform1f(solidUniforms.u_aspect, 1);
    gl.uniform1f(solidUniforms.u_zoom, 2.18);
    gl.drawArrays(gl.TRIANGLES, 0, this.solidVertexCount);
    gl.disable(gl.SCISSOR_TEST);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  bindSolidAttributes() {
    const { gl, solidAttributes, solidBuffers } = this;
    bindAttribute(gl, solidBuffers.position, solidAttributes.a_position, 3);
    bindAttribute(gl, solidBuffers.color, solidAttributes.a_color, 3);
    bindAttribute(gl, solidBuffers.normal, solidAttributes.a_normal, 3);
  }

  updateUniforms() {
    const { gl, state, uniforms } = this;
    const time = this.elapsedTime;

    gl.uniform1f(uniforms.u_time, time);
    gl.uniform1f(uniforms.u_burstAge, time - state.burstStartTime);
    gl.uniform1f(uniforms.u_rotationX, state.rotationX);
    gl.uniform1f(uniforms.u_rotationY, state.rotationY);
    gl.uniform1f(uniforms.u_aspect, this.height / Math.max(1, this.width));
    gl.uniform1f(uniforms.u_zoom, state.zoom);
    gl.uniform1f(uniforms.u_layoutOffsetX, this.width > 860 ? 0.28 : 0.0);
    gl.uniform1f(uniforms.u_layoutOffsetY, this.width > 860 ? 0.07 : 0.0);
    gl.uniform1f(uniforms.u_pointSize, this.motionParams.pointSize * this.dpr);
    gl.uniform1f(uniforms.u_verticalDelay, this.motionParams.verticalDelay);
    gl.uniform1f(uniforms.u_scatterDuration, this.motionParams.scatterDuration);
    gl.uniform1f(uniforms.u_returnStart, this.motionParams.returnStart);
    gl.uniform1f(uniforms.u_returnDuration, this.motionParams.returnDuration);
    gl.uniform1f(uniforms.u_flowStrength, this.motionParams.flowStrength);
    gl.uniform1f(uniforms.u_flowLimit, this.motionParams.flowLimit);
    gl.uniform1f(uniforms.u_filamentDensity, this.motionParams.filamentDensity);
    gl.uniform1f(uniforms.u_motionNoise, this.motionParams.motionNoise);
  }

  showStatus(message) {
    this.status.textContent = message;
    if (!this.status.isConnected) document.body.appendChild(this.status);
  }

  hideStatus() {
    if (this.status.isConnected) this.status.remove();
  }
}

function createStatus() {
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
  return status;
}

function buildSolidPreview(meshes, maxVertices) {
  const totalTriangleVertices = meshes.reduce((sum, mesh) => {
    const sourceCount = mesh.indices?.count || mesh.positions.count;
    return sum + Math.floor(sourceCount / 3) * 3;
  }, 0);
  const count = Math.min(totalTriangleVertices, maxVertices);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const meshColors = meshes.map((mesh) => getMeshAverageColor(mesh));
  const step = totalTriangleVertices > count
    ? Math.max(1, Math.ceil(totalTriangleVertices / Math.max(3, count)))
    : 1;
  let outputVertex = 0;

  for (let meshIndex = 0; meshIndex < meshes.length; meshIndex += 1) {
    const mesh = meshes[meshIndex];
    const sourceCount = mesh.indices?.count || mesh.positions.count;
    const triangleCount = Math.floor(sourceCount / 3);

    for (let triangle = 0; triangle < triangleCount && outputVertex + 3 <= count; triangle += step) {
      for (let corner = 0; corner < 3; corner += 1) {
        const sourceIndex = triangle * 3 + corner;
        const vertexIndex = mesh.indices
          ? Math.max(0, Math.min(mesh.positions.count - 1, Math.floor(mesh.indices.values[sourceIndex])))
          : sourceIndex;
        const positionOffset = vertexIndex * mesh.positions.componentCount;
        const point = readVec3(mesh.positions.values, positionOffset);
        const normal = readPreviewNormal(mesh, vertexIndex);
        const sampledColor = sampleTextureColor(mesh, vertexIndex, point);
        const averageColor = meshColors[meshIndex];
        const out = outputVertex * 3;

        positions[out] = point.x;
        positions[out + 1] = point.y;
        positions[out + 2] = point.z;
        colors[out] = Math.min(1, ((averageColor.r * 0.62 + sampledColor.r * 0.38) / 255) * 1.08);
        colors[out + 1] = Math.min(1, ((averageColor.g * 0.62 + sampledColor.g * 0.38) / 255) * 1.08);
        colors[out + 2] = Math.min(1, ((averageColor.b * 0.62 + sampledColor.b * 0.38) / 255) * 1.08);
        normals[out] = normal.x;
        normals[out + 1] = normal.y;
        normals[out + 2] = normal.z;
        outputVertex += 1;
      }
    }
  }

  return {
    positions: positions.subarray(0, outputVertex * 3),
    colors: colors.subarray(0, outputVertex * 3),
    normals: normals.subarray(0, outputVertex * 3),
    count: outputVertex,
  };
}

function getMeshAverageColor(mesh) {
  const sampleCount = Math.min(mesh.positions.count, 900);
  const stride = Math.max(1, Math.floor(mesh.positions.count / Math.max(1, sampleCount)));
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let vertexIndex = 0; vertexIndex < mesh.positions.count; vertexIndex += stride) {
    const positionOffset = vertexIndex * mesh.positions.componentCount;
    const point = readVec3(mesh.positions.values, positionOffset);
    const color = sampleTextureColor(mesh, vertexIndex, point);
    r += color.r;
    g += color.g;
    b += color.b;
    count += 1;
  }

  return count
    ? { r: r / count, g: g / count, b: b / count }
    : { r: 160, g: 126, b: 82 };
}

function readPreviewNormal(mesh, vertexIndex) {
  if (!mesh.normals) return { x: 0, y: 0, z: 1 };
  const offset = vertexIndex * mesh.normals.componentCount;
  return readVec3(mesh.normals.values, offset);
}

function renderBuddhaInfo(modelId) {
  if (!infoPanel) return;
  const info = BUDDHA_INFO[modelId] || BUDDHA_INFO[MODEL_OPTIONS[0].id];
  infoPanel.innerHTML = `
    <p class="info-panel__roman">${info.roman}</p>
    <h1>${info.title}</h1>
    <p class="info-panel__alias">${info.alias}</p>
    <div class="info-panel__meta">
      <span>${info.direction}</span>
      <span>${info.wisdom}</span>
    </div>
    <p class="info-panel__summary">${info.summary}</p>
    <ul>
      ${info.points.map((point) => `<li>${point}</li>`).join("")}
    </ul>
  `;
}

new ParticleApp(canvas, gl).start();
