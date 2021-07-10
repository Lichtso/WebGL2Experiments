#version 460
#extension GL_GOOGLE_include_directive : require

layout(location=0) out vec3 out_world_position;
layout(location=1) out float out_world_radius;
layout(location=2) out vec4 vClipPos;

#include "include/billboard_vert.glsl"

void main() {
    out_world_position = world_matrix[3].xyz;
    out_world_radius = length(world_matrix[2].xyz);
    billboard_sphere(out_world_position, out_world_radius);
}
