#version 460

layout(location=0) in mat4 world_matrix;
layout(location=4) in mat4 inverse_world_matrix;
layout(location=8) in mat4 mvp_matrix;

layout(location=12) in vec3 aPosition;
layout(location=13) in vec3 aNormal;
layout(location=14) in vec2 aTexCoord;

layout(location=0) out vec3 vPosition;
layout(location=1) out vec3 vNormal;
layout(location=2) out vec2 vTexCoord;

void main() {
    vPosition = (world_matrix*vec4(aPosition, 1.0)).xyz;
    vNormal = (world_matrix*vec4(aNormal, 0.0)).xyz;
    vTexCoord = aTexCoord;
    gl_Position = mvp_matrix*vec4(aPosition, 1.0);
}
