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

void main() {
    color = texture(colorMap, fTexcoord);
    vec3 normal = vec3(texture(normalMap, fTexcoord).xyz)/32767.0;
    color.rgb *= clamp(dot(normal, -sunLightDirection), 0.2, 1.0);
}`;
