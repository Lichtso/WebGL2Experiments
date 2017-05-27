const igpAlpha = Math.sin(0.3*Math.PI)/Math.sin(0.4*Math.PI),
      igpBeta = Math.sqrt(3),
      igpGamma = Math.sqrt(5/4);

function IcosahedralClass1GoldbergPolyhedron(gpIndex) {
    this.gpIndex = gpIndex;
    this.hexCount = (this.gpIndex*this.gpIndex-1)*10;
    console.log(this.gpIndex, this.hexCount);
    this.edgeLength = 0.5;
    this.poleDistance = this.gpIndex*this.edgeLength*igpBeta;
    this.sphereRadius = this.poleDistance*igpAlpha*igpGamma;
    const poles = [];

    for(var i = 0; i < 5; ++i) {
        const angle = Math.PI*2*i/5, x = Math.sin(angle), y = Math.cos(angle);
        poles.push(linearAlgebra.vec3.fromValues(x, -0.5, y));
        poles.push(linearAlgebra.vec3.fromValues(x, 0.5, -y));
    }
    poles.push(linearAlgebra.vec3.fromValues(0, -igpGamma, 0));
    poles.push(linearAlgebra.vec3.fromValues(0, igpGamma, 0));
    this.points = poles.slice();

    this.generatePointsInTriangle = function(a, b, c, fillSecondEdge=0) {
        const point = linearAlgebra.vec3.create(),
              poleA = poles[a],
              poleB = poles[b%10],
              poleC = poles[c%10],
              dirAB = linearAlgebra.vec3.create(),
              dirBC = linearAlgebra.vec3.create(),
              vecAB = linearAlgebra.vec3.create(),
              vecBC = linearAlgebra.vec3.create();
        linearAlgebra.vec3.subtract(dirAB, poleB, poleA);
        linearAlgebra.vec3.subtract(dirBC, poleC, poleB);
        linearAlgebra.vec3.scale(dirAB, dirAB, 1.0/this.gpIndex);
        linearAlgebra.vec3.scale(dirBC, dirBC, 1.0/this.gpIndex);
        for(var i = 1; i < this.gpIndex; ++i)
            for(var j = 0; j < i+fillSecondEdge; ++j) {
                linearAlgebra.vec3.scale(vecAB, dirAB, i);
                linearAlgebra.vec3.scale(vecBC, dirBC, j);
                linearAlgebra.vec3.add(point, vecAB, vecBC);
                linearAlgebra.vec3.add(point, point, poleA);
                this.points.push(linearAlgebra.vec3.clone(point));
            }
    };
    for(var i = 0; i < 10; i += 2) {
        this.generatePointsInTriangle(10, i, i+2);
        this.generatePointsInTriangle(11, i+1, i+3);
        this.generatePointsInTriangle(i, i+2, 15-i, 1);
        this.generatePointsInTriangle((i+3)%10, i+1, 14-i, 1);
    }

    this.positions = new Float32Array(this.points.length*3);
    for(var i = 0; i < this.points.length; ++i) {
        linearAlgebra.vec3.normalize(this.points[i], this.points[i]);
        linearAlgebra.vec3.scale(this.points[i], this.points[i], this.sphereRadius);
        this.positions[i*3+0] = this.points[i][0];
        this.positions[i*3+1] = this.points[i][1];
        this.positions[i*3+2] = this.points[i][2];
    }
}



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
in vec4 position;
uniform mat4 projection;

void main() {
    gl_Position = projection*position;
    gl_PointSize = 30.0-gl_Position.z*2.0;
}`;

const fragmentShaderSource = `
precision mediump float;

out vec4 outColor;

void main() {
    outColor = vec4(0, 0, 0, 1);
}`;

const linearAlgebra = require('./gl-matrix/src/gl-matrix.js'),
      canvas = document.getElementById('canvas'),
      devicePixelRatio = window.devicePixelRatio || 1,
      desiredWidth = 512, desiredHeight = 512;
canvas.style.width = desiredWidth+'px';
canvas.style.height = desiredHeight+'px';
canvas.width = Math.round(desiredWidth*devicePixelRatio);
canvas.height = Math.round(desiredHeight*devicePixelRatio);

const gl = canvas.getContext('webgl2');
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

const positionAttributeLocation = gl.getAttribLocation(program, 'position'),
      positionBuffer = gl.createBuffer(),
      vertexArray = gl.createVertexArray();
const planet = new IcosahedralClass1GoldbergPolyhedron(4);
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, planet.positions, gl.STATIC_DRAW);
gl.bindVertexArray(vertexArray);
gl.enableVertexAttribArray(positionAttributeLocation);
gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);
gl.useProgram(program);

var rotation = 0;
const rotationMat = linearAlgebra.mat4.create();
window.setInterval(function() {
    linearAlgebra.mat4.fromYRotation(rotationMat, rotation);
    linearAlgebra.mat4.multiply(rotationMat, projectionMat, rotationMat);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'projection'), false, rotationMat);
    gl.drawArrays(gl.POINTS, 0, planet.points.length);
    rotation += 0.01;
}, 1000/25);
