const linearAlgebra = require('./gl-matrix/src/gl-matrix.js');

exports.IcosahedralClass1GoldbergPolyhedron = function(gl, ctx, gpIndex) {
    this.edgeLength = 0.5;
    this.texcoordEdgeLength = 20;
    this.gl = gl;
    this.gpIndex = gpIndex;
    this.generateGeometry();
    this.generateTopology(ctx);

    // Generate WebGL buffers
    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.positions, gl.STATIC_DRAW);
};

const prototype = exports.IcosahedralClass1GoldbergPolyhedron.prototype;

prototype.getFieldVertexCountAtLayer = function(layerIndex) {
    if(layerIndex < this.gpIndex)
        return layerIndex;
    else if(layerIndex <= this.gpIndex*2)
        return this.gpIndex;
    return this.gpIndex*3-layerIndex;
};

prototype.getBorderVertexCountAtLayer = function(layerIndex) {
    if(layerIndex < this.gpIndex)
        return layerIndex*2+1;
    else if(layerIndex < this.gpIndex*2)
        return this.gpIndex*2;
    return (this.gpIndex*3-layerIndex)*2-1;
};

prototype.getFieldVertexOffset = function(indexInLayer, layerIndex) {
    if(layerIndex == 0)
        return 0;
    var offset;
    --layerIndex;
    if(layerIndex < this.gpIndex)
        offset = (layerIndex*layerIndex+layerIndex)/2;
    else if(layerIndex < this.gpIndex*2)
        offset = (layerIndex+1/2)*this.gpIndex-this.gpIndex*this.gpIndex/2;
    else {
        layerIndex = this.gpIndex*3-layerIndex-1;
        offset = (this.gpIndex*this.gpIndex)*2-(layerIndex*layerIndex+layerIndex)/2;
    }
    return offset*5+1+indexInLayer;
};

prototype.getBorderVertexOffset = function(indexInLayer, layerIndex) {
    var offset;
    if(layerIndex < this.gpIndex)
        offset = layerIndex*layerIndex;
    else if(layerIndex < this.gpIndex*2)
        offset = this.gpIndex*this.gpIndex+this.gpIndex*2*(layerIndex-this.gpIndex);
    else {
        layerIndex = this.gpIndex*3-layerIndex;
        offset = this.gpIndex*this.gpIndex*4-layerIndex*layerIndex;
    }
    return offset*5+indexInLayer;
};

prototype.getVertexPosition = function(indexInLayer, layerIndex) {
    const offset = this.getFieldVertexOffset(indexInLayer, layerIndex)*3;
    return linearAlgebra.vec3.fromValues(this.positions[offset], this.positions[offset+1], this.positions[offset+2]);
};

prototype.wrapIndexInLayer = function(indexInLayer, layerIndex) {
    return (layerIndex == 0 || layerIndex == this.gpIndex*3) ? 0 : indexInLayer%(this.getFieldVertexCountAtLayer(layerIndex)*5);
};

prototype.isPole = function(indexInLayer, layerIndex) {
    const fieldVertexCountAtLayer = this.getFieldVertexCountAtLayer(layerIndex);
    return (fieldVertexCountAtLayer == 0 || (layerIndex%this.gpIndex == 0 && indexInLayer%fieldVertexCountAtLayer == 0));
};

prototype.render = function() {
    const gl = this.gl;
    gl.drawArrays(gl.POINTS, 0, this.fieldVertexCount);
    gl.drawArrays(gl.LINE_STRIP, this.fieldVertexCount, this.borderVertexCount);
};

