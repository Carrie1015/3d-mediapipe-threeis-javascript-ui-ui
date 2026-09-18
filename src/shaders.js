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
  uniform float u_layoutOffsetX;
  uniform float u_layoutOffsetY;
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
  varying float v_alpha;
  varying float v_sheet;

  void main() {
    vec3 p = a_position;
    float topOrder = smoothstep(-1.9, 2.0, a_position.y);
    float randomA = fract(sin(a_seed * 13.71) * 43758.5453);
    float randomB = fract(sin(a_seed * 6.43) * 24634.6345);
    float verticalDelay = pow(1.0 - topOrder, 1.18) * u_verticalDelay;
    float delay = verticalDelay + randomA * 0.22;
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
    float strandThreshold = clamp(1.0 - u_filamentDensity * 0.018, 0.9, 0.996);
    float dustThreshold = clamp(1.0 - u_filamentDensity * 0.0012, 0.986, 0.9998);
    float strandGate = smoothstep(strandThreshold, 0.999, strandCore) * (0.2 + layerGate * 0.8);
    float dustGate = smoothstep(dustThreshold, 1.0, randomA);
    float filamentGate = max(strandGate, dustGate * 0.46);
    float plumeId = floor(grain * 6.0);
    float plumePhase = plumeId * 0.91 + strandPhase;
    float plumeSide = sin(plumeId * 1.73) * 0.34;
    vec3 plumeDir = normalize(vec3(0.72 + plumeSide + side * 0.14, 0.82 + topOrder * 0.34, sin(plumePhase) * 0.28));
    vec3 laneDir = normalize(vec3(
      0.22 + sin(strandId * 1.91 + side * 0.35) * 0.24,
      1.0 + topOrder * 0.32,
      cos(strandId * 1.37 + grain * 2.0) * 0.22
    ));
    vec3 crossDir = normalize(cross(laneDir, vec3(0.0, 0.0, 1.0)));
    vec3 normalFlow = normalize(a_normal + vec3(0.0, 0.8, 0.0));
    float curl = age * (2.15 + grain * 0.9) + strandPhase + a_position.y * 2.1;
    float wave = sin(curl) * 0.55 + sin(curl * 0.54 + strandId) * 0.45;
    float sheetWave = sin(a_position.y * 4.4 + plumeId * 1.7 + age * 0.68 + a_position.x * 0.74);
    float wideWave = sin(a_position.x * 1.1 + a_position.z * 1.45 + plumeId * 2.1 + age * 0.42);
    float thread = sin((a_position.y + age * 0.72) * 7.4 + strandId * 1.9 + a_position.x * 1.18);
    vec3 grainDrift = vec3(
      sin(age * 2.65 + a_seed * 1.9 + a_position.y * 2.1),
      sin(age * 1.38 + a_seed * 1.3),
      cos(age * 2.3 + a_seed * 2.2 + a_position.x * 1.8)
    ) * (0.045 + strandGate * 0.075);
    float peel = smoothstep(0.0, 0.36, scatter);
    float surfaceNoise = smoothstep(0.18, 0.96, abs(thread));
    float grainGate = max(strandGate * 0.62, surfaceNoise * 0.48);
    float progressPush = smoothstep(0.0, 0.85, scatter) * (1.0 - returnFlow);
    float batchOrder = smoothstep(0.05, 0.95, randomB);
    float surfaceBand = smoothstep(0.0, 1.0, topOrder + randomA * 0.22);
    float granularProgress = clamp(progressPush * (0.55 + surfaceBand * 0.45), 0.0, 1.0);
    float peelFront = 1.0 - smoothstep(1.05, 2.35, age);
    float fallingBoundary = smoothstep(0.0, 0.45, age) * peelFront;
    float sheetGate = smoothstep(0.94, 0.999, abs(sheetWave)) * (0.06 + strandGate * 0.94);
    float veilGate = smoothstep(0.94, 0.9995, abs(wideWave)) * sheetGate;
    float hollowGate = smoothstep(0.68, 0.985, abs(sin(a_position.y * 2.1 + plumeId + a_position.x * 1.3)));
    float inkPath = sin(a_position.y * 3.25 + plumePhase + age * 0.32) * 0.52 + sin(a_position.y * 7.4 + plumePhase * 1.7) * 0.18;
    float inkX = inkPath + plumeSide * 0.48 + topOrder * 0.35;
    float inkZ = sin(a_position.y * 2.7 + plumePhase * 1.3 + age * 0.22) * 0.38 + cos(a_position.y * 5.2 + plumePhase) * 0.12;
    float lineDistance = length(vec2(a_position.x - inkX, a_position.z - inkZ));
    float streamSpine = smoothstep(0.5, 0.026, lineDistance);
    float streamRibbon = smoothstep(0.98, 0.16, lineDistance) * smoothstep(0.42, 0.92, abs(sin(a_position.y * 9.5 + plumeId * 2.1 + age * 0.36)));
    float inkCluster = smoothstep(0.68, 1.0, abs(sin(a_position.y * 5.8 + plumePhase * 2.0 + a_seed * 0.7))) * smoothstep(0.72, 0.035, lineDistance);
    float looseSpecks = smoothstep(0.992, 1.0, randomA) * smoothstep(0.95, 0.12, lineDistance);
    float streamGate = max(max(streamSpine, streamRibbon * 0.82), max(inkCluster * 1.12, looseSpecks * 0.55)) * hollowGate;
    float nearLineDust = dustGate * smoothstep(1.08, 0.16, lineDistance);
    float fineMistGate = max(streamGate, nearLineDust * 0.16);
    vec3 cascadeDir = normalize(vec3(0.62 + side * 0.2, 0.9 + topOrder * 0.36, cos(curl) * 0.2));
    vec3 plumeCurl = normalize(
      plumeDir * (1.36 + wave * 0.34) +
      cascadeDir * (0.52 + fallingBoundary * 0.34) +
      crossDir * (sheetWave * 0.36 + wideWave * 0.18 + sin(age * 0.9 + a_position.y * 1.8 + plumePhase) * 0.42) +
      normalFlow * (0.08 + streamGate * 0.05) +
      vec3(side * 0.08, 0.34 + topOrder * 0.5, cos(curl) * 0.12)
    );
    vec3 ribbonDir = normalize(mix(laneDir, plumeCurl, 0.86));
    vec3 surfaceLift = normalFlow * (0.1 + grain * 0.08 + topOrder * 0.04);
    vec3 upwardDust = vec3(0.18 + side * 0.04, 0.2 + topOrder * 0.28, cos(curl) * 0.06);
    float plumeReach = 1.16 + streamGate * 1.25 + inkCluster * 0.32;
    float sheetLength = plumeReach + grain * 0.7 + topOrder * 1.2 + strandGate * 0.26;
    vec3 flowOffset = (
      ribbonDir * sheetLength * fineMistGate +
      cascadeDir * fallingBoundary * streamGate * (0.22 + topOrder * 0.4) +
      plumeDir * streamGate * (0.86 + topOrder * 0.88) +
      crossDir * streamGate * (sheetWave * 0.22 + wideWave * 0.08) +
      surfaceLift * grainGate * streamGate * 0.24 +
      upwardDust * fineMistGate * 0.5 +
      grainDrift * fineMistGate * 0.22
    ) * mist * u_flowStrength;
    flowOffset += normalFlow * peel * mist * streamGate * 0.04 * u_flowStrength;
    float flowLimit = (0.86 + topOrder * 0.92 + streamGate * 0.84 + fallingBoundary * 0.18 + strandGate * 0.08) * u_flowLimit;
    float flowLength = length(flowOffset);
    if (flowLength > flowLimit) {
      flowOffset = normalize(flowOffset) * flowLimit;
    }
    float flowDistance = length(flowOffset) / max(0.001, flowLimit);
    float nearDissolveEdge = 1.0 - smoothstep(0.18, 0.82, flowDistance);
    float farDissolveFade = 1.0 - smoothstep(0.62, 1.0, flowDistance);
    float inkNode = smoothstep(0.86, 1.0, abs(sin(flowDistance * 12.0 + plumePhase + age * 1.1))) * smoothstep(0.06, 0.58, flowDistance);
    float densityFalloff = clamp(nearDissolveEdge * 1.05 + streamGate * farDissolveFade * 0.72 + inkNode * 0.5, 0.0, 1.0);
    vec3 dissolvedPosition = a_position + flowOffset;
    p = mix(dissolvedPosition, a_position, returnFlow);
    p += vec3(
      sin(u_time * 0.68 + a_seed + p.y * 1.6) * 0.0012,
      cos(u_time * 0.52 + a_seed) * 0.001,
      sin(u_time * 0.62 + a_seed + p.x * 1.45) * 0.0012
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
    gl_Position = vec4(xRot.x * perspective * u_aspect + u_layoutOffsetX, xRot.y * perspective + u_layoutOffsetY, clipZ, 1.0);
    gl_PointSize = max(0.36, (u_pointSize * (1.0 + mist * (0.2 + streamGate * 0.42 + inkCluster * 0.36))) / max(2.2, depth));

    vec3 keyLight = normalize(vec3(-0.42, 0.68, 0.78));
    vec3 fillLight = normalize(vec3(0.5, 0.25, 0.82));
    float diffuse = max(dot(nRot, keyLight), 0.0);
    float fill = max(dot(nRot, fillLight), 0.0);
    float rim = pow(1.0 - max(dot(nRot, vec3(0.0, 0.0, 1.0)), 0.0), 2.0);
    float shade = 1.16 + diffuse * 0.36 + fill * 0.18 + rim * 0.14;
    float airy = 1.04 + mist * (0.08 + streamGate * 0.1 + fract(sin(a_seed * 5.31) * 43758.5453) * 0.06);
    vec3 litColor = clamp(a_color * shade * airy, 0.0, 1.0);
    float luma = dot(litColor, vec3(0.299, 0.587, 0.114));
    v_color = clamp(mix(vec3(luma), litColor, 1.18), 0.0, 1.0);
    float localLife = 1.0 - smoothstep(1.05 + randomB * 0.22, 2.05 + randomB * 0.35, age);
    float lineHold = 1.0 - smoothstep(0.72 + randomB * 0.22, 1.56 + randomB * 0.32, age);
    float batchFade = 1.0 - smoothstep(1.0 + batchOrder * 0.5, 2.25 + batchOrder * 0.48, age);
    float dissolveLines = max(lineHold * 0.72, batchFade * 0.78) * localLife;
    float gatherLines = smoothstep(u_returnStart - 0.9 + returnDelay, u_returnStart - 0.2 + returnDelay, age);
    float filamentWindow = clamp(max(dissolveLines, gatherLines), 0.0, 1.0);
    float hiddenHold = smoothstep(1.85 + randomB * 0.35, 2.7 + randomB * 0.42, age) * (1.0 - smoothstep(u_returnStart - 0.72 + returnDelay, u_returnStart - 0.18 + returnDelay, age));
    float transitionKeep = max((streamGate * 1.36 + inkCluster * 0.82 + strandGate * 0.26 + dustGate * 0.14) * filamentWindow * hollowGate * densityFalloff, 0.001);
    float returnReveal = smoothstep(0.08, 1.0, returnFlow);
    float rebuildOrder = randomB * 0.64 + (1.0 - topOrder) * 0.22;
    float rebuildSkeleton = smoothstep(rebuildOrder * 0.72, min(1.0, rebuildOrder * 0.72 + 0.34), returnFlow);
    float rebuildSurface = smoothstep(rebuildOrder, min(1.0, rebuildOrder + 0.58), returnFlow);
    float rebuildReveal = max(rebuildSurface, rebuildSkeleton * (streamGate * 0.85 + inkCluster * 0.32));
    float fullDissolveAge = u_verticalDelay + u_scatterDuration + 2.0;
    float blackout = smoothstep(fullDissolveAge - 0.35, fullDissolveAge + 0.15, u_burstAge) * (1.0 - smoothstep(u_returnStart - 0.45, u_returnStart - 0.05, u_burstAge));
    float reconstructKeep = mix(transitionKeep, 1.0, rebuildReveal);
    v_keep = mix(1.0, reconstructKeep, mist * (1.0 - returnReveal) + returnFlow * (1.0 - rebuildReveal));
    v_keep *= 1.0 - hiddenHold * (1.0 - returnReveal) * 0.995;
    v_keep *= 1.0 - blackout;
    v_flow = mist * filamentWindow * localLife * (streamGate * 1.48 + inkCluster * 0.78 + looseSpecks * 0.24 + fallingBoundary * 0.14) * (0.35 + densityFalloff * 0.95);
    v_sheet = clamp(mist * filamentWindow * localLife * (streamGate * 1.0 + inkCluster * 0.38 + looseSpecks * 0.12 + fallingBoundary * 0.14) * (0.28 + densityFalloff), 0.0, 1.0);
    float dissolveAlpha = mix(1.0, 0.06 + batchFade * 0.58, granularProgress * (1.0 - returnReveal));
    float surfaceAlpha = mix(1.0, 0.34, mist * grainGate * (1.0 - returnReveal));
    float rebuildAlpha = smoothstep(0.0, 1.0, rebuildSurface) * 0.9 + rebuildSkeleton * (streamGate * 0.8 + inkCluster * 0.25);
    float distanceAlpha = mix(1.0, densityFalloff, mist * (1.0 - returnReveal));
    v_alpha = clamp(max(min(dissolveAlpha, surfaceAlpha) * mix(1.0, fineMistGate * localLife, mist) * distanceAlpha, rebuildAlpha) * (1.0 - blackout), 0.0, 1.0);
  }
`;

export const fragmentShaderSource = `
  precision mediump float;

  varying vec3 v_color;
  varying float v_keep;
  varying float v_flow;
  varying float v_alpha;
  varying float v_sheet;

  void main() {
    if (v_keep < 0.48 || v_alpha <= 0.001) discard;
    float alphaDither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    if (v_alpha < alphaDither) discard;
    vec2 uv = gl_PointCoord - vec2(0.5);
    float dist = length(uv);
    if (dist > 0.5) discard;
    float dotSoft = smoothstep(0.5, 0.1, dist);
    float strand = smoothstep(0.03, 0.72, max(v_flow, v_sheet));
    float bend = sin((uv.x + uv.y) * 5.2) * 0.035 * v_sheet;
    vec2 streakUv = vec2(uv.x * mix(2.8, 10.5, strand) + uv.y * mix(0.08, 0.72, v_sheet), uv.y * mix(0.86, 0.16, strand) + bend);
    float streakDist = length(streakUv);
    float streakSoft = smoothstep(0.46, 0.032, streakDist);
    float veil = smoothstep(0.32, 0.018, abs(uv.y + bend)) * smoothstep(0.5, 0.1, abs(uv.x));
    float halo = smoothstep(0.5, 0.26, dist) * strand * 0.08;
    float soft = mix(dotSoft, max(max(streakSoft, veil * 0.2), halo), strand);
    vec3 edgeColor = v_color * mix(0.48, 0.98, smoothstep(0.0, 0.5, max(v_flow, v_sheet)));
    vec3 glowColor = v_color * (1.0 + 0.34 * strand);
    gl_FragColor = vec4(mix(edgeColor, glowColor, soft), 1.0);
  }
`;
