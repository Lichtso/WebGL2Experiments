import {vec2, vec3, mat4} from './gl-matrix/index.js';

const pentagonY = -1.0/Math.sqrt(5.0),
      pentagonRadius = 2.0/Math.sqrt(5.0),
      hexWrenchFactor = Math.sqrt(3.0), // 2.0*Math.sin(Math.PI/6.0)
      pentagonRadiusByHexRadius = 1.0/(2.0*Math.sin(Math.PI/5.0)), // Math.sin(0.3*Math.PI)/Math.sin(0.4*Math.PI)
      icosahedronRadiusByEdgeLength = Math.sin(Math.PI*2.0/5.0), // 0.25*Math.sqrt(10.0+2.0*Math.sqrt(5.0))
      icosahedronVertices = [],
      auxA = vec3.create(),
      auxB = vec3.create(),
      auxC = vec3.create(),
      auxD = vec3.create(),
      inverseMatrix = mat4.create();

// Precompute vertices of an icosahedron
for(let i = 0; i < 12; ++i)
    icosahedronVertices.push(vec3.create());
icosahedronVertices[0][1] = -1.0;
icosahedronVertices[11][1] = 1.0;
for(let i = 0; i < 5; ++i) {
    const angle = (1.1+i*2.0/5.0)*Math.PI;
    icosahedronVertices[1+i][0] = Math.sin(angle)*pentagonRadius;
    icosahedronVertices[1+i][1] = pentagonY;
    icosahedronVertices[1+i][2] = Math.cos(angle)*pentagonRadius;
    vec3.scale(icosahedronVertices[6+(i+3)%5], icosahedronVertices[1+i], -1.0);
}
const triangleAngle = Math.acos(icosahedronVertices[10][1]);

function raySphereIntersection(intersections, origin, direction, sphereRadius) {
    vec3.scale(auxB, direction, vec3.dot(origin, direction));
    vec3.sub(auxA, origin, auxB);
    const orthogonalDist = vec3.length(auxA);
    if(orthogonalDist > sphereRadius)
        return 0.0;
    const parallelDist = Math.sin(Math.acos(orthogonalDist/sphereRadius))*sphereRadius;
    vec3.sub(intersections[1], origin, auxB);
    vec3.scaleAndAdd(intersections[0], intersections[1], direction, -parallelDist);
    vec3.scaleAndAdd(intersections[1], intersections[1], direction, parallelDist);
    return parallelDist*2.0;
}

/*function vec3Slerp(out, a, b, t) {
    const cos = vec3.dot(a, b)/vec3.dot(a, a),
          angle = Math.acos(cos);
    vec3.scale(auxA, a, Math.sin((1.0-t)*angle));
    vec3.scaleAndAdd(auxA, auxA, b, Math.sin(t*angle));
    vec3.scale(out, auxA, 1.0/Math.sqrt(1.0-cos*cos));
}

/*function quatToEuler(out, q) {
    const sinr_cosp = 2*(q[3]*q[0]+q[1]*q[2]),
          cosr_cosp = 1.0-2.0*(q[0]*q[0]+q[1]*q[1]);
    out[0] = Math.atan2(sinr_cosp, cosr_cosp);
    const sinp = 2 * (q[3]*q[1]-q[2]*q[0]);
    out[1] = (Math.abs(sinp) >= 1) ? Math.PI/2*Math.sign(sinp) : Math.asin(sinp);
    const siny_cosp = 2.0*(q[3]*q[2]+q[0]*q[1]),
          cosy_cosp = 1.0-2.0*(q[1]*q[1]+q[2]*q[2]);
    out[2] = Math.atan2(siny_cosp, cosy_cosp);
}*/

function halfPlaneSide(direction, poleIndexA, poleIndexB) {
    vec3.cross(auxA, icosahedronVertices[poleIndexA], icosahedronVertices[poleIndexB]);
    return vec3.dot(direction, auxA) > 0.0;
}

function barycentricInterpolation(point, barycentric, poles, angularInterpolation) {
    if(angularInterpolation)
        for(let i = 0; i < 3; ++i)
            barycentric[i] = Math.sin(barycentric[i]*triangleAngle);
    vec3.scale(point, poles[0], barycentric[0]);
    vec3.scaleAndAdd(point, point, poles[1], barycentric[1]);
    vec3.scaleAndAdd(point, point, poles[2], barycentric[2]);
    if(angularInterpolation)
        vec3.normalize(point, point);
}

function inverseBarycentricInterpolation(barycentric, point, poles, angularInterpolation) {
    let sum = 0.0;
    for(let i = 0; i < 3; ++i) {
        vec3.cross(auxA, poles[(i+1)%3], poles[(i+2)%3]);
        vec3.normalize(auxA, auxA);
        let dotA = vec3.dot(point, auxA),
            dotB = vec3.dot(poles[i], auxA);
        if(angularInterpolation) {
            dotA = Math.asin(dotA);
            dotB = Math.asin(dotB);
        }
        barycentric[i] = dotA/dotB;
        sum += barycentric[i];
    }
    vec3.scale(barycentric, barycentric, 1.0/sum);
}

function createSvgElement(tag, parentNode) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if(parentNode)
        parentNode.appendChild(node);
    return node;
}

let svgElement;
function createSvgCanvas() {
    if(svgElement) {
        for(let i = 1; i < 3; ++i)
            while(svgElement.childNodes[i].hasChildNodes())
                svgElement.childNodes[i].removeChild(svgElement.childNodes[i].lastChild);
        return;
    }
    svgElement = createSvgElement('svg'); // , document.body); // TODO
    svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgElement.setAttribute('version', '1.1');
    svgElement.setAttribute('text-anchor', 'middle');
    svgElement.setAttribute('font-family', 'Helvetica');
    svgElement.setAttribute('font-size', '12');
    const defs = createSvgElement('defs', svgElement),
          outlineFilter = createSvgElement('filter', defs),
          feMorphology = createSvgElement('feMorphology', outlineFilter),
          feMerge = createSvgElement('feMerge', outlineFilter),
          feMergeNodeA = createSvgElement('feMergeNode', feMerge),
          feMergeNodeB = createSvgElement('feMergeNode', feMerge),
          // background = createSvgElement('rect', svgElement),
          groundLayer = createSvgElement('g', svgElement),
          gridLayer = createSvgElement('g', svgElement);
    outlineFilter.setAttribute('id', 'outlineFilter');
    feMorphology.setAttribute('id', 'SourceAlpha');
    feMorphology.setAttribute('result', 'dilated');
    feMorphology.setAttribute('operator', 'dilate');
    feMorphology.setAttribute('radius', '1');
    feMergeNodeA.setAttribute('in', 'dilated');
    feMergeNodeB.setAttribute('in', 'SourceGraphic');
    // background.setAttribute('width', '100%');
    // background.setAttribute('height', '100%');
    // background.setAttribute('fill', '#000');
    groundLayer.setAttribute('filter', 'url(#outlineFilter)');
    groundLayer.setAttribute('shape-rendering', 'crispEdges');
    for(let j = 0; j < 2; ++j) {
        const pathElement = createSvgElement('path', defs);
        pathElement.setAttribute('id', (j == 0) ? 'pentagon' : 'hexagon');
        let data = '';
        for(let i = 0; i < 5+j; ++i) {
            const angle = i/(5+j)*2*Math.PI;
            data += (i == 0) ? 'M' : 'L';
            data += Math.sin(angle)+','+Math.cos(angle);
        }
        pathElement.setAttribute('d', data+'Z');
    }
}

