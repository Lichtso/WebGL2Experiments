import {vec3, vec4, mat3, mat4} from './gl-matrix/index.js';
import * as ClearShader from './ClearShader.js';
import * as SurfaceShader from './SurfaceShader.js';
import * as CombineShader from './CombineShader.js';
import * as AtmosphereDensityShader from './AtmosphereDensityShader.js';
import * as AtmosphereScatteringShader from './AtmosphereScatteringShader.js';

const pixel = new Uint32Array(4),
      normalMatrix = mat3.create(),
      combinedMatrix = mat4.create();

export class Camera {
    constructor() {
        this.near = 1.0;
        this.far = 1000.0;
        this.worldMatrix = mat4.create();
        this.projectionMatrix = mat4.create();
        this.inverseCombinedMatrix = mat4.create();
        this.combinedMatrix = mat4.create();
    }

    setPerspective(fov, aspect) {
        mat4.perspective(this.projectionMatrix, fov, aspect, this.near, this.far);
    }

    setOrtho(width, height) {
        mat4.ortho(this.projectionMatrix, -width, width, -height, height, this.near, this.far);
    }

    update() {
        mat4.invert(this.combinedMatrix, this.worldMatrix);
        mat4.multiply(this.combinedMatrix, this.projectionMatrix, this.combinedMatrix);
        mat4.invert(this.inverseCombinedMatrix, this.combinedMatrix);
    }

    setSurfaceShaderUniforms(shader, worldMatrix) {
        mat3.fromMat4(normalMatrix, worldMatrix);
        renderContext.gl.uniformMatrix4fv(renderContext.gl.getUniformLocation(shader, 'worldMatrix'), false, worldMatrix);
        renderContext.gl.uniformMatrix3fv(renderContext.gl.getUniformLocation(shader, 'normalMatrix'), false, normalMatrix);
        renderContext.gl.uniformMatrix4fv(renderContext.gl.getUniformLocation(shader, 'cameraCombinedMatrix'), false, this.combinedMatrix);
    }

    setVolumeShaderUniforms(shader, worldMatrix) {
        renderContext.gl.uniformMatrix4fv(renderContext.gl.getUniformLocation(shader, 'worldMatrix'), false, worldMatrix);
        renderContext.gl.uniformMatrix4fv(renderContext.gl.getUniformLocation(shader, 'cameraProjectionMatrix'), false, this.projectionMatrix);
        renderContext.gl.uniformMatrix4fv(renderContext.gl.getUniformLocation(shader, 'cameraInverseCombinedMatrix'), false, this.inverseCombinedMatrix);
        renderContext.gl.uniformMatrix4fv(renderContext.gl.getUniformLocation(shader, 'cameraWorldMatrix'), false, this.worldMatrix);
        mat4.multiply(combinedMatrix, this.combinedMatrix, worldMatrix);
        renderContext.gl.uniformMatrix4fv(renderContext.gl.getUniformLocation(shader, 'cameraCombinedMatrix'), false, combinedMatrix);
    }

    getViewRay(viewRayOrigin, viewRayDirection, event) {
        const ndcPos = vec3.create();
        ndcPos[0] = (event.pageX-renderContext.gl.canvas.offsetLeft)/renderContext.gl.canvas.width*renderContext.devicePixelRatio*2.0-1.0;
        ndcPos[1] = 1.0-(event.pageY-renderContext.gl.canvas.offsetTop)/renderContext.gl.canvas.height*renderContext.devicePixelRatio*2.0;
        ndcPos[2] = 0.0;
        const clipPos = vec4.create();
        clipPos[3] = this.projectionMatrix[14]/(ndcPos[2]-this.projectionMatrix[10]/this.projectionMatrix[11]);
        clipPos[0] = ndcPos[0]*clipPos[3];
        clipPos[1] = ndcPos[1]*clipPos[3];
        clipPos[2] = ndcPos[2]*clipPos[3];
        vec3.set(viewRayOrigin, this.worldMatrix[12], this.worldMatrix[13], this.worldMatrix[14]);
        const viewRayHit = vec4.create();
        vec4.transformMat4(viewRayHit, clipPos, this.inverseCombinedMatrix);
        vec3.sub(viewRayDirection, viewRayHit, viewRayOrigin);
        vec3.normalize(viewRayDirection, viewRayDirection);
    }
}

export class RenderContext {
    constructor(canvas) {
        this.gl = canvas.getContext('webgl2');
        if(!this.gl)
            throw new Error(`WebGL 2 is not supported`);
        this.requireExtension('EXT_color_buffer_float');
        this.gl.frontFace(this.gl.CCW);
        this.gl.depthFunc(this.gl.LESS);
        this.setViewport();

        this.frameBuffer = this.gl.createFramebuffer();
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.frameBuffer);
        this.depthBuffer = this.createFramebufferAttachment(this.gl.DEPTH_ATTACHMENT, this.gl.DEPTH_COMPONENT32F);
        this.gBuffers = [
            this.createFramebufferAttachment(this.gl.COLOR_ATTACHMENT0, this.gl.RGB8), // Color
            this.createFramebufferAttachment(this.gl.COLOR_ATTACHMENT1, this.gl.RGBA32F), // Position
            this.createFramebufferAttachment(this.gl.COLOR_ATTACHMENT2, this.gl.RGBA16I), // Normal
            this.createFramebufferAttachment(this.gl.COLOR_ATTACHMENT3, this.gl.RG16UI) // Texcoord
        ];

