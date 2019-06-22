import * as linearAlgebra from './gl-matrix.js';

const alpha = Math.sqrt(3),
      beta = Math.sin(0.3*Math.PI)/Math.sin(0.4*Math.PI),
      gamma = Math.sqrt(5/4);

export class IcosahedralClass1GoldbergPolyhedron {
    constructor(renderContext, gpIndex) {
        this.edgeLength3d = 0.5;
        this.edgeLength2d = 25;
        this.roundSurface = true;
        this.gpIndex = gpIndex;
        this.renderContext = renderContext;
        this.generateGeometry();
        this.generateTopology();
    }

    getFieldVertexCountPerEdgeAtLayer(layerIndex) {
        if(layerIndex < this.gpIndex)
            return layerIndex;
        else if(layerIndex <= this.gpIndex*2)
            return this.gpIndex;
        return this.gpIndex*3-layerIndex;
    }

    getBorderVertexCountPerEdgeAtLayer(layerIndex) {
        if(layerIndex < this.gpIndex)
            return layerIndex*2+1;
        else if(layerIndex < this.gpIndex*2)
            return this.gpIndex*2;
        return (this.gpIndex*3-layerIndex)*2-1;
    }

    getFieldVertexCountAtLayer(layerIndex) {
        return (layerIndex == 0 || layerIndex == this.gpIndex*3)
            ? 1 : this.getFieldVertexCountPerEdgeAtLayer(layerIndex)*5;
    }

    getFieldVertexIndex(indexInLayer, layerIndex) {
        if(layerIndex == 0)
            return 0;
        let offset;
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
    }

    getBorderVertexIndex(indexInLayer, layerIndex) {
        let offset;
        if(layerIndex < this.gpIndex)
            offset = layerIndex*layerIndex;
        else if(layerIndex < this.gpIndex*2)
            offset = this.gpIndex*this.gpIndex+this.gpIndex*2*(layerIndex-this.gpIndex);
        else {
            layerIndex = this.gpIndex*3-layerIndex;
            offset = this.gpIndex*this.gpIndex*4-layerIndex*layerIndex;
        }
        return offset*5+indexInLayer;
    }

    getVertexPosition(indexInLayer, layerIndex) {
        const offset = this.getFieldVertexIndex(indexInLayer, layerIndex)*3;
        return linearAlgebra.vec3.fromValues(this.positions[offset], this.positions[offset+1], this.positions[offset+2]);
    }

    wrapIndexInLayer(indexInLayer, layerIndex) {
        return (layerIndex == 0 || layerIndex == this.gpIndex*3) ? 0 : indexInLayer%(this.getFieldVertexCountPerEdgeAtLayer(layerIndex)*5);
    }

    isPole(indexInLayer, layerIndex) {
        const fieldVertexCountAtLayer = this.getFieldVertexCountPerEdgeAtLayer(layerIndex);
        return (fieldVertexCountAtLayer == 0 || (layerIndex%this.gpIndex == 0 && indexInLayer%fieldVertexCountAtLayer == 0));
    }

    render() {
        this.renderContext.gl.bindVertexArray(this.vertexArray);
        this.renderContext.gl.drawElements(this.renderContext.gl.TRIANGLE_FAN, this.fieldVertexCount*((this.roundSurface) ? 9 : 7), this.renderContext.gl.UNSIGNED_SHORT, 0);
    }

    cleanup() {
        this.renderContext.gl.deleteVertexArray(this.vertexArray);
    }