export class LayerCoordinates {
    constructor(gpIndex, indexInLayer=0, longitude=0) {
        this.gpIndex = gpIndex;
        this.setIndexInLayerAndLongitude(indexInLayer, longitude);
    }

    setIndexInLayerAndLongitude(indexInLayer, longitude) {
        this.longitude = longitude;
        this.indexInLayer = indexInLayer;
    }

    setSpiralCoordinates(spiralCoordinates) {
        if(spiralCoordinates.indexInTotal == 0) {
            this.longitude = 0; // South Pole
            this.indexInLayer = 0;
            return;
        }
        let indexInTotal = spiralCoordinates.indexInTotal-1;
        const filedsPerTriangle = ((this.gpIndex-1)*(this.gpIndex-1)+(this.gpIndex-1))/2*5;
        if(indexInTotal < filedsPerTriangle) {
            const longitude = Math.floor((Math.sqrt(5)*Math.sqrt(8*indexInTotal+5)-5)/10);
            this.longitude = longitude+1;
            this.indexInLayer = indexInTotal-(longitude*longitude+longitude)/2*5;
            return;
        }
        indexInTotal -= filedsPerTriangle;
        const fieldsInRombus = this.gpIndex*(this.gpIndex+1)*5;
        if(indexInTotal < fieldsInRombus) {
            const longitude = Math.floor(indexInTotal/(this.gpIndex*5));
            this.longitude = this.gpIndex+longitude;
            this.indexInLayer = indexInTotal-longitude*this.gpIndex*5;
            return;
        }
        indexInTotal -= fieldsInRombus;
        if(indexInTotal < filedsPerTriangle) {
            indexInTotal = filedsPerTriangle-indexInTotal-1;
            const longitude = Math.floor((Math.sqrt(5)*Math.sqrt(8*indexInTotal+5)-5)/10);
            this.longitude = this.gpIndex*3-longitude-1;
            this.indexInLayer = (longitude+1)*5-(longitude*longitude+longitude)/2*5-1;
            return;
        }
        this.longitude = this.gpIndex*3; // North Pole
        this.indexInLayer = 0;
    }

    setEquatorCoordinates(equatorCoordinates) {
        this.longitude = equatorCoordinates.longitude;
        let latitude = equatorCoordinates.latitude;
        if(longitude > this.gpIndex*2)
            latitude -= longitude-this.gpIndex*2;
        this.stripeLatitude = Math.floor(latitude/this.gpIndex);
        this.indexInStripeLayer = latitude%this.gpIndex;
    }

    fieldCountInStripeLayer() {
        return (this.longitude == 0 || this.longitude == this.gpIndex*3) ? 1 :
               (this.longitude < this.gpIndex) ? this.longitude :
               (this.longitude <= this.gpIndex*2) ? this.gpIndex :
               this.gpIndex*3-this.longitude;
    }

    fieldCountInLayer() {
        return (this.longitude == 0 || this.longitude == this.gpIndex*3) ? 1 :
               this.fieldCountInStripeLayer()*5;
    }

    get stripeLatitude() {
        return Math.floor(this.indexInLayer/this.fieldCountInStripeLayer());
    }

    get stripeLongitude() {
        return Math.floor(this.longitude/this.gpIndex);
    }

    get indexInStripeLayer() {
        return this.indexInLayer%this.fieldCountInStripeLayer();
    }

    isPole() {
        return this.indexInStripeLayer == 0 && this.longitude%this.gpIndex == 0;
    }

    setAntipodal(layerCoordinates) {
        this.longitude = this.gpIndex*3-layerCoordinates.longitude,
        this.indexInLayer = (layerCoordinates.indexInLayer+(
            (layerCoordinates.longitude < this.gpIndex) ? layerCoordinates.longitude*3 :
            (layerCoordinates.longitude <= 2*this.gpIndex) ? this.longitude+this.gpIndex :
            this.longitude*2
        ))%this.fieldCountInLayer();
    }
}

// TODO: The axial coordinate system, sometimes called “trapezoidal” or “oblique” or “skewed”, is built by taking two of the three coordinates from a cube coordinate system
export class EquatorCoordinates {
    constructor(gpIndex, latitude=0, longitude=0) {
        this.gpIndex = gpIndex;
        this.setLatitudeAndLongitude(latitude, longitude);
    }

    setLatitudeAndLongitude(latitude, longitude) {
        this.latitude = latitude;
        this.longitude = longitude;
    }

    setStripeCoordinates(stripeCoordinates) {
        this.longitude = stripeCoordinates.longitude;
        this.latitude = stripeCoordinates.indexInStripeLayer+this.gpIndex*stripeCoordinates.stripeLatitude;
        if(this.longitude > this.gpIndex*2)
            this.latitude += this.longitude-this.gpIndex*2;
    }

    round(latitude, longitude) {
        const y = longitude-latitude;
        let xInteger = Math.round(latitude),
            yInteger = Math.round(y),
            zInteger = Math.round(longitude);
        const xFrac = Math.abs(xInteger-latitude),
              yFrac = Math.abs(yInteger-y),
              zFrac = Math.abs(longitude-zInteger);
        if(xFrac > yFrac && xFrac > zFrac)
            xInteger = zInteger-yInteger;
        else if(yFrac > zFrac)
            yInteger = zInteger-xInteger;
        else
            zInteger = xInteger+yInteger;
        this.latitude = xInteger;
        this.longitude = zInteger;
    }

    get stripeLatitude() {
        return Math.floor(this.latitude/this.gpIndex);
    }

    get stripeLongitude() {
        return Math.floor(this.longitude/this.gpIndex);
    }

    get indexInStripeLayer() {
        if(this.longitude < this.gpIndex*2)
            return this.latitude-this.stripeLatitude*this.gpIndex;
        else if(this.longitude < this.gpIndex*3)
            return this.latitude-(this.stripeLatitude-2)*this.gpIndex-this.longitude;
        else
            return 0;
    }

    get indexInLayer() {
        if(this.longitude < this.gpIndex)
            return this.latitude+this.stripeLatitude*(this.longitude-this.gpIndex);
        else if(this.longitude < this.gpIndex*2)
            return this.latitude;
        else if(this.longitude < this.gpIndex*3)
            return this.latitude+(this.stripeLatitude+1)*(this.gpIndex*2-this.longitude);
        else
            return 0;
    }

    isPole() {
        return this.latitude%this.gpIndex == 0 && this.longitude%this.gpIndex == 0;
    }

