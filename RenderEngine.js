import {mat4} from './gl-matrix.js';
import * as FirstPassShader from './FirstPassShader.js';
import * as LastPassShader from './LastPassShader.js';

export class RenderContext {
    constructor(canvas) {
        this.gl = canvas.getContext('webgl2');
        if(!this.gl) {
            console.log('WebGL 2 not supported');
            return;
        }
        if(!this.gl.getExtension('EXT_color_buffer_float')) {
            console.log('EXT_color_buffer_float not supported');
            return;
        }
        this.gl.clearColor(0, 0, 0, 1);
        this.gl.frontFace(this.gl.CCW);
        this.gl.depthFunc(this.gl.LESS);
        // this.gl.enable(gl.BLEND);
        // this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE);
        this.setViewport();

        const depthBuffer = this.createTexture(this.gl.NEAREST, this.gl.NEAREST),
              diffuseBuffer = this.createTexture(this.gl.NEAREST, this.gl.NEAREST),
              positionBuffer = this.createTexture(this.gl.NEAREST, this.gl.NEAREST),
              normalBuffer = this.createTexture(this.gl.NEAREST, this.gl.NEAREST),
              frameBuffer = this.gl.createFramebuffer();
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, frameBuffer);
        this.gl.bindTexture(this.gl.TEXTURE_2D, depthBuffer);
        this.gl.texStorage2D(this.gl.TEXTURE_2D, 1, this.gl.DEPTH_COMPONENT32F, this.gl.canvas.width, this.gl.canvas.height);
        this.gl.bindTexture(this.gl.TEXTURE_2D, positionBuffer);
        this.gl.texStorage2D(this.gl.TEXTURE_2D, 1, this.gl.RGBA32F, this.gl.canvas.width, this.gl.canvas.height);
        this.gl.bindTexture(this.gl.TEXTURE_2D, normalBuffer);
        this.gl.texStorage2D(this.gl.TEXTURE_2D, 1, this.gl.RGBA16F, this.gl.canvas.width, this.gl.canvas.height);
        this.gl.bindTexture(this.gl.TEXTURE_2D, diffuseBuffer);
        this.gl.texStorage2D(this.gl.TEXTURE_2D, 1, this.gl.RGB8, this.gl.canvas.width, this.gl.canvas.height);
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.DEPTH_ATTACHMENT, this.gl.TEXTURE_2D, depthBuffer, 0);
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, positionBuffer, 0);
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT1, this.gl.TEXTURE_2D, normalBuffer, 0);
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT2, this.gl.TEXTURE_2D, diffuseBuffer, 0);
        this.gl.drawBuffers([this.gl.COLOR_ATTACHMENT0, this.gl.COLOR_ATTACHMENT1, this.gl.COLOR_ATTACHMENT2]);

        this.fullScreenVertexArray = this.gl.createVertexArray();
        this.gl.bindVertexArray(this.fullScreenVertexArray);
        const vertexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([-1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0]), this.gl.STATIC_DRAW);
        this.gl.enableVertexAttribArray(0);
        this.gl.vertexAttribPointer(0, 2, this.gl.FLOAT, false, 0, 0);
        this.gl.bindVertexArray(null);
        this.gl.deleteBuffer(vertexBuffer);

        this.firstPass = this.createProgram(FirstPassShader);
        this.lastPass = this.createProgram(LastPassShader);

        let lastTime = performance.now();
        const step = (currentTime) => {
            this.gl.enable(this.gl.CULL_FACE);
            this.gl.enable(this.gl.DEPTH_TEST);
            this.gl.useProgram(this.firstPass);
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, frameBuffer);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT|this.gl.DEPTH_BUFFER_BIT);
            if(this.render)
                this.render((currentTime-lastTime)*0.001);
            this.gl.disable(this.gl.CULL_FACE);
            this.gl.disable(this.gl.DEPTH_TEST);
            this.gl.useProgram(this.lastPass);
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
            this.bindTexture(0, positionBuffer);
            this.bindTexture(1, normalBuffer);
            this.bindTexture(2, diffuseBuffer);
            this.gl.bindVertexArray(this.fullScreenVertexArray);
            this.gl.drawArrays(this.gl.TRIANGLE_FAN, 0, 4);
            lastTime = currentTime;
            window.requestAnimationFrame(step);
        };
        step(lastTime);
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

    createDepthMap() {
        const depthBuffer = this.createTexture(this.gl.NEAREST, this.gl.NEAREST);
        this.gl.bindTexture(this.gl.TEXTURE_2D, depthBuffer);
        this.gl.texStorage2D(this.gl.TEXTURE_2D, 1, this.gl.DEPTH_COMPONENT32F, this.gl.canvas.width, this.gl.canvas.height);
        // gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.DEPTH_COMPONENT32F, this.gl.canvas.width, this.gl.canvas.height, 0, this.gl.DEPTH_COMPONENT, this.gl.FLOAT, null);
        const frameBuffer = this.gl.createFramebuffer();
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, frameBuffer);
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.DEPTH_ATTACHMENT, this.gl.TEXTURE_2D, depthBuffer, 0);
    }

    bindTexture(slotIndex, texture) {
        this.gl.activeTexture(this.gl.TEXTURE0+slotIndex);
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    }

    renderImageToTexture(destination, source) {
        const image = new Image();
        image.onload = () => {
            this.gl.bindTexture(this.gl.TEXTURE_2D, destination);
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);
            this.gl.generateMipmap(this.gl.TEXTURE_2D);
        };
        image.src = (source instanceof SVGElement) ? 'data:image/svg+xml;base64,'+window.btoa(new XMLSerializer().serializeToString(source)) : source;
    }

    setViewport() {
        const devicePixelRatio = window.devicePixelRatio || 1;
        this.gl.canvas.width = Math.round(this.gl.canvas.offsetWidth*devicePixelRatio);
        this.gl.canvas.height = Math.round(this.gl.canvas.offsetHeight*devicePixelRatio);
        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    }
}

export class Camera {
    constructor() {
        this.near = 1.0;
        this.far = 1000.0;
        this.worldMatrix = mat4.create();
        this.projectionMatrix = mat4.create();
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
    }
}
