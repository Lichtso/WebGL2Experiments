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

function createSvgElement(tag, parentNode) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if(parentNode)
        parentNode.appendChild(node);
    return node;
}

const svgElement = createSvgElement('svg');
svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
svgElement.setAttribute('text-anchor', 'middle');
svgElement.setAttribute('font-family', 'Helvetica');
svgElement.setAttribute('font-size', '12');
const defs = createSvgElement('defs', svgElement),
      outlineFilter = createSvgElement('filter', defs),
      feMorphology = createSvgElement('feMorphology', outlineFilter),
      feMerge = createSvgElement('feMerge', outlineFilter),
      feMergeNodeA = createSvgElement('feMergeNode', feMerge),
      feMergeNodeB = createSvgElement('feMergeNode', feMerge),
      pentagonElement = createSvgElement('path', defs),
      hexagonElement = createSvgElement('path', defs),
      groundLayer = createSvgElement('g', svgElement),
      gridLayer = createSvgElement('g', svgElement);
outlineFilter.setAttribute('id', 'outlineFilter');
feMorphology.setAttribute('id', 'SourceAlpha');
feMorphology.setAttribute('result', 'dilated');
feMorphology.setAttribute('operator', 'dilate');
feMorphology.setAttribute('radius', '1');
feMergeNodeA.setAttribute('in', 'dilated');
feMergeNodeB.setAttribute('in', 'SourceGraphic');
groundLayer.setAttribute('shape-rendering', 'crispEdges');

export class IcosahedralClass1GoldbergPolyhedron {
    constructor(renderContext, abandon, fieldsHaveCenterVertex, gpIndex, edgeLength3D, edgeLength2D) {
        this.renderContext = renderContext;
        this.abandon = abandon; // One of ['curvature', 'size', 'shape']
        this.gpIndex = gpIndex; // Number of fields along the edge between two poles (including one of the two poles)
        this.edgeLength3D = edgeLength3D;
        this.edgeLength2D = edgeLength2D;
        this.fieldsHaveCenterVertex = fieldsHaveCenterVertex;
        this.generateGeometry();
        this.generateTopologyAndTexcoords();
    }

    getBorderVertexCountPerEdgeAtLayer(layerIndex) {
        return (layerIndex < this.gpIndex) ? layerIndex*2+1 :
               (layerIndex < this.gpIndex*2) ? this.gpIndex*2 :
               (this.gpIndex*3-layerIndex)*2-1;
    }

    getFieldCountInStripeLayer(layerIndex) {
        return (layerIndex < this.gpIndex) ? layerIndex :
               (layerIndex <= this.gpIndex*2) ? this.gpIndex :
               this.gpIndex*3-layerIndex;
    }

    getFieldCountInLayer(layerIndex) {
        return (layerIndex == 0 || layerIndex == this.gpIndex*3) ? 1 :
               this.getFieldCountInStripeLayer(layerIndex)*5;
    }

    wrapIndexInLayer(indexInLayer, layerIndex) {
        return indexInLayer%this.getFieldCountInLayer(layerIndex);
    }

    isPole(indexInStripeLayer, layerIndex) {
        return (indexInStripeLayer == 0 && layerIndex%this.gpIndex == 0);
    }

    indexInLayerToIndexInStripeLayerAndStripeIndex(indexInLayer, layerIndex) {
        if(layerIndex == 0 || layerIndex == this.gpIndex*3)
            return [0, 0];
        const fieldCountInStripeLayer = this.getFieldCountInStripeLayer(layerIndex),
              indexInStripeLayer = indexInLayer%fieldCountInStripeLayer,
              stripeIndex = Math.floor(indexInLayer/fieldCountInStripeLayer);
        return [indexInStripeLayer, stripeIndex];
    }

    indexInStripeLayerAndStripeIndexToIndexInLayer(indexInStripeLayer, stripeIndex, layerIndex) {
        return indexInStripeLayer+stripeIndex*this.getFieldCountInStripeLayer(layerIndex);
    }

    positionInLayerToIndexInStripeLayerAndStripeIndex(positionInLayer, layerIndex) {
        if(layerIndex > this.gpIndex*2)
            positionInLayer -= layerIndex-this.gpIndex*2;
        const stripeIndex = Math.floor(positionInLayer/this.gpIndex),
              indexInStripeLayer = positionInLayer%this.gpIndex;
        return [indexInStripeLayer, stripeIndex];
    }