    navigate(direction) {
        if(typeof direction == 'number') {
            // TODO
        } else
            switch(direction) {
                case '-X':
                    if(this.longitude > this.gpIndex*2) {
                        if(this.latitude%this.gpIndex == this.longitude%this.gpIndex) {
                            this.latitude = (this.latitude-this.longitude-1+this.gpIndex*7)%(this.gpIndex*5);
                            --this.longitude;
                            return '+Z';
                        }
                    } else if(this.longitude > this.gpIndex) {
                        if(this.latitude == 0) {
                            this.latitude = this.gpIndex*5-1;
                            return '-X';
                        }
                    } else {
                        if(this.latitude%this.gpIndex == 0) {
                            this.latitude = (this.latitude+this.longitude+this.gpIndex*4)%(this.gpIndex*5);
                            ++this.longitude;
                            return '+Y';
                        }
                    }
                    --this.latitude;
                    return direction;
                case '+X':
                    if(this.longitude > this.gpIndex*2) {
                        if(this.latitude%this.gpIndex == this.gpIndex-1) {
                            this.latitude = (this.latitude+this.longitude+1-this.gpIndex*2)%(this.gpIndex*5);
                            return '-Y';
                        }
                    } else if(this.longitude > this.gpIndex) {
                        if(this.latitude == this.gpIndex*5-1) {
                            this.latitude = 0;
                            return '+X';
                        }
                    } else {
                        if((this.latitude+1)%this.gpIndex == this.longitude%this.gpIndex) {
                            this.latitude = (this.latitude-this.longitude+1+this.gpIndex)%(this.gpIndex*5);
                            return '-Z';
                        }
                    }
                    ++this.latitude;
                    return direction;
                case '-Y':
                    if(this.longitude <= this.gpIndex) {
                        if((this.latitude+1)%this.gpIndex == this.longitude%this.gpIndex) {
                            this.latitude = (this.latitude-this.longitude+1+this.gpIndex)%(this.gpIndex*5);
                            if(--this.longitude == 0) // South pole
                                this.latitude = 0;
                            return '+X';
                        }
                    }
                    --this.longitude;
                    return direction;
                case '+Y':
                    if(this.longitude >= this.gpIndex*2) {
                        if(this.latitude%this.gpIndex == this.longitude%this.gpIndex) {
                            this.latitude = (this.latitude-this.longitude-1+this.gpIndex*7)%(this.gpIndex*5);
                            return '-X';
                        }
                    }
                    ++this.longitude;
                    return direction;
                case '-Z':
                    if(this.longitude >= this.gpIndex*2) {
                        if(this.latitude%this.gpIndex == this.gpIndex-1) {
                            this.latitude = (this.latitude+this.longitude+2-this.gpIndex*2)%(this.gpIndex*5);
                            if(++this.longitude == this.gpIndex*3) // North pole
                                this.latitude = this.gpIndex;
                            return '+X';
                        }
                    }
                    this.latitude = (this.latitude+1)%(this.gpIndex*5);
                    ++this.longitude;
                    return direction;
                case '+Z':
                    if(this.longitude <= this.gpIndex) {
                        if(this.latitude%this.gpIndex == 0) {
                            this.latitude = (this.latitude+this.longitude-1+this.gpIndex*4)%(this.gpIndex*5);
                            return '-X';
                        }
                    }
                    this.latitude = (this.latitude-1+this.gpIndex*5)%(this.gpIndex*5);
                    --this.longitude;
                    return direction;
            }
    }

    static *getShortestPath(equatorCoordinatesA, equatorCoordinatesB, angularInterpolation) {
        const currentCoordinates = new EquatorCoordinates(equatorCoordinatesA.gpIndex),
              neighborCoordinates = new EquatorCoordinates(equatorCoordinatesA.gpIndex),
              nextCoordinates = new EquatorCoordinates(equatorCoordinatesA.gpIndex),
              triangleCoordinates = new TriangleCoordinates(equatorCoordinatesA.gpIndex);
        currentCoordinates.setLatitudeAndLongitude(equatorCoordinatesB.latitude, equatorCoordinatesB.longitude);
        triangleCoordinates.setStripeCoordinates(currentCoordinates);
        triangleCoordinates.direction3D(auxB, angularInterpolation);
        currentCoordinates.setLatitudeAndLongitude(equatorCoordinatesA.latitude, equatorCoordinatesA.longitude);
        triangleCoordinates.setStripeCoordinates(currentCoordinates);
        triangleCoordinates.direction3D(auxC, angularInterpolation);
        vec3.normalize(auxC, auxC);
        vec3.normalize(auxB, auxB);
        vec3.cross(auxD, auxC, auxB);
        while(true) {
            yield currentCoordinates;
            if(currentCoordinates.latitude == equatorCoordinatesB.latitude && currentCoordinates.longitude == equatorCoordinatesB.longitude)
                break;
            triangleCoordinates.setStripeCoordinates(currentCoordinates);
            triangleCoordinates.direction3D(auxC, angularInterpolation);
            const turningBackThreshold = vec3.dot(auxC, auxB);
            let minimum = Infinity;
            for(let direction of ['-X', '+X', '-Y', '+Y', '-Z', '+Z']) {
                neighborCoordinates.setLatitudeAndLongitude(currentCoordinates.latitude, currentCoordinates.longitude);
                neighborCoordinates.navigate(direction);
                triangleCoordinates.setStripeCoordinates(neighborCoordinates);
                triangleCoordinates.direction3D(auxC, angularInterpolation);
                const error = Math.abs(vec3.dot(auxC, auxD));
                if(vec3.dot(auxC, auxB) > turningBackThreshold && error < minimum) {
                    minimum = error;
                    nextCoordinates.setLatitudeAndLongitude(neighborCoordinates.latitude, neighborCoordinates.longitude);
                }
            }
            currentCoordinates.setLatitudeAndLongitude(nextCoordinates.latitude, nextCoordinates.longitude);
        }
    }
}

// Fruit Peeling
export class SpiralCoordinates {
    constructor(gpIndex, indexInTotal=0) {
        this.gpIndex = gpIndex;
        this.setIndexInTotal(indexInTotal);
    }

    setIndexInTotal(indexInTotal) {
        this.indexInTotal = indexInTotal;
    }

    setLayerCoordinates(layerCoordinates) {
        if(layerCoordinates.longitude == 0)
            this.indexInTotal = 0;
        else {
            let offset,
                longitude = layerCoordinates.longitude-1;
            if(longitude < this.gpIndex)
                offset = (longitude*longitude+longitude)/2;
            else if(longitude < this.gpIndex*2)
                offset = (longitude+1/2)*this.gpIndex-this.gpIndex*this.gpIndex/2;
            else {
                longitude = this.gpIndex*3-longitude-1;
                offset = (this.gpIndex*this.gpIndex)*2-(longitude*longitude+longitude)/2;
            }
            this.indexInTotal = 1+offset*5+layerCoordinates.indexInLayer;
        }
    }
}

/*
triangleIndex:
   *     *     *     *     * North pole
  / \   / \   / \   / \   / \
 / P \ / Q \ / R \ / S \ / T \
*-----*-----*-----*-----*-----* Northern poles
 \ K / \ L / \ M / \ N / \ O / \
  \ / F \ / G \ / H \ / I \ / J \
   *-----*-----*-----*-----*-----* Southern poles
    \ A / \ B / \ C / \ D / \ E /
     \ /   \ /   \ /   \ /   \ /
      *     *     *     *     * South pole

barycentric:
     Z
 Y       X

 X       Y
     Z
*/
export class TriangleCoordinates {
    constructor(gpIndex, barycentric=[0, 0, 0], triangleIndex=0) {
        this.gpIndex = gpIndex;
        this.setBarycentricAndTriangleIndex(barycentric, triangleIndex);
    }

    setBarycentricAndTriangleIndex(barycentric, triangleIndex) {
        this.barycentric = barycentric;
        this.triangleIndex = triangleIndex;
    }

