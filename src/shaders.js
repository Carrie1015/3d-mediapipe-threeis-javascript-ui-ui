export const vertexShaderSource = `
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
  uniform float u_verticalDelay;
  uniform float u_scatterDuration;
  uniform float u_returnStart;
  uniform float u_returnDuration;
  uniform float u_flowStrength;
  uniform float u_flowLimit;
  uniform float u_filamentDensity;
  uniform float u_motionNoise;

  varying vec3 v_color;
  varying float v_keep;
  varying float v_flow;

  void main() {
    vec3 p = a_position;
    float topOrder = smoothstep(-1.9, 2.0, a_position.y);
    float randomA = fract(sin(a_seed * 13.71) * 43758.5453);
    float randomB = fract(sin(a_seed * 6.43) * 24634.6345);
    float verticalDelay = (1.0 - topOrder) * u_verticalDelay;
    float delay = verticalDelay + randomA * 0.12;
    float age = max(0.0, u_burstAge - delay);
    float scatter = smoothstep(0.0, u_scatterDuration, age);
    float returnDelay = topOrder * 0.74 + randomB * 0.42;
    float returnFlow = smoothstep(u_returnStart + returnDelay, u_returnStart + u_returnDuration + returnDelay, age);
    float mist = max(0.0, scatter * (1.0 - returnFlow));

    float side = sin(a_seed * 2.41);
    float grain = fract(sin(a_seed * 9.17) * 43758.5453);
    float strandId = floor(grain * 11.0);
    float strandPhase = strandId * 0.73 + a_seed * 0.19;
    float heightBand = fract((a_position.y + 2.2) * 2.8 + strandId * 0.17);
    float strandCore = abs(sin(strandId * 1.37 + a_position.y * 5.2 + a_position.x * 2.7 + a_position.z * 1.8));
    float layerGate = smoothstep(0.72, 0.98, heightBand) * (1.0 - smoothstep(0.98, 1.0, heightBand));
    float strandThreshold = clamp(1.0 - u_filamentDensity * 0.045, 0.78, 0.995);
    float dustThreshold = clamp(1.0 - u_filamentDensity * 0.0025, 0.95, 0.9998);
    float strandGate = max(smoothstep(strandThreshold, 0.996, strandCore), layerGate * 0.88);
    float filamentGate = max(strandGate, smoothstep(dustThreshold, 1.0, randomA));
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
    vec3 flowOffset = (ribbon * longTrail * sparsePull + filament) * mist * u_flowStrength;
    flowOffset += normalFlow * peel * mist * filamentGate * 0.38 * u_flowStrength;
    float flowLimit = (0.82 + topOrder * 0.82 + strandGate * 0.28) * u_flowLimit;
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
    ) * u_motionNoise;

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
    float dissolveLines = 1.0 - smoothstep(1.65, 2.45, age);
    float gatherLines = smoothstep(u_returnStart - 0.67 + returnDelay, u_returnStart - 0.07 + returnDelay, age);
    float filamentWindow = clamp(max(dissolveLines, gatherLines), 0.0, 1.0);
    float hiddenHold = smoothstep(u_returnStart - 1.2, u_returnStart - 0.85, age) * (1.0 - smoothstep(u_returnStart - 0.7 + returnDelay, u_returnStart - 0.27 + returnDelay, age));
    float transitionKeep = max(filamentGate * filamentWindow, 0.001);
    float returnReveal = smoothstep(0.86, 1.0, returnFlow);
    v_keep = mix(1.0, transitionKeep, mist * (1.0 - returnReveal));
    v_keep *= 1.0 - hiddenHold * (1.0 - returnReveal) * 0.995;
    v_flow = mist * filamentWindow * filamentGate * (0.45 + strandGate * 0.55);
  }
`;

export const fragmentShaderSource = `
  precision mediump float;

  varying vec3 v_color;
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
