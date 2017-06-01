function createShader(type, source) {
    const shader = gl.createShader(type);
    if(type == gl.FRAGMENT_SHADER)
        source = 'precision mediump float;\n'+source;
    gl.shaderSource(shader, '#version 300 es\n'+source);
    gl.compileShader(shader);
    if(gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        return shader;
    console.log(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
}

function createProgram(shaders) {
    const program = gl.createProgram();
    for(const shader of shaders)
        gl.attachShader(program, shader);
    gl.linkProgram(program);
    if(gl.getProgramParameter(program, gl.LINK_STATUS))
        return program;
    console.log(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
}

const vertexShaderSource = `
uniform mat4 positionMat;
uniform mat4 projectionMat;
layout(location=0) in vec4 vPosition;
layout(location=1) in vec3 vNormal;
layout(location=2) in vec2 vTexcoord;
out vec3 fPosition;
out vec3 fNormal;
out vec2 fTexcoord;

void main() {
    mat3 normalTransform = mat3(
        positionMat[0].xyz,
        positionMat[1].xyz,
        positionMat[2].xyz
    );
    gl_Position = projectionMat*vPosition;
    fPosition = (positionMat*vPosition).xyz;
    fNormal = normalTransform*vNormal;
    fTexcoord = vTexcoord;
}`;

const fragmentShaderSource = `
uniform sampler2D colorMap;
in vec3 fPosition;
in vec3 fNormal;
in vec2 fTexcoord;
out vec4 outColor;

void main() {
    outColor = texture(colorMap, fTexcoord);
    vec3 lightVector = normalize(vec3(-1.0, 1.0, 2.0));
    outColor.rgb *= clamp(pow(1024.0, dot(fNormal, lightVector))-1.0, 0.5, 1.0);
}`;

const geometry = require('./geometry.js'),
      linearAlgebra = require('./gl-matrix/src/gl-matrix.js')
      canvas3d = document.getElementById('canvas'),
      canvas2d = document.createElement('canvas'),
      devicePixelRatio = window.devicePixelRatio || 1,
      desiredWidth = 512, desiredHeight = 512;
canvas3d.style.width = desiredWidth+'px';
canvas3d.style.height = desiredHeight+'px';
canvas3d.width = Math.round(desiredWidth*devicePixelRatio);
canvas3d.height = Math.round(desiredHeight*devicePixelRatio);
const ctx = canvas2d.getContext('2d'),
      gl = canvas3d.getContext('webgl2');
if(!gl) {
    console.log('WebGL 2 not supported');
}
gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
gl.clearColor(0, 0, 0, 1);
gl.enable(gl.CULL_FACE);
gl.enable(gl.DEPTH_TEST);
gl.depthFunc(gl.LESS);

const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource),
      fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource),
      program = createProgram([vertexShader, fragmentShader]),
      projectionMat = linearAlgebra.mat4.create(),
      camSize = 10;
linearAlgebra.mat4.ortho(projectionMat, -camSize, camSize, -camSize, camSize, 1, 100);
linearAlgebra.mat4.translate(projectionMat, projectionMat, [0, 0, -25]);

const polyhedron = new geometry.IcosahedralClass1GoldbergPolyhedron(gl, 10);
const positionAttributeLocation = gl.getAttribLocation(program, 'vPosition'),
      normalAttributeLocation = gl.getAttribLocation(program, 'vNormal'),
      texcoordAttributeLocation = gl.getAttribLocation(program, 'vTexcoord'),
      vertexArray = gl.createVertexArray();
gl.useProgram(program);
gl.bindVertexArray(vertexArray);
gl.enableVertexAttribArray(positionAttributeLocation);
gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 8*4, 0*4);
gl.enableVertexAttribArray(normalAttributeLocation);
gl.vertexAttribPointer(normalAttributeLocation, 3, gl.FLOAT, false, 8*4, 3*4);
gl.enableVertexAttribArray(texcoordAttributeLocation);
gl.vertexAttribPointer(texcoordAttributeLocation, 2, gl.FLOAT, false, 8*4, 6*4);
