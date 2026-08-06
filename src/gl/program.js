export function createProgram(context, vertexSource, fragmentSource) {
  const vertexShader = createShader(context, context.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(context, context.FRAGMENT_SHADER, fragmentSource);
  const linkedProgram = context.createProgram();

  context.attachShader(linkedProgram, vertexShader);
  context.attachShader(linkedProgram, fragmentShader);
  context.linkProgram(linkedProgram);

  if (!context.getProgramParameter(linkedProgram, context.LINK_STATUS)) {
    throw new Error(context.getProgramInfoLog(linkedProgram));
  }

  context.deleteShader(vertexShader);
  context.deleteShader(fragmentShader);

  return linkedProgram;
}

export function getAttributeLocations(context, program, names) {
  return Object.fromEntries(names.map((name) => [name, context.getAttribLocation(program, name)]));
}

export function getUniformLocations(context, program, names) {
  return Object.fromEntries(names.map((name) => [name, context.getUniformLocation(program, name)]));
}

export function uploadAttribute(context, buffer, data, location, size) {
  context.bindBuffer(context.ARRAY_BUFFER, buffer);
  context.bufferData(context.ARRAY_BUFFER, data, context.STATIC_DRAW);
  context.enableVertexAttribArray(location);
  context.vertexAttribPointer(location, size, context.FLOAT, false, 0, 0);
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

