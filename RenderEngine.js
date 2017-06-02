const linearAlgebra = require('./gl-matrix/src/gl-matrix.js');

exports.RenderContext = function(canvas) {
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
    this.gl.enable(this.gl.CULL_FACE);
    this.gl.enable(this.gl.DEPTH_TEST);
    this.setViewport();

    this.program = this.createProgram(require('./StandardShader.js'));
    this.gl.useProgram(this.program);

    var lastTime = 0;
    const step = function(currentTime) {
        var deltaTime = (currentTime-lastTime)*0.001;
        lastTime = currentTime;
        this.gl.clear(this.gl.COLOR_BUFFER_BIT|this.gl.DEPTH_BUFFER_BIT);
        this.render(deltaTime);
        window.requestAnimationFrame(step);
    }.bind(this);
    window.requestAnimationFrame(step);
};

prototype = exports.RenderContext.prototype;

prototype.createShader = function(type, source) {
    const shader = this.gl.createShader(type);
    if(type == this.gl.FRAGMENT_SHADER)
        source = 'precision mediump float;\n'+source;
    this.gl.shaderSource(shader, '#version 300 es\n'+source);
    this.gl.compileShader(shader);
    if(this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS))
        return shader;
    console.log(this.gl.getShaderInfoLog(shader));
    this.gl.deleteShader(shader);
};

prototype.createProgram = function(source) {
    const bindings = [];
    while(true) {
        const begin = source.fragmentShader.indexOf('layout(binding=');
        if(begin == -1)
            break;
        const middle = source.fragmentShader.indexOf(')', begin);
        if(middle == -1)
            break;
        const end = source.fragmentShader.indexOf(';', middle);
        if(end == -1)
            break;
        const binding = {
            'location': parseInt(source.fragmentShader.substring(begin+15, middle)),
            'name': source.fragmentShader.substring(middle+1, end).split(' ')
        };
        binding.name = binding.name[binding.name.length-1];
        bindings.push(binding);
        source.fragmentShader = source.fragmentShader.substring(0, begin)+source.fragmentShader.substring(middle+1);
    }
    const program = this.gl.createProgram();
    this.gl.attachShader(program, this.createShader(this.gl.VERTEX_SHADER, source.vertexShader));
    this.gl.attachShader(program, this.createShader(this.gl.FRAGMENT_SHADER, source.fragmentShader));
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
};

prototype.createVertexArray = function(vertices, elements) {
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
};

prototype.createTexture = function(minFilter, maxFilter) {
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
};

prototype.bindTexture = function(slotIndex, texture) {
    this.gl.activeTexture(this.gl.TEXTURE0+slotIndex);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
};

prototype.renderImageToTexture = function(source, texture) {
    const image = new Image();
    image.onload = function() {
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);
        this.gl.generateMipmap(this.gl.TEXTURE_2D);
    }.bind(this);
    image.src = (svg instanceof SVGElement) ? 'data:image/svg+xml;base64,'+window.btoa(new XMLSerializer().serializeToString(source)) : source;
};

prototype.setViewport = function() {
    const devicePixelRatio = window.devicePixelRatio || 1;
    this.gl.canvas.width = Math.round(this.gl.canvas.offsetWidth*devicePixelRatio);
    this.gl.canvas.height = Math.round(this.gl.canvas.offsetHeight*devicePixelRatio);
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
};



exports.Camera = function() {
    this.near = 1;
    this.far = 100;
    this.worldMatrix = linearAlgebra.mat4.create();
    this.viewMatrix = linearAlgebra.mat4.create();
    this.projectionMatrix = linearAlgebra.mat4.create();
    this.combinedMatrix = linearAlgebra.mat4.create();
    linearAlgebra.mat4.translate(this.worldMatrix, this.worldMatrix, [0, 0, 25]);
};

prototype = exports.Camera.prototype;

prototype.setPerspective = function(fov, aspect) {
    linearAlgebra.mat4.perspective(this.projectionMatrix, fov, aspect, this.near, this.far);
};

prototype.setOrtho = function(width, height) {
    linearAlgebra.mat4.ortho(this.projectionMatrix, -width, width, -height, height, this.near, this.far);
};

prototype.update = function() {
    linearAlgebra.mat4.invert(this.viewMatrix, this.worldMatrix);
    linearAlgebra.mat4.multiply(this.combinedMatrix, this.projectionMatrix, this.viewMatrix);
};
