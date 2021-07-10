export const vertexShader = `
layout(location=0) in vec2 vPosition;
out vec2 fTexcoord;

void main() {
    gl_Position = vec4(vPosition, 0.0, 1.0);
    fTexcoord = (vPosition+vec2(1.0))*0.5;
}`;

export const fragmentShader = `
layout(binding=0) uniform sampler2D colorMap;
layout(binding=1) uniform sampler2D positionMap;
layout(binding=2) uniform mediump isampler2D normalMap;
// layout(binding=3) uniform mediump usampler2D texcoordMap;
in vec2 fTexcoord;
layout(location=0) out vec4 color;

uniform vec3 sunLightDirection;

vec3 discretize(vec3 color, vec3 steps) {
    return round(color*steps)/steps;
}

// https://stackoverflow.com/questions/15095909/from-rgb-to-hsv-in-opengl-glsl
vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z+(q.w-q.y)/(6.0*d+e)), d/(q.x+e), q.x);
}
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx+K.xyz)*6.0-K.www);
    return c.z * mix(K.xxx, clamp(p-K.xxx, 0.0, 1.0), c.y);
}

void main() {
    color = texture(colorMap, fTexcoord);
    vec3 normal = vec3(texture(normalMap, fTexcoord).xyz)/32767.0;
    // color.rgb *= clamp(dot(normal, -sunLightDirection), 0.2, 1.0);
    // vec2 texcoord = vec2(texture(texcoordMap, fTexcoord).xy)/65535.0;
    // color.rgb *= clamp(pow(128.0, dot(normal, -sunLightDirection))-1.0, 0.5, 1.0);
    // color.rgb = hsv2rgb(discretize(rgb2hsv(color.rgb), vec3(5.0, 5.0, 5.0)));
}`;
