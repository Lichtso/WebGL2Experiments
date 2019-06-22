import * as linearAlgebra from './gl-matrix.js';
import {IcosahedralClass1GoldbergPolyhedron} from './Geometry.js';
import {RenderContext, Camera} from './RenderEngine.js';

const renderContext = new RenderContext(document.getElementById('canvas')),
      svgElement = document.getElementById('svg'),
      ctx = document.createElement('canvas').getContext('2d'),
      polyhedron = new IcosahedralClass1GoldbergPolyhedron(renderContext, 10),
      texture = renderContext.createTexture(renderContext.gl.LINEAR_MIPMAP_LINEAR, renderContext.gl.LINEAR),
      camera = new Camera(),
      rotationVelocity = linearAlgebra.quat.create(),
      rotation = linearAlgebra.quat.create(),
      worldMatrix = linearAlgebra.mat4.create(),
      normalMatrix = linearAlgebra.mat3.create();
camera.setOrtho(10, 10);
camera.update();
renderContext.render = (deltaTime) => {
    linearAlgebra.quat.multiply(rotation, rotationVelocity, rotation);
    const rotationAxis = linearAlgebra.vec3.create();
    linearAlgebra.quat.setAxisAngle(rotationVelocity, rotationAxis, linearAlgebra.quat.getAxisAngle(rotationAxis, rotationVelocity)*deltaTime*50.0);
    linearAlgebra.mat4.fromQuat(worldMatrix, rotation);
    linearAlgebra.mat3.fromMat4(normalMatrix, worldMatrix);
    renderContext.gl.uniformMatrix4fv(renderContext.gl.getUniformLocation(renderContext.firstPass, 'worldMatrix'), false, worldMatrix);
    renderContext.gl.uniformMatrix3fv(renderContext.gl.getUniformLocation(renderContext.firstPass, 'normalMatrix'), false, normalMatrix);
    renderContext.gl.uniformMatrix4fv(renderContext.gl.getUniformLocation(renderContext.firstPass, 'projectionMatrix'), false, camera.combinedMatrix);
    renderContext.bindTexture(0, texture);
    polyhedron.render();
};

document.body.onkeydown = (event) => {
    const angle = 0.01,
          deltaRotation = linearAlgebra.quat.create();
    switch(event.key) {
        case 'w':
            linearAlgebra.quat.setAxisAngle(deltaRotation, [1, 0, 0], angle);
            break;
        case 's':
            linearAlgebra.quat.setAxisAngle(deltaRotation, [-1, 0, 0], angle);
            break;
        case 'a':
            linearAlgebra.quat.setAxisAngle(deltaRotation, [0, 0, -1], angle);
            break;
        case 'd':
            linearAlgebra.quat.setAxisAngle(deltaRotation, [0, 0, 1], angle);
            break;
    }
    linearAlgebra.quat.multiply(rotationVelocity, deltaRotation, rotationVelocity);
};

function generateSvgElement(tag) {
    return document.createElementNS('http://www.w3.org/2000/svg', tag);
}
ctx.canvas.width = polyhedron.textureWidth*devicePixelRatio;
ctx.canvas.height = polyhedron.textureHeight*devicePixelRatio;
const srcImage = new Image();
srcImage.onload = () => {
    ctx.drawImage(srcImage, 0, 0, ctx.canvas.width, ctx.canvas.height);
    svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgElement.setAttribute('width', polyhedron.textureWidth);
    svgElement.setAttribute('height', polyhedron.textureHeight);
    svgElement.setAttribute('text-anchor', 'middle');
    svgElement.setAttribute('font-family', 'Helvetica');
    svgElement.setAttribute('font-size', '12');
    svgElement.setAttribute('shape-rendering', 'crispEdges');
    const defs = generateSvgElement('defs'),
          pentagonElement = generateSvgElement('path'),
          hexagonElement = generateSvgElement('path'),
          fieldLayer = generateSvgElement('g'),
          coordinateLayer = generateSvgElement('g');
    let path = '';
    for(let i = 0; i < 5; ++i) {
        const angle = Math.PI*2/5*i;
        path += (i == 0) ? 'M' : 'L';
        path += Math.round(Math.sin(angle)*polyhedron.texcoordPentagonRadius)+','+Math.round(Math.cos(angle)*polyhedron.texcoordPentagonRadius);
    }
    pentagonElement.setAttribute('id', 'pentagon');
    pentagonElement.setAttribute('d', path+'Z');
    defs.appendChild(pentagonElement);
    hexagonElement.setAttribute('id', 'hexagon');
    hexagonElement.setAttribute('d',
        'M'+(polyhedron.texcoordWidth*0.5)+','+(polyhedron.texcoordHeight*0.25)+
        'L'+(polyhedron.texcoordWidth*0.5)+','+(-polyhedron.texcoordHeight*0.25)+
        'L0,'+(-polyhedron.texcoordHeight*0.5)+
        'L'+(-polyhedron.texcoordWidth*0.5)+','+(-polyhedron.texcoordHeight*0.25)+
        'L'+(-polyhedron.texcoordWidth*0.5)+','+(polyhedron.texcoordHeight*0.25)+
        'L0,'+(polyhedron.texcoordHeight*0.5)+
        'Z'
    );
    defs.appendChild(hexagonElement);
    svgElement.appendChild(defs);
    svgElement.appendChild(fieldLayer);
    svgElement.appendChild(coordinateLayer);
    fieldLayer.onclick = () => {
        coordinateLayer.setAttribute('opacity', (coordinateLayer.getAttribute('opacity') != 0) ? 0 : 1);
        renderContext.renderImageToTexture(svgElement, texture);
    };
    const srcColors = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height).data; // new Uint8Array(.buffer)
    for(let layerIndex = polyhedron.gpIndex*3; layerIndex >= 0; --layerIndex)
        for(let indexInLayer = 0; indexInLayer < polyhedron.getFieldVertexCountAtLayer(layerIndex); ++indexInLayer) {
            const fieldVertexIndex = polyhedron.getFieldVertexIndex(indexInLayer, layerIndex),
                  vertexOffset = fieldVertexIndex*2,
                  isPole = polyhedron.isPole(indexInLayer, layerIndex),
                  posX = polyhedron.fieldVertexTexcoords[vertexOffset+0],
                  posY = polyhedron.fieldVertexTexcoords[vertexOffset+1],
                  pixelIndex = (Math.round(posY)*devicePixelRatio*ctx.canvas.width+Math.round(posX)*devicePixelRatio)*4,
                  useElement = generateSvgElement('use'),
                  textElement = generateSvgElement('text');
            if(isPole && fieldVertexIndex < polyhedron.fieldVertexCount/2)
                useElement.setAttribute('transform', 'translate('+posX+','+posY+') rotate(36)');
            else
                useElement.setAttribute('transform', 'translate('+posX+','+posY+')');
            const rgb = srcColors.slice(pixelIndex, pixelIndex+3);
            useElement.setAttribute('fill', (rgb[2] < 200) ? '#5E5' : '#3AF');
            useElement.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', (isPole) ? '#pentagon' : '#hexagon');
            fieldLayer.appendChild(useElement);
            textElement.setAttribute('transform', 'translate('+posX+','+(posY+4)+')');
            textElement.textContent = indexInLayer+' '+layerIndex;
            coordinateLayer.appendChild(textElement);
        }
    renderContext.renderImageToTexture(svgElement, texture);
};
