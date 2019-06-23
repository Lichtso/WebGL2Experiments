import {vec2, vec3} from './gl-matrix.js';

const hexWrenchFactor = Math.sqrt(3.0), // 2.0*Math.sin(Math.PI/6.0)
      pentagonRadiusByHexRadius = 1.0/(2.0*Math.sin(Math.PI/5.0)); // Math.sin(0.3*Math.PI)/Math.sin(0.4*Math.PI)

function vec3Slerp(out, a, b, t) {
    const cos = vec3.dot(a, b)/vec3.dot(a, a),
          angle = Math.acos(cos),
          aux = vec3.create();
    vec3.scale(aux, a, Math.sin((1.0-t)*angle));
    vec3.scaleAndAdd(aux, aux, b, Math.sin(t*angle));
    vec3.scale(out, aux, 1.0/Math.sqrt(1.0-cos*cos));
}

export class IcosahedralClass1GoldbergPolyhedron {
    constructor(renderContext, abandon, fieldsHaveCenterVertex, gpIndex, edgeLength3D, edgeLength2D) {
        this.renderContext = renderContext;
        this.abandon = abandon; // One of ['curvature', 'size', 'shape']
        this.gpIndex = gpIndex; // Number of fields along the edge between two poles (including one of the two poles)
        this.edgeLength3D = edgeLength3D;
        this.edgeLength2D = edgeLength2D;
        this.fieldsHaveCenterVertex = fieldsHaveCenterVertex;
        this.generateGeometry();
        this.generateTopology();
    }

    getFieldCountPerEdgeAtLayer(layerIndex) {
        return (layerIndex < this.gpIndex) ? layerIndex :
               (layerIndex <= this.gpIndex*2) ? this.gpIndex :
               this.gpIndex*3-layerIndex;
    }

    getBorderVertexCountPerEdgeAtLayer(layerIndex) {
        return (layerIndex < this.gpIndex) ? layerIndex*2+1 :
               (layerIndex < this.gpIndex*2) ? this.gpIndex*2 :
               (this.gpIndex*3-layerIndex)*2-1;
    }

    wrapIndexInLayer(indexInLayer, layerIndex) {
        return (layerIndex == 0 || layerIndex == this.gpIndex*3) ? 0 : indexInLayer%(this.getFieldCountPerEdgeAtLayer(layerIndex)*5);
    }

