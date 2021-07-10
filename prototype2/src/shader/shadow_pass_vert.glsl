#version 460

layout(location=0) in mat4 world_matrix;
layout(location=4) in mat4 inverse_world_matrix;
layout(location=8) in mat4 mvp_matrix;

layout(location=12) in vec3 aPosition;

void main() {
    gl_Position = mvp_matrix*vec4(aPosition, 1.0);
}