    indexInStripeLayerAndStripeIndexToPositionInLayer(indexInStripeLayer, stripeIndex, layerIndex) {
        let positionInLayer = indexInStripeLayer+this.gpIndex*stripeIndex;
        if(layerIndex > this.gpIndex*2)
            positionInLayer += layerIndex-this.gpIndex*2;
        return positionInLayer;
    }

    getAntipodalIndexInLayerAndLayerIndex(indexInLayer, layerIndex) {
        const newLayerIndex = this.gpIndex*3-layerIndex;
        indexInLayer += (layerIndex < this.gpIndex) ? layerIndex*3 :
                       (layerIndex <= 2*this.gpIndex) ? newLayerIndex+this.gpIndex :
                       newLayerIndex*2;
        return [this.wrapIndexInLayer(indexInLayer, layerIndex), newLayerIndex];
    }

    indexInLayerToIndexInTotal(indexInLayer, layerIndex) {
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

    getFieldPosition3D(out, indexInLayer, layerIndex) {
        const offset = this.indexInLayerToIndexInTotal(indexInLayer, layerIndex)*3;
        for(let i = 0; i < 3; ++i)
            out[i] = this.positions[offset+i];
    }

    getFieldPosition2D(out, indexInStripeLayer, stripeIndex, layerIndex) {
        if(layerIndex == 0) {
            indexInStripeLayer = -1;
            ++layerIndex;
        } else if(layerIndex == this.gpIndex*3) {
            stripeIndex = 4;
            indexInStripeLayer = 1;
            --layerIndex;
        } else if(layerIndex == this.gpIndex*2 && indexInStripeLayer == 0 && stripeIndex == 0)
            stripeIndex += 5;
        const positionInLayer = this.indexInStripeLayerAndStripeIndexToPositionInLayer(indexInStripeLayer, stripeIndex, layerIndex),
              hexX = positionInLayer+0.5-this.gpIndex*0.5,
              hexY = this.gpIndex*3-layerIndex-1;
        out[0] = this.fieldWidth2D*(0.5*hexY+hexX);
        out[1] = this.fieldHeight2D*(0.75*hexY+0.5);
    }

    getBorderTexcoord(out, fieldPosition2D, direction, hemisphere) {
        vec2.copy(out, fieldPosition2D);
        if(typeof direction == 'number') {
            const angle = Math.PI*2/5*direction+((hemisphere) ? 0 : Math.PI*0.2);
            out[0] += Math.sin(angle)*this.pentagonRadius2D;
            out[1] += Math.cos(angle)*this.pentagonRadius2D;
        } else
            switch(direction) {
                case 'South':
                    out[1] += this.fieldHeight2D*0.5;
                    break;
                case 'SouthEast':
                    out[0] += this.fieldWidth2D*0.5;
                    out[1] += this.fieldHeight2D*0.25;
                    break;
                case 'NorthEast':
                    out[0] += this.fieldWidth2D*0.5;
                    out[1] -= this.fieldHeight2D*0.25;
                    break;
                case 'North':
                    out[1] -= this.fieldHeight2D*0.5;
                    break;
                case 'NorthWest':
                    out[0] -= this.fieldWidth2D*0.5;
                    out[1] -= this.fieldHeight2D*0.25;
                    break;
                case 'SouthWest':
                    out[0] -= this.fieldWidth2D*0.5;
                    out[1] += this.fieldHeight2D*0.25;
                    break;
            }
        out[0] /= this.textureWidth;
        out[1] /= this.textureHeight;
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
         * stripeIndexAtA and layerIndexAtA are defined at point A
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
        const fillTriangle = (stripeIndexAtA, layerIndexAtA, fillEdge, mode, a, b, c) => {
            for(let y = 1; y < this.gpIndex+fillEdge; ++y) {
                const layerIndex = this.gpIndex*layerIndexAtA+(mode > 0 ? -y : y),
                      indexInLayer = stripeIndexAtA*this.getFieldCountInStripeLayer(layerIndex)+((mode > 1) ? -y : 0);
                for(let x = 0; x < y; ++x) {
                    interpolateTriangle(a, b, c, x/y, y/this.gpIndex);
                    generateVertex(this.indexInLayerToIndexInTotal(indexInLayer+x, layerIndex));
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
        generateVertex(this.indexInLayerToIndexInTotal(0, 0));
        vec3.copy(position, northPole);
        generateVertex(this.indexInLayerToIndexInTotal(0, this.gpIndex*3));
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
        /* Generate center vertices (interpolation)
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
        for(let stripeIndex = 0; stripeIndex < 5; ++stripeIndex) {
            const i0 = stripeIndex, i1 = (stripeIndex+1)%5, i2 = (stripeIndex+2)%5, i3 = (stripeIndex+3)%5;
            fillTriangle(stripeIndex,   0, 0, 0, southPole, southernPoles[i0], southernPoles[i1]); // Triangle A
            fillTriangle(stripeIndex+1, 2, 1, 2, northernPoles[i3], southernPoles[i0], southernPoles[i1]); // Triangle B
            fillTriangle(stripeIndex,   1, 1, 0, southernPoles[i0], northernPoles[i2], northernPoles[i3]); // Triangle C
            fillTriangle(stripeIndex,   3, 0, 1, northPole, northernPoles[i2], northernPoles[i3]); // Triangle D
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
        const lowerFiledVertex = vec3.create(),
              upperFiledVertex = vec3.create(),
              prevLowerFiledVertex = vec3.create(),
              prevUpperFiledVertex = vec3.create();
        for(let layerIndex = 0; layerIndex <= this.gpIndex*3; ++layerIndex) {
            const borderVertexCountAtLayer = this.getBorderVertexCountPerEdgeAtLayer(layerIndex),
                  hemisphere = (layerIndex < this.gpIndex*2) ? 0 : 1;
            let lowerIndex = 0, upperIndex = 0;
            this.getFieldPosition3D(lowerFiledVertex, lowerIndex, layerIndex);
            this.getFieldPosition3D(upperFiledVertex, upperIndex, layerIndex+1);
            for(let stripeIndex = 0; stripeIndex < 5; ++stripeIndex)
                for(let indexInStripeLayer = 0; indexInStripeLayer < borderVertexCountAtLayer; ++indexInStripeLayer) {
                    if(indexInStripeLayer%2 == hemisphere) { // Downward Triangle
                        vec3.copy(prevUpperFiledVertex, upperFiledVertex);
                        upperIndex = this.wrapIndexInLayer(upperIndex+1, layerIndex+1);
                        this.getFieldPosition3D(upperFiledVertex, upperIndex, layerIndex+1);
                        generateBorderVertex(lowerFiledVertex, upperFiledVertex, prevUpperFiledVertex);
                    } else { // Upward Triangle
                        vec3.copy(prevLowerFiledVertex, lowerFiledVertex);
                        lowerIndex = this.wrapIndexInLayer(lowerIndex+1, layerIndex);
                        this.getFieldPosition3D(lowerFiledVertex, lowerIndex, layerIndex);
                        generateBorderVertex(lowerFiledVertex, upperFiledVertex, prevLowerFiledVertex);
                    }
                }
        }
    }

    generateTopologyAndTexcoords() {
        // Initialize buffers, variables and constants
        this.pentagonRadius2D = this.edgeLength2D*pentagonRadiusByHexRadius;
        this.fieldHeight2D = Math.ceil(this.edgeLength2D)*2;
        this.fieldWidth2D = Math.ceil(this.edgeLength2D*hexWrenchFactor);
        this.textureWidth = this.fieldWidth2D*(this.gpIndex*5.5-0.5),
        this.textureHeight = this.fieldHeight2D*(this.gpIndex*2.25-0.5);
        let indexInTotal = 0,
            outVertexIndex = 0,
            borderVertexIndex = this.fieldCount,
            pentagonVertexOffset = 20*(this.gpIndex*this.gpIndex+this.gpIndex)+2*this.gpIndex-11;
        if(this.fieldsHaveCenterVertex) {
            outVertexIndex += this.fieldCount;
            pentagonVertexOffset += this.fieldCount;
        }
        const primitiveRestartIndex = 65535,
              elementsPerField = (this.fieldsHaveCenterVertex) ? 9 : 7,
              glElementBuffer = new Uint16Array(this.fieldCount*elementsPerField),
              glVertexBuffer = new Float32Array((pentagonVertexOffset+12*5)*8),
              fieldPosition2D = vec2.create();
        // Initialize generator functions
        const generateVertex = (vertexIndex, direction) => {
            let outVertexOffset;
            if(direction < 5)
                outVertexOffset = pentagonVertexOffset++;
            else if(direction != 'Close')
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
            this.getBorderTexcoord(glVertexBuffer.subarray(outVertexOffset+6, outVertexOffset+8), fieldPosition2D, direction, indexInTotal > this.fieldCount/2);
        };
        const generatePoleVertices = (layerIndex, stripeIndex, elementOffsetAtLayer, borderVertexCountAtLayer0) => {
            let outElementOffset = indexInTotal*elementsPerField;
            if(this.fieldsHaveCenterVertex)
                glElementBuffer[outElementOffset+0] = indexInTotal;
            else
                --outElementOffset;
            for(let i = 0; i < 5; ++i)
                glElementBuffer[outElementOffset+i+1] = pentagonVertexOffset+i;
            glElementBuffer[outElementOffset+6] = glElementBuffer[outElementOffset+1];
            if(this.fieldsHaveCenterVertex)
                glElementBuffer[outElementOffset+7] = indexInTotal;
            else
                --outElementOffset;
            glElementBuffer[outElementOffset+8] = primitiveRestartIndex;
            if(layerIndex == 0) // South Pole
                for(let i = 4; i >= 0; --i)
                    generateVertex(borderVertexIndex+i, i);
            else if(layerIndex == this.gpIndex*3) // North Pole
                for(let i = 0; i < 5; ++i)
                    generateVertex(borderVertexIndex-5+i, i);
            else if(stripeIndex == 0) { // Western Poles
                if(layerIndex == this.gpIndex) { // Southern Pole
                    generateVertex(borderVertexIndex, 0);
                    generateVertex(borderVertexIndex+elementOffsetAtLayer-5, 1);
                    generateVertex(borderVertexIndex+elementOffsetAtLayer-6, 2);
                    generateVertex(borderVertexIndex+elementOffsetAtLayer+borderVertexCountAtLayer0-7, 3);
                    generateVertex(borderVertexIndex+elementOffsetAtLayer-7, 4);
                } else { // Northern Pole
                    generateVertex(borderVertexIndex+elementOffsetAtLayer-1, 0);
                    generateVertex(borderVertexIndex, 1);
                    generateVertex(borderVertexIndex+elementOffsetAtLayer, 2);
                    generateVertex(borderVertexIndex+elementOffsetAtLayer+borderVertexCountAtLayer0-1, 3);
                    generateVertex(borderVertexIndex+elementOffsetAtLayer-2, 4);
                    fieldPosition2D[0] -= this.fieldWidth2D*this.gpIndex*5;
                }
            } else { // Other Poles
                generateVertex(borderVertexIndex, 0);
                if(layerIndex == this.gpIndex) { // Southern Poles
                    elementOffsetAtLayer += stripeIndex;
                    generateVertex(borderVertexIndex+elementOffsetAtLayer-5, 1);
                    generateVertex(borderVertexIndex+elementOffsetAtLayer-6, 2);
                    generateVertex(borderVertexIndex+elementOffsetAtLayer-7, 3);
                } else { // Northern Poles
                    elementOffsetAtLayer -= stripeIndex;
                    generateVertex(borderVertexIndex+1, 1);
                    generateVertex(borderVertexIndex+elementOffsetAtLayer+1, 2);
                    generateVertex(borderVertexIndex+elementOffsetAtLayer, 3);
                }
                generateVertex(borderVertexIndex-1, 4);
            }
            generateVertex(indexInTotal++, 'Close');
        };
        // Generate south pole
        this.getFieldPosition2D(fieldPosition2D, 0, 0, 0);
        generatePoleVertices(0);
        // Copy and interleave vertices
        for(let layerIndex = 1; layerIndex < this.gpIndex*3; ++layerIndex) {
            const fieldCountInStripeLayer = this.getFieldCountInStripeLayer(layerIndex),
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
            for(let stripeIndex = 0; stripeIndex < 5; ++stripeIndex) {
                let elementOffsetAtLayer = elementCountAtLayer;
                if(layerIndex < this.gpIndex-1)
                    elementOffsetAtLayer += stripeIndex*2;
                else if(layerIndex == this.gpIndex-1)
                    elementOffsetAtLayer += stripeIndex-1;
                else if(layerIndex == this.gpIndex)
                    ++elementOffsetAtLayer;
                else if(layerIndex == this.gpIndex*2+1)
                    elementOffsetAtLayer += (4-stripeIndex);
                else if(layerIndex > this.gpIndex*2+1)
                    elementOffsetAtLayer += (4-stripeIndex)*2;
                for(let indexInStripeLayer = 0; indexInStripeLayer < fieldCountInStripeLayer; ++indexInStripeLayer) {
                    const indexInLayer = fieldCountInStripeLayer*stripeIndex+indexInStripeLayer,
                          isNotPole = (indexInStripeLayer > 0 || layerIndex%this.gpIndex > 0);
                    this.getFieldPosition2D(fieldPosition2D, indexInStripeLayer, stripeIndex, layerIndex);
                    if(indexInStripeLayer == 0 && (stripeIndex == 0 || layerIndex < this.gpIndex || layerIndex > this.gpIndex*2)) { // Seam edge
                        fieldPosition2D[0] -= this.fieldWidth2D;
                        if(layerIndex > this.gpIndex*2+1)
                            generateVertex((stripeIndex == 0)
                                ? borderVertexIndex-2
                                : borderVertexIndex-borderVertexCountAtLayer2*(5-stripeIndex)-borderVertexCountAtLayer1*stripeIndex-2
                            , 'South');
                        if(isNotPole) {
                            let vertexIndex;
                            if(layerIndex > this.gpIndex*2)
                                vertexIndex = (stripeIndex == 0) ? borderVertexIndex+borderVertexCountAtLayer1*5-1 : borderVertexIndex-1;
                            else if(layerIndex > this.gpIndex)
                                vertexIndex = borderVertexIndex+borderVertexCountAtLayer1*5-2;
                            else if(stripeIndex == 0)
                                vertexIndex = borderVertexIndex+borderVertexCountAtLayer1*5+borderVertexCountAtLayer0-2;
                            else
                                vertexIndex = borderVertexIndex+borderVertexCountAtLayer0-(6-stripeIndex)*2;
                            generateVertex(vertexIndex, 'SouthEast');
                        }
                        fieldPosition2D[0] += this.fieldWidth2D;
                    }
                    if(isNotPole) {
                        let outElementOffset = indexInTotal*elementsPerField;
                        if(this.fieldsHaveCenterVertex)
                            glElementBuffer[outElementOffset+0] = indexInTotal;
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
                        generateVertex(indexInTotal++, 'Close');
                    } else
                        generatePoleVertices(layerIndex, stripeIndex, elementOffsetAtLayer, borderVertexCountAtLayer0);
                    let vertexIndex;
                    if(indexInStripeLayer > 0 ||
                       (stripeIndex == 0 && layerIndex > this.gpIndex*2) ||
                       (stripeIndex > 0 && layerIndex > this.gpIndex))
                        vertexIndex = borderVertexIndex++;
                    else if(stripeIndex == 0)
                        vertexIndex = borderVertexIndex+borderVertexCountAtLayer1*5-1;
                    else
                        vertexIndex = borderVertexIndex-1;
                    generateVertex(vertexIndex, 'South');
                    generateVertex(borderVertexIndex++, 'SouthEast');
                    if(indexInStripeLayer+1 == fieldCountInStripeLayer &&
                       (layerIndex > this.gpIndex*2 || (stripeIndex == 4 && layerIndex > this.gpIndex))) {
                        fieldPosition2D[0] += this.fieldWidth2D;
                        generateVertex(borderVertexIndex++, 'South');
                    }
                }
            }
        }
        // Generate north crown
        for(let stripeIndex = 0; stripeIndex < 5; ++stripeIndex) {
            this.getFieldPosition2D(fieldPosition2D, 0, stripeIndex, this.gpIndex*3-1);
            generateVertex(borderVertexIndex+((stripeIndex == 0) ? -2 : stripeIndex*2-17), 'NorthWest');
            generateVertex(borderVertexIndex+((stripeIndex == 0) ? 4 : -1), 'North');
            generateVertex(borderVertexIndex++, 'NorthEast');
        }
        // Generate north pole
        this.getFieldPosition2D(fieldPosition2D, 0, 0, this.gpIndex*3);
        generatePoleVertices(this.gpIndex*3);
        // Create render buffers
        this.vertexArray = this.renderContext.createVertexArray(glVertexBuffer, glElementBuffer);
    }

    generateTexture() {
        this.texture = this.renderContext.createTexture(this.renderContext.gl.LINEAR_MIPMAP_LINEAR, this.renderContext.gl.LINEAR);
        while(groundLayer.hasChildNodes())
            groundLayer.removeChild(groundLayer.lastChild);
        while(gridLayer.hasChildNodes())
            gridLayer.removeChild(gridLayer.lastChild);
        svgElement.setAttribute('width', this.textureWidth);
        svgElement.setAttribute('height', this.textureHeight);
        let path = '';
        for(let i = 0; i < 5; ++i) {
            const angle = Math.PI*2/5*i;
            path += (i == 0) ? 'M' : 'L';
            path += Math.round(Math.sin(angle)*this.pentagonRadius2D)+','+Math.round(Math.cos(angle)*this.pentagonRadius2D);
        }
        pentagonElement.setAttribute('id', 'pentagon');
        pentagonElement.setAttribute('d', path+'Z');
        hexagonElement.setAttribute('id', 'hexagon');
        hexagonElement.setAttribute('d',
            'M'+(this.fieldWidth2D*0.5)+','+(this.fieldHeight2D*0.25)+
            'L'+(this.fieldWidth2D*0.5)+','+(-this.fieldHeight2D*0.25)+
            'L0,'+(-this.fieldHeight2D*0.5)+
            'L'+(-this.fieldWidth2D*0.5)+','+(-this.fieldHeight2D*0.25)+
            'L'+(-this.fieldWidth2D*0.5)+','+(this.fieldHeight2D*0.25)+
            'L0,'+(this.fieldHeight2D*0.5)+
            'Z'
        );
        groundLayer.setAttribute('filter', 'url(#outlineFilter)');
        const position2D = vec2.create();
        const generateField = (indexInStripeLayer, stripeIndex, layerIndex) => {
            const isPole = this.isPole(indexInStripeLayer, layerIndex),
                  indexInLayer = this.indexInStripeLayerAndStripeIndexToIndexInLayer(indexInStripeLayer, stripeIndex, layerIndex),
                  tileElement = createSvgElement('use', groundLayer),
                  textElement = createSvgElement('text', gridLayer),
                  borderElement = createSvgElement('use', gridLayer);
            this.getFieldPosition2D(position2D, indexInStripeLayer, stripeIndex, layerIndex);
            tileElement.setAttribute('transform', 'translate('+position2D[0]+','+position2D[1]+')'+((isPole && layerIndex < this.gpIndex*1.5) ? ' rotate(37)' : ''));
            tileElement.setAttribute('fill', '#444');
            tileElement.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', (isPole) ? '#pentagon' : '#hexagon');
            textElement.setAttribute('fill', '#FFF');
            textElement.setAttribute('transform', 'translate('+position2D[0]+','+(position2D[1]+4)+')');
            textElement.textContent = `${this.indexInStripeLayerAndStripeIndexToPositionInLayer(indexInStripeLayer, stripeIndex, layerIndex)} ${layerIndex}`;
            borderElement.setAttribute('transform', tileElement.getAttribute('transform'));
            borderElement.setAttribute('fill', 'none');
            borderElement.setAttribute('stroke', '#FFF');
            borderElement.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', (isPole) ? '#pentagon' : '#hexagon');
        };
        generateField(0, 0, this.gpIndex*3);
        generateField(0, 0, 0);
        for(let layerIndex = this.gpIndex*3-1; layerIndex > 0; --layerIndex)
            for(let stripeIndex = 0; stripeIndex < 5; ++stripeIndex)
                for(let indexInStripeLayer = 0; indexInStripeLayer < this.getFieldCountInStripeLayer(layerIndex); ++indexInStripeLayer)
                    generateField(indexInStripeLayer, stripeIndex, layerIndex);
        this.renderContext.renderImageToTexture(svgElement, this.texture);
    }
}
