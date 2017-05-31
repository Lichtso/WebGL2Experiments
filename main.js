function createShader(type, source) {
    const shader = gl.createShader(type);
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
uniform mat4 projection;
layout(location=0) in vec3 vPosition;
layout(location=1) in vec3 vNormal;
layout(location=2) in vec2 vTexcoord;
out vec3 fPosition;
out vec3 fNormal;
out vec2 fTexcoord;

void main() {
    gl_Position = projection*vec4(vPosition, 1.0);
    gl_PointSize = 20.0-gl_Position.z;
    fPosition = vPosition;
    fNormal = vNormal;
    fTexcoord = vTexcoord;
}`;

const fragmentShaderSource = `
precision mediump float;

uniform vec3 color;
in vec3 fPosition;
in vec3 fNormal;
in vec2 fTexcoord;
out vec4 outColor;

void main() {
    outColor = vec4(fTexcoord.xy, 0, 1);
}`;

const geometry = require('./geometry.js'),
      linearAlgebra = require('./gl-matrix/src/gl-matrix.js')
      canvas3d = document.getElementById('canvas3d'),
      canvas2d = document.getElementById('canvas2d'),
      devicePixelRatio = window.devicePixelRatio || 1,
      desiredWidth = 512, desiredHeight = 512;
canvas3d.style.width = desiredWidth+'px';
canvas3d.style.height = desiredHeight+'px';
canvas3d.width = Math.round(desiredWidth*devicePixelRatio);
canvas3d.height = Math.round(desiredHeight*devicePixelRatio);
// canvas2d.style.width = desiredWidth+'px';
// canvas2d.style.height = desiredHeight+'px';
canvas2d.width = Math.round(desiredWidth*devicePixelRatio);
canvas2d.height = Math.round(desiredHeight*devicePixelRatio);
const ctx = canvas2d.getContext('2d');

const gl = canvas3d.getContext('webgl2');
if(!gl) {
    console.log('WebGL 2 not supported');
}
gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
gl.clearColor(0, 0, 0, 0);

const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource),
      fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource),
      program = createProgram([vertexShader, fragmentShader]),
      projectionMat = linearAlgebra.mat4.create();
linearAlgebra.mat4.perspective(projectionMat, 45/180*Math.PI, gl.canvas.width/gl.canvas.height, 1, 100);
linearAlgebra.mat4.translate(projectionMat, projectionMat, [0, 0, -10]);

const planet = new geometry.IcosahedralClass1GoldbergPolyhedron(gl, ctx, 4);
const positionAttributeLocation = gl.getAttribLocation(program, 'vPosition'),
      normalAttributeLocation = gl.getAttribLocation(program, 'vNormal'),
      texcoordAttributeLocation = gl.getAttribLocation(program, 'vTexcoord'),
      vertexArray = gl.createVertexArray();
gl.useProgram(program);
gl.bindVertexArray(vertexArray);
gl.enableVertexAttribArray(positionAttributeLocation);
gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);
//gl.enableVertexAttribArray(normalAttributeLocation);
//gl.vertexAttribPointer(normalAttributeLocation, 3, gl.FLOAT, false, 8*4, 3*4);
//gl.enableVertexAttribArray(texcoordAttributeLocation);
//gl.vertexAttribPointer(texcoordAttributeLocation, 2, gl.FLOAT, false, 8*4, 6*4);

var rotation = 0;
const rotationMat = linearAlgebra.mat4.create();
window.setInterval(function() {
    linearAlgebra.mat4.fromYRotation(rotationMat, rotation);
    linearAlgebra.mat4.multiply(rotationMat, projectionMat, rotationMat);
    rotation += 0.01;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'projection'), false, rotationMat);
    planet.render();
}, 1000/25);
