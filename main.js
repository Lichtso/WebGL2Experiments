import {vec2, vec3, quat, mat4} from './gl-matrix/index.js';
import {RenderContext, Camera} from './RenderEngine.js';
import {EquatorCoordinates} from './Geometry.js';
import {Planet} from './Planet.js';

const canvas = document.getElementById('canvas'),
      unfoldSlider = document.getElementById('unfold'),
      renderContext = new RenderContext(canvas),
      planet = new Planet(renderContext, 10),
      rotationVelocity = quat.create(),
      rotation = quat.create(),
      rotationAxis = vec3.create();
renderContext.camera.setPerspective(45/180*Math.PI, renderContext.gl.canvas.width/renderContext.gl.canvas.height);
renderContext.camera.update();
renderContext.gl.useProgram(renderContext.surfaceShader);
renderContext.gl.uniform1f(renderContext.gl.getUniformLocation(renderContext.surfaceShader, 'sphereRadius'), planet.surfacePolyhedron.sphereRadius);
renderContext.gl.uniform1f(renderContext.gl.getUniformLocation(renderContext.surfaceShader, 'widthInRadians'), planet.surfacePolyhedron.textureWidth/(planet.surfacePolyhedron.fieldWidth2D*planet.surfacePolyhedron.gpIndex*5)*Math.PI*2.0);
const hoverHandler = canvas.onmousemove = (event) => {
    const texcoord = renderContext.getTexcoordAt(renderContext.devicePixelRatio*(event.pageX-canvas.offsetLeft), canvas.height-renderContext.devicePixelRatio*(event.pageY-canvas.offsetTop));
    if(texcoord[0] > 0 || texcoord[1] > 0) {
        const equatorCoordinates = new EquatorCoordinates(planet.surfacePolyhedron.gpIndex);
        planet.surfacePolyhedron.equatorCoordinatesFromPosition2D(equatorCoordinates, [texcoord[0]*planet.surfacePolyhedron.textureWidth, texcoord[1]*planet.surfacePolyhedron.textureHeight]);
        message.textContent = equatorCoordinates.latitude+' '+equatorCoordinates.longitude;
    } else
        message.textContent = 'None';
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
    mat4.translate(renderContext.camera.worldMatrix, renderContext.camera.worldMatrix, [0, 0, 50]);
    renderContext.camera.update();

    renderContext.gl.uniform1f(renderContext.gl.getUniformLocation(renderContext.surfaceShader, 'unfold'), unfoldSlider.value);
    planet.renderSurface(renderContext);
};
renderContext.renderVolume = () => {
    planet.renderVolume(renderContext);
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
