#version 460
#extension GL_GOOGLE_include_directive : require

layout(location=0) in flat vec3 world_direction;
layout(location=1) in flat vec3 world_position;
layout(location=2) in flat float world_radius;
struct SpotLightSettings {
    vec3 color;
    float outer_angle_cos;
    float inner_angle_cos;
};
layout(location=3) in flat SpotLightSettings light_setting;

#include "include/light_shared.glsl"

void main() {
    light_gbuffer(SpotLightSettings)

    light_attenuation_and_direction()
    diffuse_specular_color()

    gBufferColor.rgb *= smoothstep(light_setting.outer_angle_cos, light_setting.inner_angle_cos, dot(light_direction, world_direction));
}
