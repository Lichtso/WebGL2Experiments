#version 460
#extension GL_GOOGLE_include_directive : require

layout(location=0) out vec3 out_world_position;
layout(location=1) out float out_world_radius;
layout(location=2) out vec4 out_color;
layout(location=3) out vec4 vClipPos;

#include "include/billboard_vert.glsl"

struct ParticleAttributes {
    vec4 position_and_radius;
    vec4 color;
};

layout(set=2, binding=0) readonly buffer ParticleAttributesBuffer {
    ParticleAttributes particle_attributes[];
};

void main() {
    uint particle_index = gl_VertexIndex>>2;
    out_world_position = (world_matrix*vec4(particle_attributes[particle_index].position_and_radius.xyz, 1.0)).xyz;
    out_world_radius = particle_attributes[particle_index].position_and_radius.w;
    out_color = particle_attributes[particle_index].color;
    billboard_sphere(out_world_position, out_world_radius);
}
