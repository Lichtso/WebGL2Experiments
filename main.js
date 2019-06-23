import {vec3, quat, mat3, mat4} from './gl-matrix.js';
import {IcosahedralClass1GoldbergPolyhedron} from './Geometry.js';
import {RenderContext, Camera} from './RenderEngine.js';

const renderContext = new RenderContext(document.getElementById('canvas')),
      svgElement = document.getElementById('svg'),
      ctx = document.createElement('canvas').getContext('2d'),
      polyhedron = new IcosahedralClass1GoldbergPolyhedron(renderContext, 'shape', false, 20, 1.0, 30.0),
      texture = renderContext.createTexture(renderContext.gl.LINEAR_MIPMAP_LINEAR, renderContext.gl.LINEAR),
      camera = new Camera(),
      rotationVelocity = quat.create(),
      rotation = quat.create(),
      worldMatrix = mat4.create(),
      normalMatrix = mat3.create(),
      rotationAxis = vec3.create();
mat4.translate(camera.worldMatrix, camera.worldMatrix, [0, 0, 100]);
camera.setPerspective(45/180*Math.PI, renderContext.gl.canvas.width/renderContext.gl.canvas.height);
camera.update();
renderContext.render = (deltaTime) => {
    quat.setAxisAngle(rotationVelocity, rotationAxis, quat.getAxisAngle(rotationAxis, rotationVelocity)*deltaTime*50.0);
    quat.multiply(rotation, rotationVelocity, rotation);
    quat.normalize(rotation, rotation);
    mat4.fromQuat(worldMatrix, rotation);
    mat3.fromMat4(normalMatrix, worldMatrix);
    renderContext.gl.uniformMatrix4fv(renderContext.gl.getUniformLocation(renderContext.firstPass, 'worldMatrix'), false, worldMatrix);
    renderContext.gl.uniformMatrix3fv(renderContext.gl.getUniformLocation(renderContext.firstPass, 'normalMatrix'), false, normalMatrix);
    renderContext.gl.uniformMatrix4fv(renderContext.gl.getUniformLocation(renderContext.firstPass, 'projectionMatrix'), false, camera.combinedMatrix);
    renderContext.bindTexture(0, texture);
    polyhedron.render();
};

document.body.onkeydown = (event) => {
    const angle = 0.01,
          deltaRotation = quat.create();
    switch(event.key) {
        case 'w':
            quat.setAxisAngle(deltaRotation, [1, 0, 0], angle);
            break;
        case 's':
            quat.setAxisAngle(deltaRotation, [-1, 0, 0], angle);
            break;
        case 'a':
            quat.setAxisAngle(deltaRotation, [0, 0, -1], angle);
            break;
        case 'd':
            quat.setAxisAngle(deltaRotation, [0, 0, 1], angle);
            break;
    }
    quat.multiply(rotationVelocity, deltaRotation, rotationVelocity);
};

function generateSvgElement(tag, parentNode) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if(parentNode)
        parentNode.appendChild(node);
    return node;
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
    const defs = generateSvgElement('defs', svgElement),
          outlineFilter = generateSvgElement('filter', defs),
          feMorphology = generateSvgElement('feMorphology', outlineFilter),
          feMerge = generateSvgElement('feMerge', outlineFilter),
          feMergeNodeA = generateSvgElement('feMergeNode', feMerge),
          feMergeNodeB = generateSvgElement('feMergeNode', feMerge),
          pentagonElement = generateSvgElement('path', defs),
          hexagonElement = generateSvgElement('path', defs),
          groundLayer = generateSvgElement('g', svgElement),
          gridLayer = generateSvgElement('g', svgElement);
    outlineFilter.setAttribute('id', 'outlineFilter');
    feMorphology.setAttribute('id', 'SourceAlpha');
    feMorphology.setAttribute('result', 'dilated');
    feMorphology.setAttribute('operator', 'dilate');
    feMorphology.setAttribute('radius', '1');
    feMergeNodeA.setAttribute('in', 'dilated');
    feMergeNodeB.setAttribute('in', 'SourceGraphic');
    let path = '';
    for(let i = 0; i < 5; ++i) {
        const angle = Math.PI*2/5*i;
        path += (i == 0) ? 'M' : 'L';
        path += Math.round(Math.sin(angle)*polyhedron.texcoordPentagonRadius)+','+Math.round(Math.cos(angle)*polyhedron.texcoordPentagonRadius);
    }
    pentagonElement.setAttribute('id', 'pentagon');
    pentagonElement.setAttribute('d', path+'Z');
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
    groundLayer.setAttribute('filter', 'url(#outlineFilter)');
    groundLayer.onclick = () => {
        gridLayer.setAttribute('opacity', (gridLayer.getAttribute('opacity') != 0) ? 0 : 1);
        renderContext.renderImageToTexture(svgElement, texture);
    };

    const srcColors = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height).data; // new Uint8Array(.buffer)
    for(let layerIndex = polyhedron.gpIndex*3; layerIndex >= 0; --layerIndex)
        for(let indexInLayer = 0; indexInLayer < polyhedron.getFieldCountAtLayer(layerIndex); ++indexInLayer) {
            const fieldIndex = polyhedron.getFieldIndex(indexInLayer, layerIndex),
                  isPole = polyhedron.isPole(indexInLayer, layerIndex),
                  posX = polyhedron.fieldTexcoords[fieldIndex*2+0],
                  posY = polyhedron.fieldTexcoords[fieldIndex*2+1],
                  pixelIndex = (Math.round(posY)*devicePixelRatio*ctx.canvas.width+Math.round(posX)*devicePixelRatio),
                  tileElement = generateSvgElement('use', groundLayer),
                  textElement = generateSvgElement('text', gridLayer),
                  borderElement = generateSvgElement('use', gridLayer);
            if(isPole && fieldIndex < polyhedron.fieldCount/2)
                tileElement.setAttribute('transform', 'translate('+posX+','+posY+') rotate(37)');
            else
                tileElement.setAttribute('transform', 'translate('+posX+','+posY+')');
            const rgb = srcColors.slice(pixelIndex*4, pixelIndex*4+3);
            tileElement.setAttribute('fill', (rgb[2] < 200) ? '#5E5' : '#3AF');
            tileElement.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', (isPole) ? '#pentagon' : '#hexagon');
            textElement.setAttribute('transform', 'translate('+posX+','+(posY+4)+')');
            textElement.textContent = indexInLayer+' '+layerIndex;
        }
    renderContext.renderImageToTexture(svgElement, texture);
};
