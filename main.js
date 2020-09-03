import {vec2, vec3, quat, mat4} from './gl-matrix/index.js';
import {RenderContext, Camera} from './RenderEngine.js';

const canvas = document.getElementById('canvas'),
      unfoldSlider = document.getElementById('unfold'),
      renderContext = new RenderContext(canvas),
      rotationVelocity = quat.create(),
      rotation = quat.create(),
      rotationAxis = vec3.create();
renderContext.camera.setPerspective(45/180*Math.PI, renderContext.gl.canvas.width/renderContext.gl.canvas.height);
renderContext.camera.update();
const hoverHandler = canvas.onmousemove = (event) => {

};
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
    canvas.onmousemove = hoverHandler;
};
renderContext.renderSurface = (deltaTime) => {
    const angularVelocity = quat.getAxisAngle(rotationAxis, rotationVelocity)*0.9;
    quat.setAxisAngle(rotationVelocity, rotationAxis, angularVelocity);
    if(angularVelocity < 0.001)
        renderContext.stopRenderLoop();
    quat.multiply(rotation, rotationVelocity, rotation);
    quat.normalize(rotation, rotation);

    mat4.fromQuat(renderContext.camera.worldMatrix, rotation);
    mat4.invert(renderContext.camera.worldMatrix, renderContext.camera.worldMatrix);
    mat4.translate(renderContext.camera.worldMatrix, renderContext.camera.worldMatrix, [0, 0, 100]);
    renderContext.camera.update();

};
renderContext.renderVolume = () => {

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