prototype.generateGeometry = function() {
    this.fieldVertexCount = this.gpIndex*this.gpIndex*10+2;
    this.borderVertexCount = this.gpIndex*this.gpIndex*20;
    this.vertexCount = this.fieldVertexCount+this.borderVertexCount;

    // Generate 12 poles (icosahedron)
    const gamma = Math.sqrt(5/4),
          poleDistance = this.gpIndex*this.edgeLength*Math.sqrt(3),
          sphereRadius = poleDistance*Math.sin(0.3*Math.PI)/Math.sin(0.4*Math.PI)*gamma,
          southPole = linearAlgebra.vec3.fromValues(0, -gamma*poleDistance, 0),
          northPole = linearAlgebra.vec3.fromValues(0, gamma*poleDistance, 0),
          southernPoles = [], northernPoles = [];
    for(var i = 0; i < 5; ++i) {
        const angle = Math.PI*2*i/5,
              x = Math.sin(angle)*poleDistance,
              y = Math.cos(angle)*poleDistance;
        southernPoles.push(linearAlgebra.vec3.fromValues(-x, -0.5*poleDistance, -y));
        northernPoles.push(linearAlgebra.vec3.fromValues(x, 0.5*poleDistance, y));
    }

    // Generate field vertices (barycentric interpolation)
    const position = linearAlgebra.vec3.create(),
          normal = linearAlgebra.vec3.create(),
          dirAB = linearAlgebra.vec3.create(),
          dirBC = linearAlgebra.vec3.create(),
          vecAB = linearAlgebra.vec3.create(),
          vecBC = linearAlgebra.vec3.create();
    const setVertex = function(offset) {
        offset *= 3;
        linearAlgebra.vec3.normalize(position, position);
        linearAlgebra.vec3.scale(position, position, sphereRadius);
        this.positions[offset+0] = position[0];
        this.positions[offset+1] = position[1];
        this.positions[offset+2] = position[2];
        linearAlgebra.vec3.normalize(normal, normal);
        this.normals[offset+0] = normal[0];
        this.normals[offset+1] = normal[1];
        this.normals[offset+2] = normal[2];
    }.bind(this);
    this.positions = new Float32Array(this.vertexCount*3);
    this.normals = new Float32Array(this.vertexCount*3);
    const interpolatePoles = function(poleAIndex, poleALayer, mode, poleA, poleB, poleC, fillSecondEdge=0) {
        linearAlgebra.vec3.subtract(dirAB, poleB, poleA);
        linearAlgebra.vec3.subtract(dirBC, poleC, poleB);
        linearAlgebra.vec3.scale(dirAB, dirAB, 1.0/this.gpIndex);
        linearAlgebra.vec3.scale(dirBC, dirBC, 1.0/this.gpIndex);
        if(mode > 1)
            ++poleAIndex;
        for(var i = 1; i < this.gpIndex+fillSecondEdge; ++i) {
            const layerIndex = poleALayer+(mode > 0 ? -i : i),
                  indexInLayer = poleAIndex*this.getFieldVertexCountAtLayer(layerIndex)+((mode > 1) ? -i : 0);
            for(var j = 0; j < i; ++j) {
                linearAlgebra.vec3.scale(vecAB, dirAB, i);
                linearAlgebra.vec3.scale(vecBC, dirBC, j);
                linearAlgebra.vec3.add(position, vecAB, vecBC);
                linearAlgebra.vec3.add(position, position, poleA);
                linearAlgebra.vec3.copy(normal, position);
                setVertex(this.getFieldVertexOffset(indexInLayer+j, layerIndex));
            }
        }
    }.bind(this);
    linearAlgebra.vec3.copy(position, southPole);
    linearAlgebra.vec3.copy(normal, [0, -1, 0]);
    setVertex(this.getFieldVertexOffset(0, 0));
    linearAlgebra.vec3.copy(position, northPole);
    linearAlgebra.vec3.copy(normal, [0, 1, 0]);
    setVertex(this.getFieldVertexOffset(0, this.gpIndex*3));
    for(var poleIndex = 0; poleIndex < 5; ++poleIndex) {
        const i0 = poleIndex, i1 = (poleIndex+1)%5, i2 = (poleIndex+2)%5, i3 = (poleIndex+3)%5;
        interpolatePoles(i0, 0, 0, southPole, southernPoles[i0], southernPoles[i1]);
        interpolatePoles(i0, this.gpIndex*2, 2, northernPoles[i3], southernPoles[i0], southernPoles[i1], 1);
        interpolatePoles(i0, this.gpIndex, 0, southernPoles[i0], northernPoles[i2], northernPoles[i3], 1);
        interpolatePoles(i0, this.gpIndex*3, 1, northPole, northernPoles[i2], northernPoles[i3]);
    }

    // Generate border vertices (tesselation)
    const generateBorderVertex = function(fieldVertexA, fieldVertexB, fieldVertexC) {
        linearAlgebra.vec3.subtract(dirAB, fieldVertexB, fieldVertexA);
        linearAlgebra.vec3.subtract(dirBC, fieldVertexC, fieldVertexB);
        linearAlgebra.vec3.cross(normal, dirAB, dirBC);
        linearAlgebra.vec3.add(position, fieldVertexA, fieldVertexB);
        linearAlgebra.vec3.add(position, position, fieldVertexC);
        // linearAlgebra.vec3.scale(position, position, 1.0/3.0); // Gets normalized anyway
        setVertex(borderVertexIndex++);
    }.bind(this);
    var borderVertexIndex = this.fieldVertexCount;
    for(var layerIndex = 0; layerIndex <= this.gpIndex*3; ++layerIndex) {
        const borderVertexCountAtLayer = this.getBorderVertexCountAtLayer(layerIndex),
              hemiSphere = (layerIndex < this.gpIndex*2) ? 0 : 1;
        var lowerIndex = 0, upperIndex = 0,
            lowerFiledVertex = this.getVertexPosition(lowerIndex, layerIndex),
            upperFiledVertex = this.getVertexPosition(upperIndex, layerIndex+1);
        for(var poleIndex = 0; poleIndex < 5; ++poleIndex)
            for(var indexInEdge = 0; indexInEdge < borderVertexCountAtLayer; ++indexInEdge) {
                if(indexInEdge%2 == hemiSphere) { // Downward Triangle
                    const prevUpperFiledVertex = upperFiledVertex;
                    upperIndex = this.wrapIndexInLayer(upperIndex+1, layerIndex+1);
                    upperFiledVertex = this.getVertexPosition(upperIndex, layerIndex+1);
                    generateBorderVertex(lowerFiledVertex, upperFiledVertex, prevUpperFiledVertex);
                } else { // Upward Triangle
                    const prevLowerFiledVertex = lowerFiledVertex;
                    lowerIndex = this.wrapIndexInLayer(lowerIndex+1, layerIndex);
                    lowerFiledVertex = this.getVertexPosition(lowerIndex, layerIndex);
                    generateBorderVertex(lowerFiledVertex, upperFiledVertex, prevLowerFiledVertex);
                }
            }
    }
};

