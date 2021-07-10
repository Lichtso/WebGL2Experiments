#version 460
#extension GL_GOOGLE_include_directive : require

layout(location=0) in flat mat4 inverse_world_matrix;
layout(location=4) in flat vec3 world_direction;
struct ParallelLightSettings {
    vec3 color;
};
layout(location=5) in flat ParallelLightSettings light_setting;

#include "include/light_shared.glsl"

void main() {
    light_gbuffer(ParallelLightSettings)

    vec3 relative_position = (inverse_world_matrix*vec4(position, 1.0)).xyz;
    if(relative_position.x < -1.0 || relative_position.x > 1.0 ||
       relative_position.y < -1.0 || relative_position.y > 1.0 ||
       relative_position.z < -1.0 || relative_position.z > 0.0)
        discard;

    float attenuation = 1.0;
    vec3 light_direction = world_direction;
    diffuse_specular_color()
}
