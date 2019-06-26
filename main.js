import {vec2, vec3, quat, mat3, mat4} from './gl-matrix.js';
import {IcosahedralClass1GoldbergPolyhedron} from './Geometry.js';
import {RenderContext, Camera} from './RenderEngine.js';

const renderContext = new RenderContext(document.getElementById('canvas')),
      polyhedron = new IcosahedralClass1GoldbergPolyhedron('shape', false, 20, 1.0, 30.0),
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
renderContext.renderImageToTexture(polyhedron.texture, polyhedron.generateTextureImage());

mat4.translate(camera.worldMatrix, camera.worldMatrix, [0, 0, 100]);
camera.setPerspective(45/180*Math.PI, renderContext.gl.canvas.width/renderContext.gl.canvas.height);
camera.update();
renderContext.render = (deltaTime) => {
    quat.setAxisAngle(rotationVelocity, rotationAxis, quat.getAxisAngle(rotationAxis, rotationVelocity)*0.9);
    quat.multiply(rotation, rotationVelocity, rotation);
    quat.normalize(rotation, rotation);
    mat4.fromQuat(worldMatrix, rotation);
    mat3.fromMat4(normalMatrix, worldMatrix);
    renderContext.gl.uniformMatrix4fv(renderContext.gl.getUniformLocation(renderContext.firstPass, 'worldMatrix'), false, worldMatrix);
    renderContext.gl.uniformMatrix3fv(renderContext.gl.getUniformLocation(renderContext.firstPass, 'normalMatrix'), false, normalMatrix);
    renderContext.gl.uniformMatrix4fv(renderContext.gl.getUniformLocation(renderContext.firstPass, 'projectionMatrix'), false, camera.combinedMatrix);
    renderContext.gl.uniform1f(renderContext.gl.getUniformLocation(renderContext.firstPass, 'unfold'), document.getElementById('unfold').value);
    renderContext.bindTexture(0, polyhedron.texture);
    renderContext.gl.bindVertexArray(polyhedron.vertexArray);
    renderContext.gl.drawElements(renderContext.gl.TRIANGLE_FAN, polyhedron.fieldCount*polyhedron.elementsPerField, renderContext.gl.UNSIGNED_SHORT, 0);
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