    setStripeCoordinates(stripeCoordinates) {
        this.triangleIndex = stripeCoordinates.stripeLatitude;
        if(stripeCoordinates.longitude > this.gpIndex*2) {
            this.barycentric[0] = this.gpIndex*3-stripeCoordinates.longitude-stripeCoordinates.indexInStripeLayer;
            this.barycentric[2] = stripeCoordinates.longitude-this.gpIndex*2;
            this.triangleIndex += 15;
        } else if(stripeCoordinates.longitude < this.gpIndex) {
            this.barycentric[0] = stripeCoordinates.indexInStripeLayer;
            this.barycentric[2] = this.gpIndex-stripeCoordinates.longitude;
        } else if(stripeCoordinates.indexInStripeLayer+this.gpIndex < stripeCoordinates.longitude) {
            this.barycentric[0] = stripeCoordinates.indexInStripeLayer;
            this.barycentric[2] = this.gpIndex*2-stripeCoordinates.longitude;
            this.triangleIndex += 10;
        } else {
            this.barycentric[0] = this.gpIndex-stripeCoordinates.indexInStripeLayer;
            this.barycentric[2] = stripeCoordinates.longitude-this.gpIndex;
            this.triangleIndex += 5;
        }
        this.barycentric[1] = this.gpIndex-(this.barycentric[0]+this.barycentric[2]);
    }

    setEquatorCoordinates(equatorCoordinates) {
        this.triangleIndex = equatorCoordinates.stripeLatitude;
        if(equatorCoordinates.longitude > this.gpIndex*2) {
            this.barycentric[0] = (equatorCoordinates.longitude == this.gpIndex*3) ? 0 : this.gpIndex*3-equatorCoordinates.latitude+(this.triangleIndex-2)*this.gpIndex;
            this.barycentric[2] = equatorCoordinates.longitude-this.gpIndex*2;
            this.triangleIndex += 15;
        } else if(equatorCoordinates.longitude < this.gpIndex) {
            this.barycentric[0] = equatorCoordinates.latitude-this.triangleIndex*this.gpIndex;
            this.barycentric[2] = this.gpIndex-equatorCoordinates.longitude;
        } else if(equatorCoordinates.latitude-equatorCoordinates.longitude < (this.triangleIndex-1)*this.gpIndex) {
            this.barycentric[0] = equatorCoordinates.latitude-this.triangleIndex*this.gpIndex;
            this.barycentric[2] = this.gpIndex*2-equatorCoordinates.longitude;
            this.triangleIndex += 10;
        } else {
            this.barycentric[0] = (this.triangleIndex+1)*this.gpIndex-equatorCoordinates.latitude;
            this.barycentric[2] = equatorCoordinates.longitude-this.gpIndex;
            this.triangleIndex += 5;
        }
        this.barycentric[1] = this.gpIndex-(this.barycentric[0]+this.barycentric[2]);
    }

    round(barycentric) {
        vec3.round(auxA, barycentric);
        vec3.sub(auxB, auxA, barycentric);
        let max = 0.0;
        for(let i = 0; i < 3; ++i) {
            auxB[i] = Math.abs(auxB[i]);
            max = Math.max(max, auxB[i]);
        }
        if(auxB[0] == max)
            auxA[0] = -auxA[1]-auxA[2];
        else if(auxB[1] == max)
            auxA[1] = -auxA[0]-auxA[2];
        else // if(auxB[2] == max)
            auxA[2] = -auxA[0]-auxA[1];
        this.barycentric[0] = this.gpIndex-(auxA[1]+auxA[2]);
        this.barycentric[1] = auxA[1];
        this.barycentric[2] = auxA[2];
    }

    get triangleLatitude() {
        return this.triangleIndex%5;
    }

    get triangleLongitude() {
        return Math.floor(this.triangleIndex/5);
    }

    distanceToClosestPole() {
        return this.gpIndex-Math.max(Math.max(this.barycentric[0], this.barycentric[1]), this.barycentric[2]);
    }

    isPole() {
        return this.distanceToClosestPole() == 0;
    }

    poleIndices() {
        switch(this.triangleLongitude) {
            case 3:
                return [6+this.triangleLatitude, 6+(this.triangleLatitude+1)%5, 11];
            case 2:
                return [6+(this.triangleLatitude+1)%5, 6+this.triangleLatitude, 1+this.triangleLatitude];
            case 1:
                return [1+this.triangleLatitude, 1+(this.triangleLatitude+1)%5, 6+(this.triangleLatitude+1)%5];
            case 0:
                return [1+(this.triangleLatitude+1)%5, 1+this.triangleLatitude, 0];
        }
    }

    closestPole() {
        const maxCoord = Math.max(Math.max(this.barycentric[0], this.barycentric[1]), this.barycentric[2]),
              poleIndices = this.poleIndices();
        for(let i = 0; i < 3; ++i)
            if(this.barycentric[i] == maxCoord)
                return poleIndices[i];
    }

    get latitude() {
        if(this.triangleIndex == 16 && this.barycentric[2] == this.gpIndex)
            return this.gpIndex; // North pole
        return this.gpIndex*this.triangleLatitude+((this.triangleLongitude%2 == 0) ? this.barycentric[0] : this.gpIndex-this.barycentric[0]);
    }

    get longitude() {
        const triangleLongitude = this.triangleLongitude;
        return this.gpIndex*((triangleLongitude < 2) ? 1 : 2)+((triangleLongitude%2 == 0) ? -this.barycentric[2] : this.barycentric[2]);
    }

    direction3D(direction, angularInterpolation) {
        vec3.scale(auxA, this.barycentric, 1.0/this.gpIndex);
        barycentricInterpolation(direction, auxA, this.poleIndices().map(i => icosahedronVertices[i]), angularInterpolation);
    }