    getFieldIndex(indexInLayer, layerIndex) {
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

    getFieldPosition(indexInLayer, layerIndex) {
        const offset = this.getFieldIndex(indexInLayer, layerIndex)*3;
        return vec3.fromValues(this.positions[offset], this.positions[offset+1], this.positions[offset+2]);
    }

    /*getBorderVertexIndex(indexInLayer, layerIndex) {
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
    }*/

    getFieldCountAtLayer(layerIndex) {
        return (layerIndex == 0 || layerIndex == this.gpIndex*3) ? 1 :
               this.getFieldCountPerEdgeAtLayer(layerIndex)*5;
    }

    isPole(indexInLayer, layerIndex) {
        const fieldCountPerEdgeAtLayer = this.getFieldCountPerEdgeAtLayer(layerIndex);
        return (fieldCountPerEdgeAtLayer == 0 || (layerIndex%this.gpIndex == 0 && indexInLayer%fieldCountPerEdgeAtLayer == 0));
    }

    render() {
        this.renderContext.gl.bindVertexArray(this.vertexArray);
        this.renderContext.gl.drawElements(this.renderContext.gl.TRIANGLE_FAN, this.fieldCount*((this.fieldsHaveCenterVertex) ? 9 : 7), this.renderContext.gl.UNSIGNED_SHORT, 0);
    }

    cleanup() {
        this.renderContext.gl.deleteVertexArray(this.vertexArray);
    }

    generateGeometry() {
        // Initialize buffers, variables and constants
        this.icosahedronEdgeLength = this.gpIndex*this.edgeLength3D*hexWrenchFactor;
        this.sphereRadius = this.icosahedronEdgeLength*Math.sin(Math.PI*2.0/5.0); // this.icosahedronEdgeLength*0.25*Math.sqrt(10.0+2.0*Math.sqrt(5.0)); // https://en.wikipedia.org/wiki/Regular_icosahedron#Dimensions
        this.fieldCount = this.gpIndex*this.gpIndex*10+2;
        this.borderVertexCount = this.gpIndex*this.gpIndex*20;
        this.vertexCount = this.fieldCount+this.borderVertexCount;
        this.positions = new Float32Array(this.vertexCount*3);
        this.normals = new Float32Array(this.vertexCount*3);
        // Initialize generator functions
        const normal = vec3.create(),
              position = vec3.create();
        const generateVertex = (offset) => {
            offset *= 3;
            vec3.normalize(normal, position);
            this.normals[offset+0] = normal[0];
            this.normals[offset+1] = normal[1];
            this.normals[offset+2] = normal[2];
            if(this.abandon != 'curvature')
                vec3.scale(position, normal, this.sphereRadius);
            this.positions[offset+0] = position[0];
            this.positions[offset+1] = position[1];
            this.positions[offset+2] = position[2];
        };
        /* Interpolates the triangle (A, B, C) either linearly or spherically
         * s Goes from 0=B to 1=C
         * t Goes from 0=A to 1=BC
        */
        const vecAB = vec3.create(),
              vecAC = vec3.create();
        const interpolateTriangle = (this.abandon == 'shape')
            ? (a, b, c, s, t) => {
            vec3Slerp(vecAB, a, b, t);
            vec3Slerp(vecAC, a, c, t);
            vec3Slerp(position, vecAB, vecAC, s);
        }
            : (a, b, c, s, t) => {
            vec3.lerp(position, b, c, s);
            vec3.lerp(position, a, position, t);
        };
        /* Fills a triangle (A, B, C)
         * poleIndexInLayer and poleLayerIndex are defined at point A
         * fillEdge fills the fields between B and C
         * mode switches the direction (up or down) like this:

         if mode == 0:
         +--------------> X
         |
         |   B ------- C
         |    \       /
         |     \     /
         |      \   /
         |       \ /
         |        A
         |
         v Y

         if mode != 0:
         ^ Y
         |        A
         |       / \
         |      /   \
         |     /     \
         |    /       \
         |   B ------- C
         |
         +--------------> X
        */
        const fillTriangle = (poleIndexInLayer, poleLayerIndex, fillEdge, mode, a, b, c) => {
            for(let y = 1; y < this.gpIndex+fillEdge; ++y) {
                const layerIndex = this.gpIndex*poleLayerIndex+(mode > 0 ? -y : y),
                      indexInLayer = poleIndexInLayer*this.getFieldCountPerEdgeAtLayer(layerIndex)+((mode > 1) ? -y : 0);
                for(let x = 0; x < y; ++x) {
                    interpolateTriangle(a, b, c, x/y, y/this.gpIndex);
                    generateVertex(this.getFieldIndex(indexInLayer+x, layerIndex));
                }
            }
        };
        /* generateBorderVertex finds the border vertex O between the filed centers (A, B, C):
                 \
             A    )-----
                 /
           -----O    B
                 \
             C    )-----
                 /
        */
        let borderVertexIndex = this.fieldCount;
        const generateBorderVertex = (a, b, c) => {
            vec3.add(position, a, b);
            vec3.add(position, position, c);
            if(this.abandon == 'curvature')
                vec3.scale(position, position, 1.0/3.0);
            generateVertex(borderVertexIndex++);
        };
        // Generate 12 icosahedron poles
        const southPole = vec3.fromValues(0, -this.sphereRadius, 0),
              northPole = vec3.fromValues(0, this.sphereRadius, 0);
        vec3.copy(position, southPole);
        generateVertex(this.getFieldIndex(0, 0));
        vec3.copy(position, northPole);
        generateVertex(this.getFieldIndex(0, this.gpIndex*3));
        const southernPoles = [], northernPoles = [],
              pentagonY = 1.0/Math.sqrt(5.0)*this.sphereRadius,
              pentagonRadius = 2.0/Math.sqrt(5.0)*this.sphereRadius;
        for(let i = 0; i < 5; ++i) {
            const angle = i*Math.PI*2.0/5.0;
            position[0] = Math.sin(angle)*pentagonRadius;
            position[1] = pentagonY;
            position[2] = Math.cos(angle)*pentagonRadius;
            northernPoles.push(vec3.clone(position));
            vec3.scale(position, position, -1.0);
            southernPoles.push(vec3.clone(position));
        }
        /* Generate field vertices (interpolation)
           Each iteration generates a stripe of 4 triangles (A, B, C, D):
              * northPole
             / \
            / D \
           *-----* northernPoles
            \ C / \
             \ / B \
              *-----* southernPoles
               \ A /
                \ /
                 *  southPole

           All 5 iterations result in 20 triangles (A - T):
              *     *     *     *     * northPole
             / \   / \   / \   / \   / \
            / D \ / H \ / L \ / P \ / T \
           *-----*-----*-----*-----*-----* northernPoles
            \ C / \ G / \ K / \ O / \ S / \
             \ / B \ / F \ / J \ / N \ / R \
              *-----*-----*-----*-----*-----* southernPoles
               \ A / \ E / \ I / \ M / \ Q /
                \ /   \ /   \ /   \ /   \ /
                 *     *     *     *     * southPole
        */
        for(let poleIndex = 0; poleIndex < 5; ++poleIndex) {
            const i0 = poleIndex, i1 = (poleIndex+1)%5, i2 = (poleIndex+2)%5, i3 = (poleIndex+3)%5;
            fillTriangle(poleIndex,   0, 0, 0, southPole, southernPoles[i0], southernPoles[i1]); // Triangle A
            fillTriangle(poleIndex+1, 2, 1, 2, northernPoles[i3], southernPoles[i0], southernPoles[i1]); // Triangle B
            fillTriangle(poleIndex,   1, 1, 0, southernPoles[i0], northernPoles[i2], northernPoles[i3]); // Triangle C
            fillTriangle(poleIndex,   3, 0, 1, northPole, northernPoles[i2], northernPoles[i3]); // Triangle D
        }
        /* Generate border vertices (tesselation)
           Each layer is generated using a tirangle strip:
                 *-----------*-----------*-----------*  ...  * upperFiledVertex
                / \         / \         / \         /       /
               /   \   O   /   \   O   /   \   O   /       / borderVertex
              /     \     /     \     /     \     /  ...  /
             /   O   \   /   O   \   /   O   \   /       / borderVertex
            /         \ /         \ /         \ /       /
           *-----------*-----------*-----------*  ...  * lowerFiledVertex
        */
        for(let layerIndex = 0; layerIndex <= this.gpIndex*3; ++layerIndex) {
            const borderVertexCountAtLayer = this.getBorderVertexCountPerEdgeAtLayer(layerIndex),
                  hemiSphere = (layerIndex < this.gpIndex*2) ? 0 : 1;
            let lowerIndex = 0, upperIndex = 0,
                lowerFiledVertex = this.getFieldPosition(lowerIndex, layerIndex),
                upperFiledVertex = this.getFieldPosition(upperIndex, layerIndex+1);
            for(let poleIndex = 0; poleIndex < 5; ++poleIndex)
                for(let indexInEdge = 0; indexInEdge < borderVertexCountAtLayer; ++indexInEdge) {
                    if(indexInEdge%2 == hemiSphere) { // Downward Triangle
                        const prevUpperFiledVertex = upperFiledVertex;
                        upperIndex = this.wrapIndexInLayer(upperIndex+1, layerIndex+1);
                        upperFiledVertex = this.getFieldPosition(upperIndex, layerIndex+1);
                        generateBorderVertex(lowerFiledVertex, upperFiledVertex, prevUpperFiledVertex);
                    } else { // Upward Triangle
                        const prevLowerFiledVertex = lowerFiledVertex;
                        lowerIndex = this.wrapIndexInLayer(lowerIndex+1, layerIndex);
                        lowerFiledVertex = this.getFieldPosition(lowerIndex, layerIndex);
                        generateBorderVertex(lowerFiledVertex, upperFiledVertex, prevLowerFiledVertex);
                    }
                }
        }
    }

    generateTopology() {
        // Initialize buffers, variables and constants
        let fieldIndex = 0,
            outVertexIndex = 0,
            pentagonVertexOffset = 20*(this.gpIndex*this.gpIndex+this.gpIndex)+2*this.gpIndex-11;
        if(this.fieldsHaveCenterVertex) {
            outVertexIndex += this.fieldCount;
            pentagonVertexOffset += this.fieldCount;
        }
        const primitiveRestartIndex = 65535,
              elementsPerField = (this.fieldsHaveCenterVertex) ? 9 : 7,
              glElementBuffer = new Uint16Array(this.fieldCount*elementsPerField),
              glVertexBuffer = new Float32Array((pentagonVertexOffset+12*5)*8);
        this.fieldTexcoords = new Float32Array(this.fieldCount*2);
        this.texcoordHeight = Math.ceil(this.edgeLength2D)*2;
        this.texcoordWidth = Math.ceil(this.edgeLength2D*hexWrenchFactor);
        this.texcoordPentagonRadius = this.edgeLength2D*pentagonRadiusByHexRadius;
        this.textureWidth = this.texcoordWidth*(this.gpIndex*5.5-0.5),
        this.textureHeight = this.texcoordHeight*(this.gpIndex*2.25-0.5);
        // Initialize generator functions
        const texcoord = vec2.create(),
              fieldTexcoord = vec2.create(),
              texcoordDiagonal = vec2.fromValues(this.texcoordWidth*0.5, this.texcoordHeight*3/4);
        const generateTexcoord = (hexX, hexY) => {
            vec3.scale(fieldTexcoord, texcoordDiagonal, hexY);
            fieldTexcoord[0] += hexX*this.texcoordWidth;
            fieldTexcoord[1] += this.texcoordHeight*0.5;
            const vertexOffset = fieldIndex*2;
            this.fieldTexcoords[vertexOffset+0] = fieldTexcoord[0];
            this.fieldTexcoords[vertexOffset+1] = fieldTexcoord[1];
        };
        const generateVertex = (vertexIndex, direction) => {
            vec2.copy(texcoord, fieldTexcoord);
            if(direction < 5) {
                const angle = Math.PI*2/5*direction+((fieldIndex < this.fieldCount/2) ? Math.PI*0.2 : 0);
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
                if(!this.fieldsHaveCenterVertex)
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
        // Copy and interleave vertices
        let borderVertexIndex = this.fieldCount;
        const generatePentagonVertices = (layerIndex, poleIndex, elementOffsetAtLayer, borderVertexCountAtLayer0) => {
            const shiftEast = (layerIndex == this.gpIndex*2 && poleIndex == 0);
            if(shiftEast) {
                fieldTexcoord[0] += this.texcoordWidth*this.gpIndex*5;
                this.fieldTexcoords[fieldIndex*2] = fieldTexcoord[0];
            }
            let outElementOffset = fieldIndex*elementsPerField;
            if(this.fieldsHaveCenterVertex)
                glElementBuffer[outElementOffset+0] = fieldIndex;
            else
                --outElementOffset;
            for(let i = 0; i < 5; ++i)
                glElementBuffer[outElementOffset+i+1] = pentagonVertexOffset+i;
            glElementBuffer[outElementOffset+6] = glElementBuffer[outElementOffset+1];
            if(this.fieldsHaveCenterVertex)
                glElementBuffer[outElementOffset+7] = fieldIndex;
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
            generateVertex(fieldIndex++, 7);
            if(shiftEast)
                fieldTexcoord[0] -= this.texcoordWidth*this.gpIndex*5;
        };
        // Combination loops
        generateTexcoord(0.5-this.gpIndex, this.gpIndex*2);
        generatePentagonVertices(0);
        for(let layerIndex = 1; layerIndex < this.gpIndex*3; ++layerIndex) {
            const hexY = this.gpIndex*3-layerIndex-1,
                  fieldCountAtLayer = this.getFieldCountPerEdgeAtLayer(layerIndex),
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
                for(let indexInEdge = 0; indexInEdge < fieldCountAtLayer; ++indexInEdge) {
                    const indexInLayer = fieldCountAtLayer*poleIndex+indexInEdge,
                          isNotPole = (indexInEdge > 0 || layerIndex%this.gpIndex > 0);
                    let hexX = indexInEdge+this.gpIndex*poleIndex-this.gpIndex/2+0.5;
                    if(layerIndex > this.gpIndex*2)
                        hexX += layerIndex-this.gpIndex*2;
                    generateTexcoord(hexX, hexY);
                    if(indexInEdge == 0 && (poleIndex == 0 || layerIndex < this.gpIndex || layerIndex > this.gpIndex*2)) {
                        fieldTexcoord[0] -= this.texcoordWidth;
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
                        fieldTexcoord[0] += this.texcoordWidth;
                    }
                    if(isNotPole) {
                        let outElementOffset = fieldIndex*elementsPerField;
                        if(this.fieldsHaveCenterVertex)
                            glElementBuffer[outElementOffset+0] = fieldIndex;
                        else
                            --outElementOffset;
                        glElementBuffer[outElementOffset+1] = outVertexIndex-1;
                        glElementBuffer[outElementOffset+2] = outVertexIndex;
                        glElementBuffer[outElementOffset+3] = outVertexIndex+1;
                        glElementBuffer[outElementOffset+4] = outVertexIndex+elementOffsetAtLayer+2;
                        glElementBuffer[outElementOffset+5] = outVertexIndex+elementOffsetAtLayer+1;
                        glElementBuffer[outElementOffset+6] = outVertexIndex+elementOffsetAtLayer;
                        if(this.fieldsHaveCenterVertex)
                            glElementBuffer[outElementOffset+7] = outVertexIndex-1;
                        else
                            --outElementOffset;
                        glElementBuffer[outElementOffset+8] = primitiveRestartIndex;
                        generateVertex(fieldIndex++, 7);
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
                    if(indexInEdge+1 == fieldCountAtLayer &&
                       (layerIndex > this.gpIndex*2 || (poleIndex == 4 && layerIndex > this.gpIndex))) {
                        fieldTexcoord[0] += this.texcoordWidth;
                        generateVertex(borderVertexIndex++, 5);
                    }
                }
            }
        }
        for(let poleIndex = 0; poleIndex < 5; ++poleIndex) {
            const hexX = this.gpIndex*poleIndex-this.gpIndex/2+0.5 + this.gpIndex-1;
            generateTexcoord(hexX, -1);
            generateVertex(borderVertexIndex+((poleIndex == 0) ? -2 : poleIndex*2-17), 5);
            fieldTexcoord[0] += this.texcoordWidth*0.5;
            fieldTexcoord[1] -= this.texcoordHeight*0.25;
            generateVertex(borderVertexIndex+((poleIndex == 0) ? 4 : -1), 5);
            fieldTexcoord[0] += this.texcoordWidth*0.5;
            fieldTexcoord[1] += this.texcoordHeight*0.25;
            generateVertex(borderVertexIndex++, 5);
        }
        generateTexcoord(this.gpIndex*5, this.gpIndex-2);
        generatePentagonVertices(this.gpIndex*3);
        this.vertexArray = this.renderContext.createVertexArray(glVertexBuffer, glElementBuffer);
    }
}
