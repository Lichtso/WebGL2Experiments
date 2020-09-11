import {vec3, mat4} from './gl-matrix/index.js';
import {IcosahedralClass1GoldbergPolyhedron} from './Geometry.js';
import {renderContext} from './RenderEngine.js';

const atmosphereScale = vec3.create(),
      atmosphereWorldMatrix = mat4.create(),
      atmospherePolyhedron = new IcosahedralClass1GoldbergPolyhedron('shape', true);
{
    atmospherePolyhedron.generateGeometry();
    const [vertices, elements] = atmospherePolyhedron.generateTopologyAndTexcoords();
    atmospherePolyhedron.vertexArray = renderContext.createVertexArray(vertices, elements);
}

export class Planet {
    constructor(gpIndex) {
        this.worldMatrix = mat4.create();
        this.surfacePolyhedron = new IcosahedralClass1GoldbergPolyhedron('shape', false, gpIndex, 1.0, 30.0);
        this.surfacePolyhedron .generateGeometry();
        const [vertices, elements] = this.surfacePolyhedron .generateTopologyAndTexcoords();
        this.surfacePolyhedron .vertexArray = renderContext.createVertexArray(vertices, elements);
        this.planetRadius = this.surfacePolyhedron.sphereRadius;
        this.generateSurfaceTexture();
        this.atmosphereRadius = this.planetRadius*1.2;
        this.atmosphereDensityFalloff = 4.0;
        this.generateAtmosphereDensityMap();
    }

    generateSurfaceTexture() {
        this.surfaceTexture = renderContext.createTexture();
        return renderContext.imageToTexture(this.surfaceTexture, this.surfacePolyhedron.generateTextureImage()).then(renderContext.startRenderLoop.bind(renderContext));
    }

    generateAtmosphereDensityMap() {
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

    renderSurface() {
        renderContext.camera.setSurfaceShaderUniforms(renderContext.surfaceShader, this.worldMatrix);
        renderContext.bindTexture(0, this.surfaceTexture);
        renderContext.gl.bindVertexArray(this.surfacePolyhedron.vertexArray);
        renderContext.gl.drawElements(renderContext.gl.TRIANGLE_FAN, this.surfacePolyhedron.fieldCount*this.surfacePolyhedron.elementsPerField, renderContext.gl.UNSIGNED_SHORT, 0);
    }

    renderVolume() {
        renderContext.gl.enable(renderContext.gl.BLEND);
        renderContext.gl.blendFunc(renderContext.gl.ONE, renderContext.gl.ONE_MINUS_SRC_ALPHA);
        renderContext.gl.useProgram(renderContext.atmosphereScatteringShader);
        vec3.set(atmosphereScale, this.atmosphereRadius, this.atmosphereRadius, this.atmosphereRadius);
        mat4.scale(atmosphereWorldMatrix, this.worldMatrix, atmosphereScale);
        renderContext.camera.setVolumeShaderUniforms(renderContext.atmosphereScatteringShader, atmosphereWorldMatrix);
        renderContext.gl.uniform3fv(renderContext.gl.getUniformLocation(renderContext.atmosphereScatteringShader, 'sunLightDirection'), renderContext.sunLightDirection);
        renderContext.gl.uniform1f(renderContext.gl.getUniformLocation(renderContext.atmosphereScatteringShader, 'atmosphereRadius'), this.atmosphereRadius);
        renderContext.gl.uniform1f(renderContext.gl.getUniformLocation(renderContext.atmosphereScatteringShader, 'planetRadius'), this.planetRadius);
        renderContext.bindTexture(0, renderContext.depthBuffer); // renderContext.gBuffers[1]
        renderContext.bindTexture(1, this.atmosphereDensityMap);
        renderContext.gl.bindVertexArray(atmospherePolyhedron.vertexArray);
        renderContext.gl.drawElements(renderContext.gl.TRIANGLE_FAN, atmospherePolyhedron.fieldCount*atmospherePolyhedron.elementsPerField, renderContext.gl.UNSIGNED_SHORT, 0);
        renderContext.gl.disable(renderContext.gl.BLEND);
    }
}
