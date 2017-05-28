const igpAlpha = Math.sin(0.3*Math.PI)/Math.sin(0.4*Math.PI),
      igpBeta = Math.sqrt(3),
      igpGamma = Math.sqrt(5/4);

function IcosahedralClass1GoldbergPolyhedron(gpIndex) {
    this.gpIndex = gpIndex;
    this.hexCountPerEdgeAtLayer = [];
    for(var layer = 0; layer <= this.gpIndex; ++layer)
        this.hexCountPerEdgeAtLayer.push(layer);
    for(var layer = this.gpIndex; layer < this.gpIndex*2; ++layer)
        this.hexCountPerEdgeAtLayer.push(this.gpIndex);
    for(var layer = this.gpIndex-1; layer >= 0; --layer)
        this.hexCountPerEdgeAtLayer.push(layer);
    this.offsetAtLayer = [];
    for(var accumulator = 1, layer = 0; layer <= this.gpIndex*3; ++layer) {
        accumulator += this.hexCountPerEdgeAtLayer[layer]*5;
        this.offsetAtLayer.push(accumulator);
    }
    ++this.offsetAtLayer[this.gpIndex*3];
    console.log(this.gpIndex, this.hexCountPerEdgeAtLayer, this.offsetAtLayer);

    this.edgeLength = 0.5;
    this.poleDistance = this.gpIndex*this.edgeLength*igpBeta;
    this.sphereRadius = this.poleDistance*igpAlpha*igpGamma;
    const southPole = linearAlgebra.vec3.fromValues(0, -igpGamma*this.poleDistance, 0),
          northPole = linearAlgebra.vec3.fromValues(0, igpGamma*this.poleDistance, 0),
          southernPoles = [], northernPoles = [];
    for(var i = 0; i < 5; ++i) {
        const angle = Math.PI*2*i/5,
              x = Math.sin(angle)*this.poleDistance,
              y = Math.cos(angle)*this.poleDistance;
        southernPoles.push(linearAlgebra.vec3.fromValues(-x, -0.5*this.poleDistance, -y));
        northernPoles.push(linearAlgebra.vec3.fromValues(x, 0.5*this.poleDistance, y));
    }
    this.fieldVertices = new Float32Array(this.offsetAtLayer[this.gpIndex*3]*3);
    this.borderVertices = this.fieldVertices;

    this.isPole = function(layerIndex, indexInLayer) {
        return (layerIndex%this.gpIndex == 0 && indexInLayer%this.hexCountPerEdgeAtLayer[layerIndex] == 0);
    };
    this.getOffset = function(layerIndex, indexInLayer) {
        return this.offsetAtLayer[layerIndex-1]+indexInLayer;
    };

    const setFieldVertexAt = function(index, fieldVertex) {
        linearAlgebra.vec3.normalize(fieldVertex, fieldVertex);
        linearAlgebra.vec3.scale(fieldVertex, fieldVertex, this.sphereRadius);
        this.fieldVertices[index*3+0] = fieldVertex[0];
        this.fieldVertices[index*3+1] = fieldVertex[1];
        this.fieldVertices[index*3+2] = fieldVertex[2];
    }.bind(this);
    const generateFieldVertices = function(poleAIndex, poleALayer, mode, poleA, poleB, poleC, fillSecondEdge=0) {
        const fieldVertex = linearAlgebra.vec3.create(),
              dirAB = linearAlgebra.vec3.create(),
              dirBC = linearAlgebra.vec3.create(),
              vecAB = linearAlgebra.vec3.create(),
              vecBC = linearAlgebra.vec3.create();
        linearAlgebra.vec3.subtract(dirAB, poleB, poleA);
        linearAlgebra.vec3.subtract(dirBC, poleC, poleB);
        linearAlgebra.vec3.scale(dirAB, dirAB, 1.0/this.gpIndex);
        linearAlgebra.vec3.scale(dirBC, dirBC, 1.0/this.gpIndex);
        if(mode > 1)
            ++poleAIndex;
        for(var i = 1; i < this.gpIndex+fillSecondEdge; ++i) {
            const layerIndex = poleALayer+(mode > 0 ? -i : i),
                  layerOffset = this.offsetAtLayer[layerIndex-1]+poleAIndex*this.hexCountPerEdgeAtLayer[layerIndex]+((mode > 1) ? -i : 0);
            for(var j = 0; j < i; ++j) {
                linearAlgebra.vec3.scale(vecAB, dirAB, i);
                linearAlgebra.vec3.scale(vecBC, dirBC, j);
                linearAlgebra.vec3.add(fieldVertex, vecAB, vecBC);
                linearAlgebra.vec3.add(fieldVertex, fieldVertex, poleA);
                setFieldVertexAt(layerOffset+j, fieldVertex);
            }
        }
    }.bind(this);
    setFieldVertexAt(0, linearAlgebra.vec3.clone(southPole));
    setFieldVertexAt(this.offsetAtLayer[this.gpIndex*3]-1, linearAlgebra.vec3.clone(northPole));
    for(var i = 0; i < 5; ++i) {
        const i1 = (i+1)%5, i2 = (i+2)%5, i3 = (i+3)%5;
        generateFieldVertices(i, 0, 0, southPole, southernPoles[i], southernPoles[i1]);
        generateFieldVertices(i, this.gpIndex*2, 2, northernPoles[i3], southernPoles[i], southernPoles[i1], 1);
        generateFieldVertices(i, this.gpIndex, 0, southernPoles[i], northernPoles[i2], northernPoles[i3], 1);
        generateFieldVertices(i, this.gpIndex*3, 1, northPole, northernPoles[i2], northernPoles[i3]);
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
gl.bufferData(gl.ARRAY_BUFFER, planet.borderVertices, gl.STATIC_DRAW);
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
    gl.drawArrays(gl.POINTS, 0, planet.borderVertices.length/3);
    rotation += 0.01;
}, 1000/25);