    fromDirection3D(direction, angularInterpolation) {
        vec3.normalize(direction, direction);
        const longitude = 1.0-Math.acos(direction[1])/Math.PI,
              latitude = Math.atan2(direction[0], direction[2])/Math.PI,
              triangleLatitudeSouth = Math.floor((7.25+latitude*2.5)%5.0),
              triangleLatitudeNorth = Math.floor((7.75+latitude*2.5)%5.0);
        if(halfPlaneSide(direction, 1+(triangleLatitudeSouth+1)%5, 1+triangleLatitudeSouth))
            this.triangleIndex = triangleLatitudeSouth;
        else if(halfPlaneSide(direction, 6+triangleLatitudeNorth, 6+(triangleLatitudeNorth+1)%5))
            this.triangleIndex = 15+triangleLatitudeNorth;
        else if(halfPlaneSide(direction, 6+triangleLatitudeNorth, 1+triangleLatitudeNorth) &&
                halfPlaneSide(direction, 1+triangleLatitudeNorth, 6+(triangleLatitudeNorth+1)%5))
            this.triangleIndex = 10+triangleLatitudeNorth;
        else
            this.triangleIndex = 5+triangleLatitudeSouth;
        const prevPoleIndices = this.poleIndices();
        inverseBarycentricInterpolation(auxB, direction, prevPoleIndices.map(i => icosahedronVertices[i]), angularInterpolation);
        vec3.scale(auxB, auxB, this.gpIndex);
        vec3.copy(this.barycentric, auxB);
        auxB[0] = -(auxB[1]+auxB[2]);
        this.round(auxB);
        // Normalize edge cases
        const prevTriangleIndex = this.triangleIndex;
        if(this.barycentric[0] == this.gpIndex || this.barycentric[1] == this.gpIndex || this.barycentric[2] == this.gpIndex) {
            switch(Math.round(longitude*4)) {
                case 4: // North pole
                    this.triangleIndex = 16;
                    break;
                case 3: // Northern poles
                    this.triangleIndex = 10+(triangleLatitudeSouth+1)%5;
                    break;
                case 1: // Southern poles
                    this.triangleIndex = 5+triangleLatitudeNorth;
                    break;
                case 0: // South pole
                    this.triangleIndex = 0;
                    break;
            }
        } else if(this.barycentric[2] == 0) {
            if(this.triangleIndex < 5)
                this.triangleIndex += 5;
            else if(this.triangleIndex >= 15)
                this.triangleIndex -= 5;
        } else if(this.triangleIndex >= 5 && this.triangleIndex < 15) {
            if(this.barycentric[1] == 0)
                this.triangleIndex = 5+triangleLatitudeSouth;
            else if(this.barycentric[0] == 0)
                this.triangleIndex = 10+triangleLatitudeNorth;
        } else if(this.triangleIndex >= 15) {
            if(this.barycentric[0] == 0 || this.barycentric[1] == 0)
                this.triangleIndex = 15+(triangleLatitudeSouth+1)%5;
        } else if(this.triangleIndex < 5) {
            if(this.barycentric[0] == 0 || this.barycentric[1] == 0)
                this.triangleIndex = triangleLatitudeNorth;
        }
        if(this.triangleIndex != prevTriangleIndex) {
            const prevBarycentric = this.barycentric.slice(),
                  poleIndices = this.poleIndices();
            for(let i = 0; i < 3; ++i) {
                const j = prevPoleIndices.indexOf(poleIndices[i]);
                this.barycentric[i] = (j == -1) ? 0 : prevBarycentric[j];
            }
        }
    }

    greatRings() {
        const result = [undefined, undefined, undefined];
        if(this.isPole())
            return result;
        if(this.barycentric[2] > 0) {
            switch(this.triangleLongitude) {
                case 3:
                    result[0] = (this.triangleLatitude+3)%5*this.gpIndex+this.gpIndex-this.barycentric[2];
                    break;
                case 2:
                    result[0] = this.gpIndex*6-this.barycentric[2];
                    break;
                case 1:
                    result[0] = this.gpIndex*5+this.barycentric[2];
                    break;
                case 0:
                    result[0] = (this.triangleLatitude+1)%5*this.gpIndex+this.barycentric[2];
                    break;
            }
        }
        if(this.barycentric[0] > 0) {
            const latitude = (this.triangleLatitude+2)%5;
            result[1] = latitude*this.gpIndex+((this.triangleLongitude%2 == 0) ? this.gpIndex-this.barycentric[0] : this.barycentric[0]);
        }
        if(this.barycentric[1] > 0) {
            const latitude = (this.triangleLongitude < 2) ? this.triangleLatitude : (this.triangleLatitude+4)%5;
            result[2] = latitude*this.gpIndex+((this.triangleLongitude%2 == 0) ? this.gpIndex-this.barycentric[1] : this.barycentric[1]);
        }
        return result;
    }
}

export class IcosahedralClass1GoldbergPolyhedron {
    constructor(abandon, fieldsHaveCenterVertex, gpIndex=2, edgeLength3D=1.0/(2*hexWrenchFactor*icosahedronRadiusByEdgeLength), edgeLength2D=0.0) {
        this.abandon = abandon; // One of ['curvature', 'size', 'shape']
        this.fieldsHaveCenterVertex = fieldsHaveCenterVertex; // Defines if fields have an additional vertex at their center or are flat instead
        this.gpIndex = gpIndex; // Number of fields along the edge between two poles (including one of the two poles)
        this.edgeLength3D = edgeLength3D; // Edge length of the hexagons and pentagons in 3D
        this.edgeLength2D = edgeLength2D; // Edge length of the hexagons and pentagons in 2D
        this.icosahedronEdgeLength = this.gpIndex*this.edgeLength3D*hexWrenchFactor;
        this.sphereRadius = this.icosahedronEdgeLength*icosahedronRadiusByEdgeLength;
    }

    getBorderVertexCountPerEdgeAtLongitude(longitude) {
        return (longitude < this.gpIndex) ? longitude*2+1 :
               (longitude < this.gpIndex*2) ? this.gpIndex*2 :
               (this.gpIndex*3-longitude)*2-1;
    }

    rayIntersection(intersections, worldMatrix, origin, direction) {
        mat4.invert(inverseMatrix, worldMatrix);
        vec3.transformMat4(auxC, origin, inverseMatrix);
        vec3.transformMat4(auxD, direction, inverseMatrix);
        return raySphereIntersection(intersections, auxC, auxD, this.sphereRadius);
    }

    getFieldPosition2D(position, equatorCoordinates) {
        let latitude = equatorCoordinates.latitude,
            longitude = equatorCoordinates.longitude;
        if(equatorCoordinates.longitude == 0) { // Remap south pole
            latitude = -1;
            ++longitude;
        } else if(equatorCoordinates.longitude == this.gpIndex*3) { // Remap north pole
            latitude = this.gpIndex*5;
            --longitude;
        } else if(equatorCoordinates.longitude == this.gpIndex*2 && equatorCoordinates.latitude == 0) // Remap first northern pole
            latitude = this.gpIndex*5;
        position[0] = this.fieldWidth2D*(0.5*(this.gpIndex*2-longitude)+latitude);
        position[1] = this.fieldHeight2D*(0.75*(this.gpIndex*3-longitude-1)+0.5);
    }

    equatorCoordinatesFromPosition2D(equatorCoordinates, position) {
        let longitude = this.gpIndex*3-1-(position[1]/this.fieldHeight2D-0.5)/0.75,
            latitude = position[0]/this.fieldWidth2D-0.5*(this.gpIndex*2-longitude);
        equatorCoordinates.round(latitude, longitude);
        if(equatorCoordinates.latitude == -1) { // Remap south pole
            equatorCoordinates.latitude = 0;
            equatorCoordinates.longitude = 0;
        } else if(equatorCoordinates.latitude == this.gpIndex*5) {
            if(equatorCoordinates.longitude == this.gpIndex*3-1) { // Remap north pole
                equatorCoordinates.latitude = this.gpIndex;
                equatorCoordinates.longitude = this.gpIndex*3;
            } else { // Remap first northern pole
                equatorCoordinates.latitude = 0;
                equatorCoordinates.longitude = this.gpIndex*2;
            }
        }
    }

    getBorderTexcoord(out, fieldPosition2D, direction, hemisphere) {
        vec2.copy(out, fieldPosition2D);
        if(typeof direction == 'number') {
            const angle = Math.PI*2/5*direction+((hemisphere) ? 0 : Math.PI*0.2);
            out[0] += Math.sin(angle)*this.pentagonRadius2D;
            out[1] += Math.cos(angle)*this.pentagonRadius2D;
        } else
            switch(direction) {
                case '+Z':
                    out[1] += this.fieldHeight2D*0.5;
                    break;
                case '-Y':
                    out[0] += this.fieldWidth2D*0.5;
                    out[1] += this.fieldHeight2D*0.25;
                    break;
                case '+X':
                    out[0] += this.fieldWidth2D*0.5;
                    out[1] -= this.fieldHeight2D*0.25;
                    break;
                case '-Z':
                    out[1] -= this.fieldHeight2D*0.5;
                    break;
                case '+Y':
                    out[0] -= this.fieldWidth2D*0.5;
                    out[1] -= this.fieldHeight2D*0.25;
                    break;
                case '-X':
                    out[0] -= this.fieldWidth2D*0.5;
                    out[1] += this.fieldHeight2D*0.25;
                    break;
            }
        out[0] /= this.textureWidth;
        out[1] /= this.textureHeight;
    }

