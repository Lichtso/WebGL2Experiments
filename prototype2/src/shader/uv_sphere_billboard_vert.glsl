#version 460
#extension GL_GOOGLE_include_directive : require

layout(location=0) out mat4 out_inverse_world_matrix;
layout(location=4) out vec3 out_world_position;
layout(location=5) out float out_world_radius;
layout(location=6) out vec4 vClipPos;

#include "include/billboard_vert.glsl"

void main() {
    out_inverse_world_matrix = inverse_world_matrix;
    out_world_position = world_matrix[3].xyz;
    out_world_radius = length(world_matrix[2].xyz);
    billboard_sphere(out_world_position, out_world_radius);
}