        this.fullScreenVertexArray = this.gl.createVertexArray();
        this.gl.bindVertexArray(this.fullScreenVertexArray);
        const vertexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([-1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0]), this.gl.STATIC_DRAW);
        this.gl.enableVertexAttribArray(0);
        this.gl.vertexAttribPointer(0, 2, this.gl.FLOAT, false, 0, 0);
        this.gl.bindVertexArray(null);
        this.gl.deleteBuffer(vertexBuffer);
        this.fullScreenSampler = this.gl.createSampler();
        this.gl.samplerParameteri(this.fullScreenSampler, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.samplerParameteri(this.fullScreenSampler, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
        this.gl.samplerParameteri(this.fullScreenSampler, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.samplerParameteri(this.fullScreenSampler, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

        this.clearShader = this.createProgram(ClearShader);
        this.surfaceShader = this.createProgram(SurfaceShader);
        this.combineShader = this.createProgram(CombineShader);
        this.atmosphereDensityShader = this.createProgram(AtmosphereDensityShader);
        this.atmosphereScatteringShader = this.createProgram(AtmosphereScatteringShader);

        this.sunLightDirection = vec3.fromValues(-1.0, 0.0, -1.0);
        this.camera = new Camera();
    }

    requireExtension(name) {
        const extension = this.gl.getExtension(name),
              prefix = name.split('_')[0];
        if(!extension)
            throw new Error(`WebGL extension ${name} is not supported`);
        for(const srcKey in extension) {
            const isFunction = (typeof(extension[srcKey]) == 'function');
            this.gl[isFunction
                ? srcKey.substring(0, srcKey.length-prefix.length)
                : srcKey.substring(prefix.length+1)
            ] = isFunction
                ? (...parameters) => extension[srcKey].apply(extension, parameters)
                : extension[srcKey];
        }
    }

    startRenderLoop() {
        if(this.renderLoop)
            return;
        let lastTime = performance.now();
        this.renderLoop = (currentTime) => {
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.frameBuffer);
            this.gl.depthMask(true);
            this.gl.clear(this.gl.DEPTH_BUFFER_BIT);
            this.gl.useProgram(this.clearShader);
            this.gl.bindVertexArray(this.fullScreenVertexArray);
            this.gl.drawArrays(this.gl.TRIANGLE_FAN, 0, 4);
            // this.gl.drawBuffers([this.gl.COLOR_ATTACHMENT0]);
            // this.gl.clear(this.gl.COLOR_BUFFER_BIT|this.gl.DEPTH_BUFFER_BIT);
            // this.gl.drawBuffers([this.gl.COLOR_ATTACHMENT0, this.gl.COLOR_ATTACHMENT1, this.gl.COLOR_ATTACHMENT2, this.gl.COLOR_ATTACHMENT3]);
            // this.gl.enable(this.gl.CULL_FACE);
            this.gl.enable(this.gl.DEPTH_TEST);
            this.gl.bindSampler(0, null);
            this.gl.useProgram(this.surfaceShader);
            this.gl.drawBuffers([this.gl.COLOR_ATTACHMENT0, this.gl.COLOR_ATTACHMENT1, this.gl.COLOR_ATTACHMENT2, this.gl.COLOR_ATTACHMENT3]);
            if(this.renderSurface)
                this.renderSurface((currentTime-lastTime)*0.001);
            this.gl.disable(this.gl.CULL_FACE);
            this.gl.disable(this.gl.DEPTH_TEST);
            this.gl.depthMask(false);
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
            this.gl.useProgram(this.combineShader);
            this.gl.uniform3fv(this.gl.getUniformLocation(this.combineShader, 'sunLightDirection'), this.sunLightDirection);
            for(let i = 0; i < 4; ++i) {
                this.gl.bindSampler(i, this.fullScreenSampler);
                this.bindTexture(i, this.gBuffers[i]);
            }
            this.gl.bindVertexArray(this.fullScreenVertexArray);
            this.gl.drawArrays(this.gl.TRIANGLE_FAN, 0, 4);
            if(this.renderVolume)
                this.renderVolume();
            lastTime = currentTime;
            if(this.renderLoop)
                window.requestAnimationFrame(this.renderLoop);
        };
        this.renderLoop(lastTime);
    }

    stopRenderLoop() {
        delete this.renderLoop;
    }

    createShader(type, source) {
        const shader = this.gl.createShader(type);
        if(type == this.gl.FRAGMENT_SHADER)
            source = 'precision mediump float;\n'+source;
        this.gl.shaderSource(shader, '#version 300 es\n'+source);
        this.gl.compileShader(shader);
        if(this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS))
            return shader;
        console.log(this.gl.getShaderInfoLog(shader));
        this.gl.deleteShader(shader);
    }

    createProgram(source) {
        let fragmentShader = source.fragmentShader;
        const bindings = [];
        while(true) {
            const begin = fragmentShader.indexOf('layout(binding=');
            if(begin == -1)
                break;
            const middle = fragmentShader.indexOf(')', begin);
            if(middle == -1)
                break;
            const end = fragmentShader.indexOf(';', middle);
            if(end == -1)
                break;
            const binding = {
                'location': parseInt(fragmentShader.substring(begin+15, middle)),
                'name': fragmentShader.substring(middle+1, end).split(' ')
            };
            binding.name = binding.name[binding.name.length-1];
            bindings.push(binding);
            fragmentShader = fragmentShader.substring(0, begin)+fragmentShader.substring(middle+1);
        }
        const program = this.gl.createProgram();
        this.gl.attachShader(program, this.createShader(this.gl.VERTEX_SHADER, source.vertexShader));
        this.gl.attachShader(program, this.createShader(this.gl.FRAGMENT_SHADER, fragmentShader));
        this.gl.linkProgram(program);
        if(!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.log(this.gl.getProgramInfoLog(program));
            this.gl.deleteProgram(program);
            return;
        }
        this.gl.useProgram(program);
        for(const binding of bindings)
            this.gl.uniform1i(this.gl.getUniformLocation(program, binding.name), binding.location);
        return program;
    }

    createVertexArray(vertices, elements) {
        const vertexArray = this.gl.createVertexArray(),
              vertexBuffer = this.gl.createBuffer(),
              elementBuffer = (elements) ? this.gl.createBuffer() : null;
        this.gl.bindVertexArray(vertexArray);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);
        if(elements) {
            this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, elementBuffer);
            this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, elements, this.gl.STATIC_DRAW);
        }
        this.gl.enableVertexAttribArray(0);
        this.gl.vertexAttribPointer(0, 3, this.gl.FLOAT, false, 8*4, 0*4);
        this.gl.enableVertexAttribArray(1);
        this.gl.vertexAttribPointer(1, 3, this.gl.FLOAT, false, 8*4, 3*4);
        this.gl.enableVertexAttribArray(2);
        this.gl.vertexAttribPointer(2, 2, this.gl.FLOAT, false, 8*4, 6*4);
        this.gl.bindVertexArray(null);
        this.gl.deleteBuffer(vertexBuffer);
        if(elements)
            this.gl.deleteBuffer(elementBuffer);
        return vertexArray;
    }

    createTexture(minFilter=this.gl.LINEAR_MIPMAP_LINEAR, maxFilter=this.gl.LINEAR) {
        const texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, minFilter);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, maxFilter);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        const ext = this.gl.getExtension('EXT_texture_filter_anisotropic');
        if(ext && minFilter != this.gl.NEAREST)
            this.gl.texParameterf(this.gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, this.gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT));
        return texture;
    }

    createFramebufferAttachment(attachment, internalformat, texture=this.gl.createTexture()) {
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.texStorage2D(this.gl.TEXTURE_2D, 1, internalformat, this.gl.canvas.width, this.gl.canvas.height);
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, attachment, this.gl.TEXTURE_2D, texture, 0);
        return texture;
    }

    bindTexture(slotIndex, texture) {
        this.gl.activeTexture(this.gl.TEXTURE0+slotIndex);
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    }

    imageToTexture(destination, source, callback) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
                this.gl.bindTexture(this.gl.TEXTURE_2D, destination);
                this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);
                this.gl.generateMipmap(this.gl.TEXTURE_2D);
                resolve(image);
            };
            image.onerror = reject;
            image.src = (source instanceof SVGElement) ? 'data:image/svg+xml;base64,'+window.btoa(new XMLSerializer().serializeToString(source)) : source;
        });
    }

    setViewport() {
        this.devicePixelRatio = window.devicePixelRatio || 1;
        this.gl.canvas.width = Math.round(this.gl.canvas.offsetWidth*this.devicePixelRatio);
        this.gl.canvas.height = Math.round(this.gl.canvas.offsetHeight*this.devicePixelRatio);
        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    }

    getTexcoordAt(x, y) {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.frameBuffer);
        this.gl.readBuffer(this.gl.COLOR_ATTACHMENT3);
        this.gl.readPixels(x, y, 1, 1, this.gl.RGBA_INTEGER, this.gl.UNSIGNED_INT, pixel);
        return [pixel[0]/65535.0, pixel[1]/65535.0];
    }
}
export const renderContext = new RenderContext(document.getElementById('canvas'));