    generateGeometry() {
        // Initialize buffers, variables and constants
        this.fieldCount = this.gpIndex*this.gpIndex*10+2;
        this.borderVertexCount = this.gpIndex*this.gpIndex*20;
        this.vertexCount = this.fieldCount+this.borderVertexCount;
        this.positions = new Float32Array(this.vertexCount*3);
        this.normals = new Float32Array(this.vertexCount*3);
        const normal = vec3.create(),
              position = vec3.create(),
              layerCoordinates = new LayerCoordinates(this.gpIndex),
              spiralCoordinates = new SpiralCoordinates(this.gpIndex),
              triangleCoordinates = new TriangleCoordinates(this.gpIndex),
              angularInterpolation = (this.abandon == 'shape');
        // Initialize generator functions
        const generateVertex = (offset) => {
            offset *= 3;
            vec3.normalize(normal, position);
            this.normals[offset+0] = normal[0];
            this.normals[offset+1] = normal[1];
            this.normals[offset+2] = normal[2];
            vec3.scale(position, (this.abandon == 'curvature') ? position : normal, this.sphereRadius);
            this.positions[offset+0] = position[0];
            this.positions[offset+1] = position[1];
            this.positions[offset+2] = position[2];
        };
        /* generateBorderVertex finds the border vertex O between the field centers (A, B, C):
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
            vec3.scale(position, position, (this.abandon == 'curvature' ? 1.0/3.0 : this.sphereRadius));
            generateVertex(borderVertexIndex++);
        };
        // Generate north and south pole
        vec3.copy(position, icosahedronVertices[0]);
        generateVertex(0);
        vec3.copy(position, icosahedronVertices[11]);
        generateVertex(this.fieldCount-1);
        // Generate center vertices by barycentric interpolation
        for(let longitude = 1; longitude < this.gpIndex*3; ++longitude) {
            layerCoordinates.longitude = longitude;
            for(let indexInLayer = 0; indexInLayer < layerCoordinates.fieldCountInLayer(); ++indexInLayer) {
                layerCoordinates.setIndexInLayerAndLongitude(indexInLayer, longitude);
                triangleCoordinates.setStripeCoordinates(layerCoordinates);
                triangleCoordinates.direction3D(position, angularInterpolation);
                vec3.scale(position, position, this.sphereRadius);
                spiralCoordinates.setLayerCoordinates(layerCoordinates);
                generateVertex(spiralCoordinates.indexInTotal);
            }
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
        for(let longitude = 0; longitude < this.gpIndex*3; ++longitude) {
            const borderVertexCountAtLayer = this.getBorderVertexCountPerEdgeAtLongitude(longitude),
                  hemisphere = (longitude < this.gpIndex*2) ? 0 : 1;
            let lowerIndex = 0, upperIndex = 0;
            layerCoordinates.setIndexInLayerAndLongitude(lowerIndex, longitude);
            const fieldCountInLowerLayer = layerCoordinates.fieldCountInLayer();
            triangleCoordinates.setStripeCoordinates(layerCoordinates);
            triangleCoordinates.direction3D(lowerFiledVertex, angularInterpolation);
            layerCoordinates.setIndexInLayerAndLongitude(upperIndex, longitude+1);
            const fieldCountInUpperLayer = layerCoordinates.fieldCountInLayer();
            triangleCoordinates.setStripeCoordinates(layerCoordinates);
            triangleCoordinates.direction3D(upperFiledVertex, angularInterpolation);
            for(let stripeLatitude = 0; stripeLatitude < 5; ++stripeLatitude)
                for(let indexInStripeLayer = 0; indexInStripeLayer < borderVertexCountAtLayer; ++indexInStripeLayer) {
                    if(indexInStripeLayer%2 == hemisphere) { // Downward Triangle
                        vec3.copy(prevUpperFiledVertex, upperFiledVertex);
                        upperIndex = (upperIndex+1)%fieldCountInUpperLayer;
                        layerCoordinates.setIndexInLayerAndLongitude(upperIndex, longitude+1);
                        triangleCoordinates.setStripeCoordinates(layerCoordinates);
                        triangleCoordinates.direction3D(upperFiledVertex, angularInterpolation);
                        generateBorderVertex(lowerFiledVertex, upperFiledVertex, prevUpperFiledVertex);
                    } else { // Upward Triangle
                        vec3.copy(prevLowerFiledVertex, lowerFiledVertex);
                        lowerIndex = (lowerIndex+1)%fieldCountInLowerLayer;
                        layerCoordinates.setIndexInLayerAndLongitude(lowerIndex, longitude);
                        triangleCoordinates.setStripeCoordinates(layerCoordinates);
                        triangleCoordinates.direction3D(lowerFiledVertex, angularInterpolation);
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
        this.elementsPerField = (this.fieldsHaveCenterVertex) ? 9 : 7;
        let indexInTotal = 0,
            outVertexIndex = 0,
            borderVertexIndex = this.fieldCount,
            pentagonVertexOffset = 20*(this.gpIndex*this.gpIndex+this.gpIndex)+2*this.gpIndex-11;
        if(this.fieldsHaveCenterVertex) {
            outVertexIndex += this.fieldCount;
            pentagonVertexOffset += this.fieldCount;
        }
        const primitiveRestartIndex = 65535,
              glElementBuffer = new Uint16Array(this.fieldCount*this.elementsPerField),
              glVertexBuffer = new Float32Array((pentagonVertexOffset+12*5)*8),
              fieldPosition2D = vec2.create(),
              layerCoordinates = new LayerCoordinates(this.gpIndex),
              equatorCoordinates = new EquatorCoordinates(this.gpIndex);
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
        const generatePoleVertices = (longitude, stripeLatitude, elementOffset, borderVertexCountAtLayer0) => {
            let outElementOffset = indexInTotal*this.elementsPerField;
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
            if(longitude == 0) // South Pole
                for(let i = 0; i < 5; ++i)
                    generateVertex(borderVertexIndex+4-i, i);
            else if(longitude == this.gpIndex*3) // North Pole
                for(let i = 0; i < 5; ++i)
                    generateVertex(borderVertexIndex-5+i, i);
            else if(stripeLatitude == 0) { // Western Poles
                if(longitude == this.gpIndex) { // Southern Pole
                    generateVertex(borderVertexIndex, 0);
                    generateVertex(borderVertexIndex+elementOffset-5, 1);
                    generateVertex(borderVertexIndex+elementOffset-6, 2);
                    generateVertex(borderVertexIndex+elementOffset+borderVertexCountAtLayer0-7, 3);
                    generateVertex(borderVertexIndex+elementOffset-7, 4);
                } else { // Northern Pole
                    generateVertex(borderVertexIndex+elementOffset-1, 0);
                    generateVertex(borderVertexIndex, 1);
                    generateVertex(borderVertexIndex+elementOffset, 2);
                    generateVertex(borderVertexIndex+elementOffset+borderVertexCountAtLayer0-1, 3);
                    generateVertex(borderVertexIndex+elementOffset-2, 4);
                    fieldPosition2D[0] -= this.fieldWidth2D*this.gpIndex*5;
                }
            } else { // Other Poles
                generateVertex(borderVertexIndex, 0);
                if(longitude == this.gpIndex) { // Southern Poles
                    elementOffset += stripeLatitude;
                    generateVertex(borderVertexIndex+elementOffset-5, 1);
                    generateVertex(borderVertexIndex+elementOffset-6, 2);
                    generateVertex(borderVertexIndex+elementOffset-7, 3);
                } else { // Northern Poles
                    elementOffset -= stripeLatitude;
                    generateVertex(borderVertexIndex+1, 1);
                    generateVertex(borderVertexIndex+elementOffset+1, 2);
                    generateVertex(borderVertexIndex+elementOffset, 3);
                }
                generateVertex(borderVertexIndex-1, 4);
            }
            generateVertex(indexInTotal++, 'Close');
        };
        // Generate south pole
        this.getFieldPosition2D(fieldPosition2D, equatorCoordinates);
        generatePoleVertices(0);
        // Copy and interleave vertices
        for(let longitude = 1; longitude < this.gpIndex*3; ++longitude) {
            layerCoordinates.longitude = longitude;
            const borderVertexCountAtLayer0 = this.getBorderVertexCountPerEdgeAtLongitude(longitude)*5,
                  borderVertexCountAtLayer1 = this.getBorderVertexCountPerEdgeAtLongitude(longitude-1),
                  borderVertexCountAtLayer2 = this.getBorderVertexCountPerEdgeAtLongitude(longitude-2);
            let elementCountAtLayer;
            if(longitude < this.gpIndex)
                elementCountAtLayer = longitude*10+5;
            else if(longitude <= this.gpIndex*2) {
                elementCountAtLayer = this.gpIndex*10;
                if(longitude > this.gpIndex && longitude < this.gpIndex*2)
                    elementCountAtLayer += (longitude+1 == this.gpIndex*2) ? 1 : 2;
            } else
                elementCountAtLayer = (this.gpIndex*3-longitude)*10+5;
            for(let stripeLatitude = 0; stripeLatitude < 5; ++stripeLatitude) {
                let elementOffset = elementCountAtLayer;
                if(longitude < this.gpIndex-1)
                    elementOffset += stripeLatitude*2;
                else if(longitude == this.gpIndex-1)
                    elementOffset += stripeLatitude-1;
                else if(longitude == this.gpIndex)
                    ++elementOffset;
                else if(longitude == this.gpIndex*2+1)
                    elementOffset += (4-stripeLatitude);
                else if(longitude > this.gpIndex*2+1)
                    elementOffset += (4-stripeLatitude)*2;
                const fieldCountInStripeLayer = layerCoordinates.fieldCountInStripeLayer();
                for(let indexInStripeLayer = 0; indexInStripeLayer < fieldCountInStripeLayer; ++indexInStripeLayer) {
                    const indexInLayer = fieldCountInStripeLayer*stripeLatitude+indexInStripeLayer;
                    layerCoordinates.setIndexInLayerAndLongitude(indexInLayer, longitude);
                    equatorCoordinates.setStripeCoordinates(layerCoordinates);
                    this.getFieldPosition2D(fieldPosition2D, equatorCoordinates);
                    const isNotPole = !equatorCoordinates.isPole(),
                          isLeadSeam = equatorCoordinates.latitude%this.gpIndex == 0 && (equatorCoordinates.latitude == 0 || layerCoordinates.longitude <= this.gpIndex),
                          isTailSeam = equatorCoordinates.latitude%this.gpIndex == this.gpIndex-1 && (equatorCoordinates.latitude > this.gpIndex*4 || equatorCoordinates.longitude > this.gpIndex*2);
                    if(isLeadSeam || (equatorCoordinates.longitude > this.gpIndex*2 && equatorCoordinates.latitude%this.gpIndex == equatorCoordinates.longitude%this.gpIndex)) { // Seam edge
                        fieldPosition2D[0] -= this.fieldWidth2D;
                        if(equatorCoordinates.longitude > this.gpIndex*2+1)
                            generateVertex((equatorCoordinates.latitude < this.gpIndex)
                                ? borderVertexIndex-2
                                : borderVertexIndex-borderVertexCountAtLayer2*(5-stripeLatitude)-borderVertexCountAtLayer1*stripeLatitude-2
                            , '+Z');
                        if(isNotPole) {
                            let vertexIndex;
                            if(equatorCoordinates.longitude > this.gpIndex*2)
                                vertexIndex = (equatorCoordinates.latitude < this.gpIndex) ? borderVertexIndex+borderVertexCountAtLayer1*5-1 : borderVertexIndex-1;
                            else if(equatorCoordinates.longitude > this.gpIndex)
                                vertexIndex = borderVertexIndex+borderVertexCountAtLayer1*5-2;
                            else if(equatorCoordinates.latitude < this.gpIndex)
                                vertexIndex = borderVertexIndex+borderVertexCountAtLayer1*5+borderVertexCountAtLayer0-2;
                            else
                                vertexIndex = borderVertexIndex+borderVertexCountAtLayer0-(6-stripeLatitude)*2;
                            generateVertex(vertexIndex, '-Y');
                        }
                        fieldPosition2D[0] += this.fieldWidth2D;
                    }
                    if(isNotPole) {
                        let outElementOffset = indexInTotal*this.elementsPerField;
                        if(this.fieldsHaveCenterVertex)
                            glElementBuffer[outElementOffset+0] = indexInTotal;
                        else
                            --outElementOffset;
                        glElementBuffer[outElementOffset+1] = outVertexIndex-1;
                        glElementBuffer[outElementOffset+2] = outVertexIndex;
                        glElementBuffer[outElementOffset+3] = outVertexIndex+1;
                        glElementBuffer[outElementOffset+4] = outVertexIndex+elementOffset+2;
                        glElementBuffer[outElementOffset+5] = outVertexIndex+elementOffset+1;
                        glElementBuffer[outElementOffset+6] = outVertexIndex+elementOffset;
                        if(this.fieldsHaveCenterVertex)
                            glElementBuffer[outElementOffset+7] = outVertexIndex-1;
                        else
                            --outElementOffset;
                        glElementBuffer[outElementOffset+8] = primitiveRestartIndex;
                        generateVertex(indexInTotal++, 'Close');
                    } else
                        generatePoleVertices(equatorCoordinates.longitude, stripeLatitude, elementOffset, borderVertexCountAtLayer0);
                    let vertexIndex;
                    if(!isLeadSeam)
                        vertexIndex = borderVertexIndex++;
                    else if(equatorCoordinates.latitude == 0)
                        vertexIndex = borderVertexIndex+borderVertexCountAtLayer1*5-1;
                    else
                        vertexIndex = borderVertexIndex-1;
                    generateVertex(vertexIndex, '+Z');
                    generateVertex(borderVertexIndex++, '-Y');
                    if(isTailSeam && equatorCoordinates.longitude > this.gpIndex) {
                        fieldPosition2D[0] += this.fieldWidth2D;
                        generateVertex(borderVertexIndex++, '+Z');
                    }
                }
            }
        }
        // Generate north crown
        for(let stripeLatitude = 0; stripeLatitude < 5; ++stripeLatitude) {
            equatorCoordinates.setLatitudeAndLongitude((stripeLatitude+1)*this.gpIndex-1, this.gpIndex*3-1);
            this.getFieldPosition2D(fieldPosition2D, equatorCoordinates);
            generateVertex(borderVertexIndex+((stripeLatitude == 0) ? -2 : stripeLatitude*2-17), '+Y');
            generateVertex(borderVertexIndex+((stripeLatitude == 0) ? 4 : -1), '-Z');
            generateVertex(borderVertexIndex++, '+X');
        }
        // Generate north pole
        equatorCoordinates.setLatitudeAndLongitude(this.gpIndex, this.gpIndex*3);
        this.getFieldPosition2D(fieldPosition2D, equatorCoordinates);
        generatePoleVertices(this.gpIndex*3);
        return [glVertexBuffer, glElementBuffer];
    }

    generateTextureImage(equatorCoordinatesB=new EquatorCoordinates(this.gpIndex, 22, 17)) {
        createSvgCanvas();
        svgElement.setAttribute('width', this.textureWidth);
        svgElement.setAttribute('height', this.textureHeight);
        svgElement.childNodes[0].childNodes[1].setAttribute('transform', `scale(${this.pentagonRadius2D},${this.pentagonRadius2D})`);
        svgElement.childNodes[0].childNodes[2].setAttribute('transform', `scale(${this.edgeLength2D},${this.edgeLength2D})`);
        svgElement.childNodes[0].childNodes[1].setAttribute('stroke-width', 2.0/this.pentagonRadius2D);
        svgElement.childNodes[0].childNodes[2].setAttribute('stroke-width', 2.0/this.edgeLength2D);
        const position2D = vec2.create(),
              direction3D = vec3.create(),
              layerCoordinates = new LayerCoordinates(this.gpIndex),
              equatorCoordinates = new EquatorCoordinates(this.gpIndex, 19, 15),
              spiralCoordinates = new SpiralCoordinates(this.gpIndex),
              triangleCoordinates = new TriangleCoordinates(this.gpIndex),
              path = new Set();
        for(const field of EquatorCoordinates.getShortestPath(equatorCoordinates, equatorCoordinatesB, true)) {
            spiralCoordinates.setLayerCoordinates(field);
            path.add(spiralCoordinates.indexInTotal);
        }
        const generateField = () => {
            equatorCoordinates.setStripeCoordinates(layerCoordinates);
            spiralCoordinates.setLayerCoordinates(layerCoordinates);
            triangleCoordinates.setEquatorCoordinates(equatorCoordinates);
            const distToClosestPole = triangleCoordinates.distanceToClosestPole(),
                  closestPole = triangleCoordinates.closestPole(),
                  isPole = (distToClosestPole == 0),
                  tileElement = createSvgElement('use', svgElement.childNodes[1]),
                  textElement = createSvgElement('text', svgElement.childNodes[2]),
                  borderElement = createSvgElement('use', svgElement.childNodes[2]);
            this.getFieldPosition2D(position2D, equatorCoordinates);
            let transform = `translate(${position2D[0]},${position2D[1]}) `;
            if(isPole && equatorCoordinates.longitude < this.gpIndex*1.5)
                transform += 'rotate(36)';
            tileElement.setAttribute('transform', transform);
            tileElement.setAttribute('fill', '#FFF');
            tileElement.setAttribute('href', (isPole) ? '#pentagon' : '#hexagon');
            textElement.setAttribute('transform', `translate(${position2D[0]},${position2D[1]+4})`);
            textElement.setAttribute('fill', '#000');
            textElement.textContent = `${equatorCoordinates.latitude} ${equatorCoordinates.longitude}`;
            // triangleCoordinates.direction3D(direction3D, this.abandon == 'shape');
            // triangleCoordinates.fromDirection3D(direction3D, this.abandon == 'shape');
            // textElement.textContent = `${layerCoordinates.indexInStripeLayer} ${layerCoordinates.stripeLatitude} ${layerCoordinates.longitude}`;
            // textElement.textContent = `${closestPole} ${distToClosestPole}`;
            // textElement.textContent = `${layerCoordinates.indexInLayer} ${equatorCoordinates.indexInLayer}`;
            // textElement.textContent = `${triangleCoordinates.barycentric[0]} ${triangleCoordinates.barycentric[1]} ${triangleCoordinates.barycentric[2]}`;
            // tileElement.setAttribute('fill', `rgb(${triangleCoordinates.barycentric[0]*25+20}, ${triangleCoordinates.barycentric[1]*25+20}, ${triangleCoordinates.barycentric[2]*25+20})`);
            // triangleCoordinates.direction3D(position3D);
            // const distance = Math.round(10*vec3.angle(posA, position3D)));
            // tileElement.setAttribute('fill', `rgb(${distance}, ${distance}, ${distance})`);
            borderElement.setAttribute('transform', transform);
            borderElement.setAttribute('fill', 'none');
            borderElement.setAttribute('stroke', '#000');
            borderElement.setAttribute('href', (isPole) ? '#pentagon' : '#hexagon');
        };
        generateField(); // South pole
        layerCoordinates.longitude = this.gpIndex*3;
        generateField(); // North pole
        for(let longitude = this.gpIndex*3-1; longitude > 0; --longitude) {
            layerCoordinates.longitude = longitude;
            for(let indexInLayer = 0; indexInLayer < layerCoordinates.fieldCountInLayer(); ++indexInLayer) {
                layerCoordinates.setIndexInLayerAndLongitude(indexInLayer, longitude);
                generateField();
            }
        }

        /*for(let y = 0; y < this.gpIndex*5; ++y) {
            const line = createSvgElement('path', svgElement.childNodes[2]);
            line.setAttribute('stroke', '#000');
            line.setAttribute('d', `M0 ${this.edgeLength2D*(1.5*y-0.5)}H${this.textureWidth}`);
        }
        for(let x = 0; x < this.gpIndex*5; ++x) {
            const line = createSvgElement('path', svgElement.childNodes[2]);
            line.setAttribute('stroke', '#000');
            line.setAttribute('d', `M${this.fieldWidth2D*(0.5*(this.gpIndex*2)+x)} ${this.fieldHeight2D*(0.75*(this.gpIndex*3-1)+0.5)}L${this.fieldWidth2D*(0.5*(-this.gpIndex)+x)} ${this.fieldHeight2D*(0.75*(-1)+0.5)}`);
        }
        for(let x = -this.gpIndex*2; x < this.gpIndex*4; ++x) {
            const line = createSvgElement('path', svgElement.childNodes[2]);
            line.setAttribute('stroke', '#000');
            line.setAttribute('d', `M${this.fieldWidth2D*(0.5*(this.gpIndex*2)+x)} ${this.fieldHeight2D*(0.75*(this.gpIndex*3-1)+0.5)}L${this.fieldWidth2D*(0.5*(-this.gpIndex)+x+this.gpIndex*3)} ${this.fieldHeight2D*(0.75*(-1)+0.5)}`);
        }*/
        return svgElement;
    }
}