    generateGeometry() {
        this.fieldVertexCount = this.gpIndex*this.gpIndex*10+2;
        this.borderVertexCount = this.gpIndex*this.gpIndex*20;
        this.vertexCount = this.fieldVertexCount+this.borderVertexCount;
        // Generate 12 poles (icosahedron)
        const poleDistance = this.gpIndex*this.edgeLength3d*alpha,
              sphereRadius = gamma*poleDistance*beta,
              southPole = linearAlgebra.vec3.fromValues(0, -gamma*poleDistance, 0),
              northPole = linearAlgebra.vec3.fromValues(0, gamma*poleDistance, 0),
              southernPoles = [], northernPoles = [];
        for(let i = 0; i < 5; ++i) {
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
        const generateVertex = (offset) => {
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
        };
        this.positions = new Float32Array(this.vertexCount*3);
        this.normals = new Float32Array(this.vertexCount*3);
        const interpolatePoles = (poleAIndex, poleALayer, mode, poleA, poleB, poleC, fillSecondEdge=0) => {
            linearAlgebra.vec3.subtract(dirAB, poleB, poleA);
            linearAlgebra.vec3.subtract(dirBC, poleC, poleB);
            linearAlgebra.vec3.scale(dirAB, dirAB, 1.0/this.gpIndex);
            linearAlgebra.vec3.scale(dirBC, dirBC, 1.0/this.gpIndex);
            if(mode > 1)
                ++poleAIndex;
            for(let i = 1; i < this.gpIndex+fillSecondEdge; ++i) {
                const layerIndex = poleALayer+(mode > 0 ? -i : i),
                      indexInLayer = poleAIndex*this.getFieldVertexCountPerEdgeAtLayer(layerIndex)+((mode > 1) ? -i : 0);
                for(let j = 0; j < i; ++j) {
                    linearAlgebra.vec3.scale(vecAB, dirAB, i);
                    linearAlgebra.vec3.scale(vecBC, dirBC, j);
                    linearAlgebra.vec3.add(position, vecAB, vecBC);
                    linearAlgebra.vec3.add(position, position, poleA);
                    linearAlgebra.vec3.copy(normal, position);
                    generateVertex(this.getFieldVertexIndex(indexInLayer+j, layerIndex));
                }
            }
        };
        linearAlgebra.vec3.copy(position, southPole);
        linearAlgebra.vec3.copy(normal, [0, -1, 0]);
        generateVertex(this.getFieldVertexIndex(0, 0));
        linearAlgebra.vec3.copy(position, northPole);
        linearAlgebra.vec3.copy(normal, [0, 1, 0]);
        generateVertex(this.getFieldVertexIndex(0, this.gpIndex*3));
        for(let poleIndex = 0; poleIndex < 5; ++poleIndex) {
            const i0 = poleIndex, i1 = (poleIndex+1)%5, i2 = (poleIndex+2)%5, i3 = (poleIndex+3)%5;
            interpolatePoles(i0, 0, 0, southPole, southernPoles[i0], southernPoles[i1]);
            interpolatePoles(i0, this.gpIndex*2, 2, northernPoles[i3], southernPoles[i0], southernPoles[i1], 1);
            interpolatePoles(i0, this.gpIndex, 0, southernPoles[i0], northernPoles[i2], northernPoles[i3], 1);
            interpolatePoles(i0, this.gpIndex*3, 1, northPole, northernPoles[i2], northernPoles[i3]);
        }
        // Generate border vertices (tesselation)
        const generateBorderVertex = (fieldVertexA, fieldVertexB, fieldVertexC) => {
            linearAlgebra.vec3.subtract(dirAB, fieldVertexB, fieldVertexA);
            linearAlgebra.vec3.subtract(dirBC, fieldVertexC, fieldVertexB);
            linearAlgebra.vec3.cross(normal, dirAB, dirBC);
            linearAlgebra.vec3.add(position, fieldVertexA, fieldVertexB);
            linearAlgebra.vec3.add(position, position, fieldVertexC);
            generateVertex(borderVertexIndex++);
        };
        let borderVertexIndex = this.fieldVertexCount;
        for(let layerIndex = 0; layerIndex <= this.gpIndex*3; ++layerIndex) {
            const borderVertexCountAtLayer = this.getBorderVertexCountPerEdgeAtLayer(layerIndex),
                  hemiSphere = (layerIndex < this.gpIndex*2) ? 0 : 1;
            let lowerIndex = 0, upperIndex = 0,
                lowerFiledVertex = this.getVertexPosition(lowerIndex, layerIndex),
                upperFiledVertex = this.getVertexPosition(upperIndex, layerIndex+1);
            for(let poleIndex = 0; poleIndex < 5; ++poleIndex)
                for(let indexInEdge = 0; indexInEdge < borderVertexCountAtLayer; ++indexInEdge) {
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
    }

    generateTopology() {
        // Generate element indices
        const elementsPerFieldVertex = (this.roundSurface) ? 9 : 7,
              glElementBuffer = new Uint16Array(this.fieldVertexCount*elementsPerFieldVertex),
              primitiveRestartIndex = 65535;
        // Generate texcoords (UV unwrapping)
        let fieldVertexIndex = 0,
            borderVertexIndex = this.fieldVertexCount,
            outVertexIndex = 0,
            pentagonVertexOffset = 20*(this.gpIndex*this.gpIndex+this.gpIndex)+2*this.gpIndex-11;
        if(this.roundSurface) {
            outVertexIndex += this.fieldVertexCount;
            pentagonVertexOffset += this.fieldVertexCount;
        }
        this.fieldVertexTexcoords = new Float32Array(this.fieldVertexCount*2);
        this.texcoordHeight = Math.ceil(this.edgeLength2d)*2;
        this.texcoordWidth = Math.ceil(this.edgeLength2d*alpha);
        this.texcoordPentagonRadius = this.edgeLength2d*beta;
        this.textureWidth = this.texcoordWidth*(this.gpIndex*5.5-0.5),
        this.textureHeight = this.texcoordHeight*(this.gpIndex*2.25-0.5);
        const texcoord = linearAlgebra.vec2.create(),
              fieldVertexTexcoord = linearAlgebra.vec2.create(),
              texcoordDiagonal = linearAlgebra.vec2.fromValues(this.texcoordWidth*0.5, this.texcoordHeight*3/4);
        const generateTexcoord = (hexX, hexY) => {
            linearAlgebra.vec3.scale(fieldVertexTexcoord, texcoordDiagonal, hexY);
            fieldVertexTexcoord[0] += hexX*this.texcoordWidth;
            fieldVertexTexcoord[1] += this.texcoordHeight*0.5;
            const vertexOffset = fieldVertexIndex*2;
            this.fieldVertexTexcoords[vertexOffset+0] = fieldVertexTexcoord[0];
            this.fieldVertexTexcoords[vertexOffset+1] = fieldVertexTexcoord[1];
        };
        // Copy and interleave vertices
        const glVertexBuffer = new Float32Array((pentagonVertexOffset+12*5)*8);
        const generateVertex = (vertexIndex, direction) => {
            linearAlgebra.vec2.copy(texcoord, fieldVertexTexcoord);
            if(direction < 5) {
                const angle = Math.PI*2/5*direction+((fieldVertexIndex < this.fieldVertexCount/2) ? Math.PI*0.2 : 0);
                texcoord[0] += Math.sin(angle)*this.texcoordPentagonRadius;
                texcoord[1] += Math.cos(angle)*this.texcoordPentagonRadius;
            } else switch(direction) {
                case 5:
                    texcoord[1] += this.texcoordHeight*0.5;
                    break;
                case 6:
                    texcoord[0] += this.texcoordWidth*0.5;
                    texcoord[1] += this.texcoordHeight*0.25;
                    break;
            }
            let outVertexOffset;
            if(direction < 5)
                outVertexOffset = pentagonVertexOffset++;
            else if(direction < 7)
                outVertexOffset = outVertexIndex++;
            else {
                if(!this.roundSurface)
                    return;
                outVertexOffset = vertexIndex;
            }
            outVertexOffset *= 8;
            vertexIndex *= 3;
            glVertexBuffer[outVertexOffset+0] = this.positions[vertexIndex+0];
            glVertexBuffer[outVertexOffset+1] = this.positions[vertexIndex+1];
            glVertexBuffer[outVertexOffset+2] = this.positions[vertexIndex+2];
            glVertexBuffer[outVertexOffset+3] = this.normals[vertexIndex+0];
            glVertexBuffer[outVertexOffset+4] = this.normals[vertexIndex+1];
            glVertexBuffer[outVertexOffset+5] = this.normals[vertexIndex+2];
            glVertexBuffer[outVertexOffset+6] = texcoord[0]/this.textureWidth;
            glVertexBuffer[outVertexOffset+7] = texcoord[1]/this.textureHeight;
        };
        const generatePentagonVertices = (layerIndex, poleIndex, elementOffsetAtLayer, borderVertexCountAtLayer0) => {
            const shiftEast = (layerIndex == this.gpIndex*2 && poleIndex == 0);
            if(shiftEast) {
                fieldVertexTexcoord[0] += this.texcoordWidth*this.gpIndex*5;
                this.fieldVertexTexcoords[fieldVertexIndex*2] = fieldVertexTexcoord[0];
            }
            let outElementOffset = fieldVertexIndex*elementsPerFieldVertex;
            if(this.roundSurface)
                glElementBuffer[outElementOffset+0] = fieldVertexIndex;
            else
                --outElementOffset;
            for(let i = 0; i < 5; ++i)
                glElementBuffer[outElementOffset+i+1] = pentagonVertexOffset+i;
            glElementBuffer[outElementOffset+6] = glElementBuffer[outElementOffset+1];
            if(this.roundSurface)
                glElementBuffer[outElementOffset+7] = fieldVertexIndex;
            else
                --outElementOffset;
            glElementBuffer[outElementOffset+8] = primitiveRestartIndex;
            if(layerIndex == 0)
                for(let i = 4; i >= 0; --i)
                    generateVertex(borderVertexIndex+i, i);
            else if(layerIndex == this.gpIndex*3)
                for(let i = 0; i < 5; ++i)
                    generateVertex(borderVertexIndex-5+i, i);
            else if(poleIndex == 0) {
                if(layerIndex == this.gpIndex) {
                    generateVertex(borderVertexIndex, 0);
                    generateVertex(borderVertexIndex+elementOffsetAtLayer-5, 1);
                    generateVertex(borderVertexIndex+elementOffsetAtLayer-6, 2);
                    generateVertex(borderVertexIndex+elementOffsetAtLayer+borderVertexCountAtLayer0-7, 3);
                    generateVertex(borderVertexIndex+elementOffsetAtLayer-7, 4);
                } else {
                    generateVertex(borderVertexIndex+elementOffsetAtLayer-1, 0);
                    generateVertex(borderVertexIndex, 1);
                    generateVertex(borderVertexIndex+elementOffsetAtLayer, 2);
                    generateVertex(borderVertexIndex+elementOffsetAtLayer+borderVertexCountAtLayer0-1, 3);
                    generateVertex(borderVertexIndex+elementOffsetAtLayer-2, 4);
                }
            } else {
                generateVertex(borderVertexIndex, 0);
                if(layerIndex == this.gpIndex) {
                    elementOffsetAtLayer += poleIndex;
                    generateVertex(borderVertexIndex+elementOffsetAtLayer-5, 1);
                    generateVertex(borderVertexIndex+elementOffsetAtLayer-6, 2);
                    generateVertex(borderVertexIndex+elementOffsetAtLayer-7, 3);
                } else {
                    elementOffsetAtLayer -= poleIndex;
                    generateVertex(borderVertexIndex+1, 1);
                    generateVertex(borderVertexIndex+elementOffsetAtLayer+1, 2);
                    generateVertex(borderVertexIndex+elementOffsetAtLayer, 3);
                }
                generateVertex(borderVertexIndex-1, 4);
            }
            generateVertex(fieldVertexIndex++, 7);
            if(shiftEast)
                fieldVertexTexcoord[0] -= this.texcoordWidth*this.gpIndex*5;
        };
        // Combination loops
        generateTexcoord(0.5-this.gpIndex, this.gpIndex*2);
        generatePentagonVertices(0);
        for(let layerIndex = 1; layerIndex < this.gpIndex*3; ++layerIndex) {
            const hexY = this.gpIndex*3-layerIndex-1,
                  fieldVertexCountAtLayer = this.getFieldVertexCountPerEdgeAtLayer(layerIndex),
                  borderVertexCountAtLayer0 = this.getBorderVertexCountPerEdgeAtLayer(layerIndex)*5,
                  borderVertexCountAtLayer1 = this.getBorderVertexCountPerEdgeAtLayer(layerIndex-1),
                  borderVertexCountAtLayer2 = this.getBorderVertexCountPerEdgeAtLayer(layerIndex-2);
            let elementCountAtLayer;
            if(layerIndex < this.gpIndex)
                elementCountAtLayer = layerIndex*10+5;
            else if(layerIndex <= this.gpIndex*2) {
                elementCountAtLayer = this.gpIndex*10;
                if(layerIndex > this.gpIndex && layerIndex < this.gpIndex*2)
                    elementCountAtLayer += (layerIndex+1 == this.gpIndex*2) ? 1 : 2;
            } else
                elementCountAtLayer = (this.gpIndex*3-layerIndex)*10+5;
            for(let poleIndex = 0; poleIndex < 5; ++poleIndex) {
                let elementOffsetAtLayer = elementCountAtLayer;
                if(layerIndex < this.gpIndex-1)
                    elementOffsetAtLayer += poleIndex*2;
                else if(layerIndex == this.gpIndex-1)
                    elementOffsetAtLayer += poleIndex-1;
                else if(layerIndex == this.gpIndex)
                    ++elementOffsetAtLayer;
                else if(layerIndex == this.gpIndex*2+1)
                    elementOffsetAtLayer += (4-poleIndex);
                else if(layerIndex > this.gpIndex*2+1)
                    elementOffsetAtLayer += (4-poleIndex)*2;
                for(let indexInEdge = 0; indexInEdge < fieldVertexCountAtLayer; ++indexInEdge) {
                    const indexInLayer = fieldVertexCountAtLayer*poleIndex+indexInEdge,
                          isNotPole = (indexInEdge > 0 || layerIndex%this.gpIndex > 0);
                    let hexX = indexInEdge+this.gpIndex*poleIndex-this.gpIndex/2+0.5;
                    if(layerIndex > this.gpIndex*2)
                        hexX += layerIndex-this.gpIndex*2;
                    generateTexcoord(hexX, hexY);
                    if(indexInEdge == 0 && (poleIndex == 0 || layerIndex < this.gpIndex || layerIndex > this.gpIndex*2)) {
                        fieldVertexTexcoord[0] -= this.texcoordWidth;
                        if(layerIndex > this.gpIndex*2+1) {
                            generateVertex((poleIndex == 0)
                                ? borderVertexIndex-2
                                : borderVertexIndex-borderVertexCountAtLayer2*(5-poleIndex)-borderVertexCountAtLayer1*poleIndex-2
                            , 5);
                        }
                        if(isNotPole) {
                            let vertexIndex;
                            if(layerIndex > this.gpIndex*2)
                                vertexIndex = (poleIndex == 0) ? borderVertexIndex+borderVertexCountAtLayer1*5-1 : borderVertexIndex-1;
                            else if(layerIndex > this.gpIndex)
                                vertexIndex = borderVertexIndex+borderVertexCountAtLayer1*5-2;
                            else if(poleIndex == 0)
                                vertexIndex = borderVertexIndex+borderVertexCountAtLayer1*5+borderVertexCountAtLayer0-2;
                            else
                                vertexIndex = borderVertexIndex+borderVertexCountAtLayer0-(6-poleIndex)*2;
                            generateVertex(vertexIndex, 6);
                        }
                        fieldVertexTexcoord[0] += this.texcoordWidth;
                    }
                    if(isNotPole) {
                        let outElementOffset = fieldVertexIndex*elementsPerFieldVertex;
                        if(this.roundSurface)
                            glElementBuffer[outElementOffset+0] = fieldVertexIndex;
                        else
                            --outElementOffset;
                        glElementBuffer[outElementOffset+1] = outVertexIndex-1;
                        glElementBuffer[outElementOffset+2] = outVertexIndex;
                        glElementBuffer[outElementOffset+3] = outVertexIndex+1;
                        glElementBuffer[outElementOffset+4] = outVertexIndex+elementOffsetAtLayer+2;
                        glElementBuffer[outElementOffset+5] = outVertexIndex+elementOffsetAtLayer+1;
                        glElementBuffer[outElementOffset+6] = outVertexIndex+elementOffsetAtLayer;
                        if(this.roundSurface)
                            glElementBuffer[outElementOffset+7] = outVertexIndex-1;
                        else
                            --outElementOffset;
                        glElementBuffer[outElementOffset+8] = primitiveRestartIndex;
                        generateVertex(fieldVertexIndex++, 7);
                    } else
                        generatePentagonVertices(layerIndex, poleIndex, elementOffsetAtLayer, borderVertexCountAtLayer0);
                    let vertexIndex;
                    if(indexInEdge > 0 ||
                       (poleIndex == 0 && layerIndex > this.gpIndex*2) ||
                       (poleIndex > 0 && layerIndex > this.gpIndex))
                        vertexIndex = borderVertexIndex++;
                    else if(poleIndex == 0)
                        vertexIndex = borderVertexIndex+borderVertexCountAtLayer1*5-1;
                    else
                        vertexIndex = borderVertexIndex-1;
                    generateVertex(vertexIndex, 5);
                    generateVertex(borderVertexIndex++, 6);
                    if(indexInEdge+1 == fieldVertexCountAtLayer &&
                       (layerIndex > this.gpIndex*2 || (poleIndex == 4 && layerIndex > this.gpIndex))) {
                        fieldVertexTexcoord[0] += this.texcoordWidth;
                        generateVertex(borderVertexIndex++, 5);
                    }
                }
            }
        }
        for(let poleIndex = 0; poleIndex < 5; ++poleIndex) {
            const hexX = this.gpIndex*poleIndex-this.gpIndex/2+0.5 + this.gpIndex-1;
            generateTexcoord(hexX, -1);
            generateVertex(borderVertexIndex+((poleIndex == 0) ? -2 : poleIndex*2-17), 5);
            fieldVertexTexcoord[0] += this.texcoordWidth*0.5;
            fieldVertexTexcoord[1] -= this.texcoordHeight*0.25;
            generateVertex(borderVertexIndex+((poleIndex == 0) ? 4 : -1), 5);
            fieldVertexTexcoord[0] += this.texcoordWidth*0.5;
            fieldVertexTexcoord[1] += this.texcoordHeight*0.25;
            generateVertex(borderVertexIndex++, 5);
        }
        generateTexcoord(this.gpIndex*5, this.gpIndex-2);
        generatePentagonVertices(this.gpIndex*3);
        this.vertexArray = this.renderContext.createVertexArray(glVertexBuffer, glElementBuffer);
    }
}
