import {vec3, mat3, mat4} from './gl-matrix/index.js';
import {hexWrenchFactor, icosahedronRadiusByEdgeLength, IcosahedralClass1GoldbergPolyhedron} from './Geometry.js';

const planetCenter = vec3.create();
const normalMatrix = mat3.create();
const combinedMatrix = mat4.create();

export class Planet {
    constructor(renderContext, gpIndex) {
        this.worldMatrix = mat4.create();
        this.surfacePolyhedron = new IcosahedralClass1GoldbergPolyhedron('shape', false, gpIndex, 1.0, 30.0, Math.PI*5.5/5.0);
        this.planetRadius = this.surfacePolyhedron.sphereRadius;
        this.atmosphereRadius = this.planetRadius*1.2;
        this.atmosphereDensityFalloff = 4.0;
        const atmosphereGpIndex = 2,
              atmosphereEdgeLength3D = this.atmosphereRadius/(atmosphereGpIndex*hexWrenchFactor*icosahedronRadiusByEdgeLength);
        this.atmospherePolyhedron = new IcosahedralClass1GoldbergPolyhedron('shape', true, atmosphereGpIndex, atmosphereEdgeLength3D, 0.0, 0.0);
        this.generateSurfaceGeometry(renderContext);
        this.generateSurfaceTexture(renderContext);
        this.generateAtmosphereGeometry(renderContext);
        this.generateAtmosphereDensityMap(renderContext);
    }

    generateSurfaceGeometry(renderContext) {
        this.surfacePolyhedron.generateGeometry();
        const [vertices, elements] = this.surfacePolyhedron.generateTopologyAndTexcoords();
        this.surfacePolyhedron.vertexArray = renderContext.createVertexArray(vertices, elements);
    }

    generateSurfaceTexture(renderContext) {
        this.surfacePolyhedron.texture = renderContext.createTexture();
        renderContext.imageToTexture(this.surfacePolyhedron.texture, this.surfacePolyhedron.generateTextureImage()).then(renderContext.startRenderLoop.bind(renderContext));
    }

    generateAtmosphereGeometry(renderContext) {
        this.atmospherePolyhedron.generateGeometry();
        const [vertices, elements] = this.atmospherePolyhedron.generateTopologyAndTexcoords();
        this.atmospherePolyhedron.vertexArray = renderContext.createVertexArray(vertices, elements);
    }

    generateAtmosphereDensityMap(renderContext) {
        const atmosphereDensityFramebuffer = renderContext.gl.createFramebuffer();
        renderContext.gl.bindFramebuffer(renderContext.gl.FRAMEBUFFER, atmosphereDensityFramebuffer);
        this.atmosphereDensityMap = renderContext.createTexture(renderContext.gl.NEAREST, renderContext.gl.NEAREST);
        renderContext.createFramebufferAttachment(renderContext.gl.COLOR_ATTACHMENT0, renderContext.gl.RG32F, this.atmosphereDensityMap);
        renderContext.gl.useProgram(renderContext.atmosphereDensityShader);
        renderContext.gl.uniform1f(renderContext.gl.getUniformLocation(renderContext.atmosphereDensityShader, 'atmosphereRadius'), this.atmosphereRadius);
        renderContext.gl.uniform1f(renderContext.gl.getUniformLocation(renderContext.atmosphereDensityShader, 'planetRadius'), this.planetRadius);
        renderContext.gl.uniform1f(renderContext.gl.getUniformLocation(renderContext.atmosphereDensityShader, 'atmosphereDensityFalloff'), this.atmosphereDensityFalloff);
        renderContext.gl.bindVertexArray(renderContext.fullScreenVertexArray);
        renderContext.gl.drawArrays(renderContext.gl.TRIANGLE_FAN, 0, 4);
        renderContext.gl.deleteFramebuffer(atmosphereDensityFramebuffer);
    }

    renderSurface(renderContext) {
        mat3.fromMat4(normalMatrix, this.worldMatrix);
        renderContext.gl.uniformMatrix4fv(renderContext.gl.getUniformLocation(renderContext.surfaceShader, 'worldMatrix'), false, this.worldMatrix);
        renderContext.gl.uniformMatrix3fv(renderContext.gl.getUniformLocation(renderContext.surfaceShader, 'normalMatrix'), false, normalMatrix);
        renderContext.gl.uniformMatrix4fv(renderContext.gl.getUniformLocation(renderContext.surfaceShader, 'cameraCombinedMatrix'), false, renderContext.camera.combinedMatrix);
        renderContext.bindTexture(0, this.surfacePolyhedron.texture);
        renderContext.gl.bindVertexArray(this.surfacePolyhedron.vertexArray);
        renderContext.gl.drawElements(renderContext.gl.TRIANGLE_FAN, this.surfacePolyhedron.fieldCount*this.surfacePolyhedron.elementsPerField, renderContext.gl.UNSIGNED_SHORT, 0);
    }

    renderVolume(renderContext) {
        mat4.getTranslation(planetCenter, this.worldMatrix);
        mat4.multiply(combinedMatrix, renderContext.camera.combinedMatrix, this.worldMatrix);
        renderContext.gl.enable(renderContext.gl.BLEND);
        renderContext.gl.blendFunc(renderContext.gl.ONE, renderContext.gl.ONE_MINUS_SRC_ALPHA);
        renderContext.gl.useProgram(renderContext.atmosphereScatteringShader);
        renderContext.gl.uniformMatrix4fv(renderContext.gl.getUniformLocation(renderContext.atmosphereScatteringShader, 'cameraCombinedMatrix'), false, combinedMatrix);
        renderContext.gl.uniformMatrix4fv(renderContext.gl.getUniformLocation(renderContext.atmosphereScatteringShader, 'cameraProjectionMatrix'), false, renderContext.camera.projectionMatrix);
        renderContext.gl.uniformMatrix4fv(renderContext.gl.getUniformLocation(renderContext.atmosphereScatteringShader, 'cameraInverseCombinedMatrix'), false, renderContext.camera.inverseCombinedMatrix);
        renderContext.gl.uniformMatrix4fv(renderContext.gl.getUniformLocation(renderContext.atmosphereScatteringShader, 'cameraWorldMatrix'), false, renderContext.camera.worldMatrix);
        renderContext.gl.uniform3fv(renderContext.gl.getUniformLocation(renderContext.atmosphereScatteringShader, 'sunLightDirection'), renderContext.sunLightDirection);
        renderContext.gl.uniform3fv(renderContext.gl.getUniformLocation(renderContext.atmosphereScatteringShader, 'planetCenter'), planetCenter);
        renderContext.gl.uniform1f(renderContext.gl.getUniformLocation(renderContext.atmosphereScatteringShader, 'atmosphereRadius'), this.atmosphereRadius);
        renderContext.gl.uniform1f(renderContext.gl.getUniformLocation(renderContext.atmosphereScatteringShader, 'planetRadius'), this.planetRadius);
        renderContext.bindTexture(0, renderContext.depthBuffer); // renderContext.gBuffers[1]
        renderContext.bindTexture(1, this.atmosphereDensityMap);
        renderContext.gl.bindVertexArray(this.atmospherePolyhedron.vertexArray);
        renderContext.gl.drawElements(renderContext.gl.TRIANGLE_FAN, this.atmospherePolyhedron.fieldCount*this.atmospherePolyhedron.elementsPerField, renderContext.gl.UNSIGNED_SHORT, 0);
        renderContext.gl.disable(renderContext.gl.BLEND);
    }
}
