import {
  INITIAL_ROTATION_X,
  INITIAL_ZOOM,
  BUDDHA_INFO,
  DEFAULT_MOTION_PARAMS,
  MAX_DPR,
  MAX_PARTICLES,
  MODEL_OPTIONS,
} from "./config.js?v=switch-return-only-1";
import { createControls } from "./controls.js";
import { createDebugPanel } from "./debug-panel.js?v=switch-return-only-1";
import { parseGlb } from "./gl/glb-loader.js";
import {
  createProgram,
  getAttributeLocations,
  getUniformLocations,
  uploadAttribute,
} from "./gl/program.js";
import { buildPointCloud } from "./particles/point-cloud.js";
import { fragmentShaderSource, vertexShaderSource } from "./shaders.js?v=switch-return-only-1";

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
    this.attributes = getAttributeLocations(context, this.program, [
      "a_position",
      "a_color",
      "a_normal",
      "a_seed",
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
    this.buffers = {
      position: context.createBuffer(),
      color: context.createBuffer(),
      normal: context.createBuffer(),
      seed: context.createBuffer(),
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
      if (loadVersion !== this.loadVersion) return;

      this.particleCount = cloud.count;
      this.uploadPointCloud(cloud);

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
    this.updateUniforms();
    gl.drawArrays(gl.POINTS, 0, this.particleCount);
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
