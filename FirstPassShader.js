export const vertexShader = `
uniform mat4 worldMatrix;
uniform mat3 normalMatrix;
uniform mat4 projectionMatrix;
layout(location=0) in vec4 vPosition;
layout(location=1) in vec3 vNormal;
layout(location=2) in vec2 vTexcoord;
out vec3 fPosition;
out vec3 fNormal;
out vec2 fTexcoord;

void main() {
    gl_Position = projectionMatrix*(worldMatrix*vPosition);
    fPosition = (worldMatrix*vPosition).xyz;
    fNormal = normalMatrix*vNormal;
    fTexcoord = vTexcoord;
}`;

export const fragmentShader = `
layout(binding=0) uniform sampler2D diffuseMap;
in vec3 fPosition;
in vec3 fNormal;
in vec2 fTexcoord;
layout(location=0) out vec4 position;
layout(location=1) out vec3 normal;
layout(location=2) out vec4 diffuse;

void main() {
    diffuse = texture(diffuseMap, fTexcoord);
    normal = fNormal;
}`;
