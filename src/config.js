export const MODEL_OPTIONS = [
  {
    id: "datong",
    label: "佛像 1",
    url: new URL("../assets/buddha-statue-datong.glb", import.meta.url),
  },
  {
    id: "model2",
    label: "模型 2",
    url: new URL("../assets/model2.glb", import.meta.url),
  },
  {
    id: "model3",
    label: "模型 3",
    url: new URL("../assets/3d model3.glb", import.meta.url),
  },
];
export const MAX_PARTICLES = 1800000;
export const INITIAL_ROTATION_X = -0.08;
export const INITIAL_ZOOM = 1.62;
export const MAX_DPR = 2;

export const DEFAULT_MOTION_PARAMS = {
  pointSize: 7.2,
  autoRotateSpeed: 0.0053,
  verticalDelay: 1.5,
  scatterDuration: 0.45,
  returnStart: 3.85,
  returnDuration: 0.95,
  flowStrength: 2.4,
  flowLimit: 0.55,
  filamentDensity: 4,
  motionNoise: 2.05,
};
