#version 460
#extension GL_GOOGLE_include_directive : require

layout(location=0) in mat4 world_matrix;
layout(location=4) in mat4 inverse_world_matrix;
layout(location=8) in mat4 mvp_matrix;
layout(location=12) in vec3 light_setting_color;
layout(location=13) in float light_setting_radius;
layout(location=14) in float light_setting_outer_angle_cos;
layout(location=15) in float light_setting_inner_angle_cos;
layout(location=16) in vec3 aPosition;

layout(location=0) out vec3 out_world_direction;
layout(location=1) out vec3 out_world_position;
layout(location=2) out float out_world_radius;
struct SpotLightSettings {
    vec3 color;
    float outer_angle_cos;
    float inner_angle_cos;
};
layout(location=3) out SpotLightSettings out_light_setting;

#include "include/camera_uniforms.glsl"

void main() {
    gl_Position = mvp_matrix*vec4(aPosition, 1.0);
    out_world_direction = normalize(world_matrix[2].xyz);
    out_world_position = world_matrix[3].xyz;
    out_world_radius = light_setting_radius;
    out_light_setting.color = light_setting_color;
    out_light_setting.outer_angle_cos = light_setting_outer_angle_cos;
    out_light_setting.inner_angle_cos = light_setting_inner_angle_cos;
}
