const linearAlgebra = require('./gl-matrix/src/gl-matrix.js'),
      geometry = require('./geometry.js'),
      RenderEngine = require('./RenderEngine.js'),
      RenderContext = new RenderEngine.RenderContext(document.getElementById('canvas')),
      svgElement = document.getElementById('svg'),
      ctx = document.createElement('canvas').getContext('2d'),
      polyhedron = new geometry.IcosahedralClass1GoldbergPolyhedron(RenderContext, 10),
      texture = RenderContext.createTexture(RenderContext.gl.LINEAR_MIPMAP_LINEAR, RenderContext.gl.LINEAR),
      camera = new RenderEngine.Camera(),
      worldMatrix = linearAlgebra.mat4.create();
camera.setOrtho(10, 10);
camera.update();
var rotation = 0;
RenderContext.render = function(deltaTime) {
    rotation += 0.1*deltaTime;
    linearAlgebra.mat4.fromYRotation(worldMatrix, rotation);
    RenderContext.gl.uniformMatrix4fv(RenderContext.gl.getUniformLocation(RenderContext.program, 'worldMatrix'), false, worldMatrix);
    RenderContext.gl.uniformMatrix4fv(RenderContext.gl.getUniformLocation(RenderContext.program, 'projectionMatrix'), false, camera.combinedMatrix);
    RenderContext.bindTexture(0, texture);
    polyhedron.render();
};

function generateSvgElement(tag) {
    return document.createElementNS('http://www.w3.org/2000/svg', tag);
}

ctx.canvas.width = polyhedron.textureWidth*devicePixelRatio;
ctx.canvas.height = polyhedron.textureHeight*devicePixelRatio;
function generateTexture() {
    svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgElement.setAttribute('width', polyhedron.textureWidth);
    svgElement.setAttribute('height', polyhedron.textureHeight);
    svgElement.setAttribute('text-anchor', 'middle');
    svgElement.setAttribute('font-family', 'Helvetica');
    svgElement.setAttribute('font-size', '12');
    const defs = generateSvgElement('defs'),
          pentagonElement = generateSvgElement('path'),
          hexagonElement = generateSvgElement('path'),
          fieldLayer = generateSvgElement('g'),
          coordinateLayer = generateSvgElement('g');
    var path = '';
    for(var i = 0; i < 5; ++i) {
        const angle = Math.PI*2/5*i;
        path += (i == 0) ? 'M' : 'L';
        path += Math.round(Math.sin(angle)*polyhedron.texcoordPentagonRadius)+','+Math.round(Math.cos(angle)*polyhedron.texcoordPentagonRadius);
    }
    pentagonElement.setAttribute('id', 'pentagon');
    pentagonElement.setAttribute('d', path+'Z');
    defs.appendChild(pentagonElement);
    hexagonElement.setAttribute('id', 'hexagon');
    hexagonElement.setAttribute('d',
        'M'+Math.ceil(polyhedron.texcoordWidth*0.5)+','+Math.ceil(polyhedron.texcoordHeight*0.25)+
        'L'+Math.ceil(polyhedron.texcoordWidth*0.5)+','+Math.floor(-polyhedron.texcoordHeight*0.25)+
        'L0,'+Math.floor(-polyhedron.texcoordHeight*0.5)+
        'L'+Math.floor(-polyhedron.texcoordWidth*0.5)+','+Math.floor(-polyhedron.texcoordHeight*0.25)+
        'L'+Math.floor(-polyhedron.texcoordWidth*0.5)+','+Math.ceil(polyhedron.texcoordHeight*0.25)+
        'L0,'+Math.ceil(polyhedron.texcoordHeight*0.5)+
        'Z'
    );
    defs.appendChild(hexagonElement);
    svgElement.appendChild(defs);
    svgElement.appendChild(fieldLayer);
    svgElement.appendChild(coordinateLayer);
    fieldLayer.onclick = function() {
        coordinateLayer.setAttribute('opacity', (coordinateLayer.getAttribute('opacity') != 0) ? 0 : 1);
        RenderContext.renderImageToTexture(svgElement, texture);
    };
    for(var layerIndex = polyhedron.gpIndex*3; layerIndex >= 0; --layerIndex)
        for(var indexInLayer = 0; indexInLayer < polyhedron.getFieldVertexCountAtLayer(layerIndex); ++indexInLayer) {
            const fieldVertexIndex = polyhedron.getFieldVertexIndex(indexInLayer, layerIndex),
                  vertexOffset = fieldVertexIndex*2,
                  isPole = polyhedron.isPole(indexInLayer, layerIndex),
                  posX = Math.round(polyhedron.fieldVertexTexcoords[vertexOffset+0]),
                  posY = Math.round(polyhedron.fieldVertexTexcoords[vertexOffset+1]),
                  pixelIndex = (posY*devicePixelRatio*ctx.canvas.width+posX*devicePixelRatio)*4,
                  useElement = generateSvgElement('use'),
                  textElement = generateSvgElement('text');
            if(isPole && fieldVertexIndex < polyhedron.fieldVertexCount/2)
                useElement.setAttribute('transform', 'translate('+posX+','+posY+') rotate(36)');
            else
                useElement.setAttribute('transform', 'translate('+posX+','+posY+')');
            useElement.setAttribute('fill', (Math.random() < 0.5) ? '#5E5' : '#3AF');
            useElement.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', (isPole) ? '#pentagon' : '#hexagon');
            fieldLayer.appendChild(useElement);
            textElement.setAttribute('transform', 'translate('+posX+','+(posY+4)+')');
            textElement.textContent = indexInLayer+' '+layerIndex;
            coordinateLayer.appendChild(textElement);
        }
    RenderContext.renderImageToTexture(svgElement, texture);
};
generateTexture();
