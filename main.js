import {vec2, vec3, quat, mat3, mat4} from './gl-matrix.js';
import {IcosahedralClass1GoldbergPolyhedron} from './Geometry.js';
import {RenderContext, Camera} from './RenderEngine.js';

const canvas = document.getElementById('canvas'),
      unfoldSlider = document.getElementById('unfold'),
      renderContext = new RenderContext(canvas),
      polyhedron = new IcosahedralClass1GoldbergPolyhedron('shape', false, 10, 1.0, 30.0),
      camera = new Camera(),
      rotationVelocity = quat.create(),
      rotation = quat.create(),
      worldMatrix = mat4.create(),
      normalMatrix = mat3.create(),
      rotationAxis = vec3.create();
polyhedron.generateGeometry();
const [vertices, elements] = polyhedron.generateTopologyAndTexcoords();
polyhedron.vertexArray = renderContext.createVertexArray(vertices, elements);
polyhedron.texture = renderContext.createTexture();
renderContext.imageToTexture(polyhedron.texture, polyhedron.generateTextureImage()).then(renderContext.startRenderLoop.bind(renderContext));
renderContext.gl.useProgram(renderContext.firstPass);
renderContext.gl.uniform1f(renderContext.gl.getUniformLocation(renderContext.firstPass, 'sphereRadius'), polyhedron.sphereRadius);
renderContext.gl.uniform1f(renderContext.gl.getUniformLocation(renderContext.firstPass, 'widthInRadians'), polyhedron.textureWidth/(polyhedron.fieldWidth2D*polyhedron.gpIndex*5)*Math.PI*2.0);
mat4.translate(camera.worldMatrix, camera.worldMatrix, [0, 0, 100]);
camera.setPerspective(45/180*Math.PI, renderContext.gl.canvas.width/renderContext.gl.canvas.height);
camera.update();
canvas.onmousedown = (event) => {
    const dragOrigin = vec2.fromValues(event.pageX, event.pageY),
          prevRotation = quat.clone(rotation);
    canvas.onmousemove = (event) => {
        const rotationAxis = vec3.fromValues(event.pageY-dragOrigin[1], event.pageX-dragOrigin[0], 0.0),
              rotationAngle = vec3.length(rotationAxis)*0.005,
              addRotation = quat.create();
        vec3.normalize(rotationAxis, rotationAxis);
        quat.setAxisAngle(addRotation, rotationAxis, rotationAngle);
        quat.multiply(rotation, addRotation, prevRotation);
        renderContext.startRenderLoop();
    };
};
canvas.onmouseup = canvas.onmouseout = (event) => {
    canvas.onmousemove = undefined;
};
renderContext.render = (deltaTime) => {
    const angularVelocity = quat.getAxisAngle(rotationAxis, rotationVelocity)*0.9;
    quat.setAxisAngle(rotationVelocity, rotationAxis, angularVelocity);
    if(angularVelocity < 0.001)
        renderContext.stopRenderLoop();
    quat.multiply(rotation, rotationVelocity, rotation);
    quat.normalize(rotation, rotation);
    mat4.fromQuat(worldMatrix, rotation);
    mat3.fromMat4(normalMatrix, worldMatrix);
    renderContext.gl.uniformMatrix4fv(renderContext.gl.getUniformLocation(renderContext.firstPass, 'worldMatrix'), false, worldMatrix);
    renderContext.gl.uniformMatrix3fv(renderContext.gl.getUniformLocation(renderContext.firstPass, 'normalMatrix'), false, normalMatrix);
    renderContext.gl.uniformMatrix4fv(renderContext.gl.getUniformLocation(renderContext.firstPass, 'projectionMatrix'), false, camera.combinedMatrix);
    renderContext.gl.uniform1f(renderContext.gl.getUniformLocation(renderContext.firstPass, 'unfold'), unfoldSlider.value);
    renderContext.bindTexture(0, polyhedron.texture);
    renderContext.gl.bindVertexArray(polyhedron.vertexArray);
    renderContext.gl.drawElements(renderContext.gl.TRIANGLE_FAN, polyhedron.fieldCount*polyhedron.elementsPerField, renderContext.gl.UNSIGNED_SHORT, 0);
};
unfoldSlider.oninput = renderContext.startRenderLoop.bind(renderContext);
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
        case 'd':
            quat.setAxisAngle(deltaRotation, [0, -1, 0], angle);
            break;
        case 'a':
            quat.setAxisAngle(deltaRotation, [0, 1, 0], angle);
            break;
        case 'q':
            quat.setAxisAngle(deltaRotation, [0, 0, -1], angle);
            break;
        case 'e':
            quat.setAxisAngle(deltaRotation, [0, 0, 1], angle);
            break;
    }
    quat.multiply(rotationVelocity, deltaRotation, rotationVelocity);
    renderContext.startRenderLoop();
};
