export const vertexShader = `
layout(location=0) in vec2 vPosition;

void main() {
    gl_Position = vec4(vPosition, 0.0, 1.0);
}`;

export const fragmentShader = `
layout(location=0) out vec4 color;
layout(location=1) out vec3 position;
layout(location=2) out ivec3 normal;
layout(location=3) out uvec2 texcoord;

void main() {
    color = vec4(0.0);
    position = vec3(0.0);
    normal = ivec3(0.0);
    texcoord = uvec2(0.0);
}`;
