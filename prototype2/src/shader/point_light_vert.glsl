#version 460
#extension GL_GOOGLE_include_directive : require

layout(location=12) in vec3 light_setting_color;
layout(location=0) out vec3 out_world_position;
layout(location=1) out float out_world_radius;
layout(location=2) out vec4 vClipPos;
struct PointLightSettings {
    vec3 color;
};
layout(location=8) out PointLightSettings out_light_setting;

#include "include/billboard_vert.glsl"

void main() {
    out_world_position = world_matrix[3].xyz;
    out_world_radius = length(world_matrix[2].xyz);
    out_light_setting.color = light_setting_color;
    billboard_sphere(out_world_position, out_world_radius);
}
