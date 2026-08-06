import {
  INITIAL_ROTATION_X,
  INITIAL_ZOOM,
  MAX_DPR,
  MAX_PARTICLES,
  MODEL_URL,
  POINT_SIZE,
} from "./config.js";
import { createControls } from "./controls.js";
import { parseGlb } from "./gl/glb-loader.js";
import {
  createProgram,
  getAttributeLocations,
  getUniformLocations,
  uploadAttribute,
} from "./gl/program.js";
import { buildPointCloud } from "./particles/point-cloud.js";
import { fragmentShaderSource, vertexShaderSource } from "./shaders.js";

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

class ParticleApp {
  constructor(canvasElement, context) {
    this.canvas = canvasElement;
    this.gl = context;
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.particleCount = 0;
    this.loaded = false;
    this.startTime = performance.now();
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
      "u_pointSize",
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
    this.initWebGL();
    this.resize();
    window.addEventListener("resize", this.resize);
    createControls(this.canvas, this.state, () => this.elapsedTime);
    this.load();
    this.animate();
  }

  get elapsedTime() {
    return (performance.now() - this.startTime) / 1000;
  }

  async load() {
    try {
      window.__particleDebug.state = "fetching-model";
      const response = await fetch(MODEL_URL);
      if (!response.ok) throw new Error(`模型加载失败 ${response.status}`);

      const buffer = await response.arrayBuffer();
      window.__particleDebug.state = "parsing-model";
      const meshes = await parseGlb(buffer);

      window.__particleDebug.state = "building-million-point-cloud";
      const cloud = buildPointCloud(meshes, MAX_PARTICLES);
      this.particleCount = cloud.count;
      this.uploadPointCloud(cloud);

      this.loaded = true;
      this.status.remove();
      window.__particleDebug = { state: "ready", particleCount: this.particleCount };
    } catch (error) {
      console.error(error);
      this.status.textContent = "模型加载失败";
      window.__particleDebug = { state: "error", message: error.message };
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
    if (!state.dragging) state.targetRotationY += 0.0014;
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
    gl.uniform1f(uniforms.u_pointSize, POINT_SIZE * this.dpr);
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

new ParticleApp(canvas, gl).start();

