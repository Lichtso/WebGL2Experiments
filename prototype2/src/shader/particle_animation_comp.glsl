#version 460
#extension GL_GOOGLE_include_directive : require

#include "include/voronoi_noise.glsl"

layout(local_size_x=32, local_size_y=1, local_size_z=1) in;

struct Particle {
    vec3 color;
    vec3 position;
    float radius;
};

layout(set=0, binding=0) buffer ParticlesOut {
    Particle particles[];
};

vec3 spawner_position_at_time(float t) {
    return vec3(0.0);
}

void main() {
    float animation_time = 0.0;
    float randomness = 1.0;

    vec3 cell_distance, cell_position;
    signed_voronoi_noise(animation_time, randomness, cell_distance, cell_position);
    float time_since_birth = cell_distance.x;
    float time_until_death = cell_distance.z;
    float life_time = time_since_birth+time_until_death;
    // particles[gl_GlobalInvocationID.x].position = ;
}
