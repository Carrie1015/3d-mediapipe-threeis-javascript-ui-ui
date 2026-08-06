export function readVec3(values, offset) {
  return {
    x: values[offset],
    y: values[offset + 1],
    z: values[offset + 2],
  };
}

export function normalizeVec3(vector) {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}

export function smoothstep(edge0, edge1, value) {
  const x = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return x * x * (3 - 2 * x);
}

export function fract(value) {
  return value - Math.floor(value);
}

export function hash01(value) {
  const x = Math.sin(value * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