prototype.generateTopology = function(ctx) {
    // Generate texcoords of field vertices (unwrapping)
    this.texcoords = new Float32Array(this.fieldVertexCount*2);
    const outVertices = new Float32Array((this.fieldVertexCount)*8),
          texcoord = linearAlgebra.vec2.create(),
          fieldTexcoord = linearAlgebra.vec2.create(),
          texcoordHeight = this.texcoordEdgeLength*2,
          texcoordWidth = texcoordHeight*Math.sqrt(3)/2,
          texcoordDirS = linearAlgebra.vec2.fromValues(texcoordWidth, 0),
          texcoordDirT = linearAlgebra.vec2.fromValues(texcoordWidth*0.5, texcoordHeight*3/4);
    var outVertexOffset = 0;
    const setTexcoord = function(vertexOffset, hexX, hexY) {
        linearAlgebra.vec3.scale(fieldTexcoord, texcoordDirT, hexY);
        fieldTexcoord[0] += (hexX+0.5)*texcoordWidth;
        fieldTexcoord[1] += texcoordHeight*0.5;
        vertexOffset *= 2;
        this.texcoords[vertexOffset+0] = fieldTexcoord[0];
        this.texcoords[vertexOffset+1] = fieldTexcoord[1];
    }.bind(this);
    const setOutVertex = function(outVertexOffset, vertexOffset, direction) {
        linearAlgebra.vec2.copy(texcoord, fieldTexcoord);
        switch(direction) {
            case 0:
                texcoord[0] += texcoordWidth*0.5;
                texcoord[1] += texcoordHeight*0.25;
                break;
            case 1:
                texcoord[0] += texcoordWidth*0.5;
                texcoord[1] -= texcoordHeight*0.25;
                break;
            case 2:
                texcoord[1] -= texcoordHeight*0.5;
                break;
            case 3:
                texcoord[0] -= texcoordWidth*0.5;
                texcoord[1] -= texcoordHeight*0.25;
                break;
            case 4:
                texcoord[0] -= texcoordWidth*0.5;
                texcoord[1] += texcoordHeight*0.25;
                break;
            case 5:
                texcoord[1] += texcoordHeight*0.5;
                break;
        }
        if(direction < 6) {
            ctx.fillRect(texcoord[0], texcoord[1], 1, 1);
        }
        /*const outVertexOffset = outVertexOffset*8;
        vertexOffset *= 3;
        outVertices[outVertexOffset+0] = this.positions[vertexOffset+0];
        outVertices[outVertexOffset+1] = this.positions[vertexOffset+1];
        outVertices[outVertexOffset+2] = this.positions[vertexOffset+2];
        outVertices[outVertexOffset+3] = this.normals[vertexOffset+0];
        outVertices[outVertexOffset+4] = this.normals[vertexOffset+1];
        outVertices[outVertexOffset+5] = this.normals[vertexOffset+2];
        outVertices[outVertexOffset+6] = texcoord[0];
        outVertices[outVertexOffset+7] = texcoord[1];*/
    }.bind(this);
    var hexX, hexY = this.gpIndex-2;
    for(var layerIndex = this.gpIndex+1; layerIndex <= this.gpIndex*2; ++layerIndex) {
        hexX = 0;
        for(var indexInLayer = 0; indexInLayer < this.getFieldVertexCountAtLayer(layerIndex)*5; ++indexInLayer) {
            setTexcoord(this.getFieldVertexOffset(indexInLayer, layerIndex), hexX, hexY);
            if(layerIndex < this.gpIndex*2) {
                setOutVertex(0, this.getFieldVertexOffset(indexInLayer, layerIndex), 6);
                ctx.fillText(indexInLayer+' '+layerIndex, fieldTexcoord[0]-10, fieldTexcoord[1]+3);
            }

            setOutVertex(0, this.getFieldVertexOffset(indexInLayer, layerIndex), 4);
            setOutVertex(0, this.getFieldVertexOffset(indexInLayer, layerIndex), 5);
            if(indexInLayer == this.getFieldVertexCountAtLayer(layerIndex)*5-1)
                setOutVertex(0, this.getFieldVertexOffset(indexInLayer, layerIndex), 0);

            ++hexX;
        }
        setTexcoord(this.getFieldVertexOffset(0, layerIndex), hexX, hexY);
        if(layerIndex > this.gpIndex+1)
            setOutVertex(0, this.getFieldVertexOffset(indexInLayer, layerIndex), 5);
        --hexY;
    }
    for(var layerIndex = 1; layerIndex <= this.gpIndex; ++layerIndex) {
        hexX = layerIndex;
        hexY = 0;
        for(var poleIndex = 0; poleIndex < 5; ++poleIndex)
            for(var indexInEdge = 0; indexInEdge < this.getFieldVertexCountAtLayer(layerIndex); ++indexInEdge) {
                const indexInLayer = this.getFieldVertexCountAtLayer(layerIndex)*poleIndex+indexInEdge;
                if(layerIndex < this.gpIndex || indexInEdge > 0) {
                    var vertexOffset = this.getFieldVertexOffset(indexInLayer, layerIndex);
                    setTexcoord(vertexOffset, 1+hexX+hexY, this.gpIndex*2-hexY);
                    setOutVertex(0, vertexOffset, 6);
                    ctx.fillText(indexInLayer+' '+layerIndex, fieldTexcoord[0]-10, fieldTexcoord[1]+3);

                    vertexOffset = this.getFieldVertexOffset(indexInLayer, this.gpIndex*3-layerIndex);
                    setTexcoord(vertexOffset, this.gpIndex*2+2+hexX, this.gpIndex*2+hexY);
                    setOutVertex(0, vertexOffset, 6);
                    ctx.fillText(indexInLayer+' '+(this.gpIndex*3-layerIndex), fieldTexcoord[0]-10, fieldTexcoord[1]+3);
                }
                switch(poleIndex) {
                    case 0:
                        --hexY;
                        break;
                    case 1:
                        --hexX;
                        break;
                    case 2:
                        --hexX;
                        ++hexY;
                        break;
                    case 3:
                        ++hexY;
                        break;
                    case 4:
                        ++hexX;
                        break;
                    case 5:
                        ++hexX;
                        --hexY;
                        break;
                }
            }
    }
};
