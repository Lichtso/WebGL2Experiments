#version 460
#extension GL_GOOGLE_include_directive : require

layout(location=0) in mat4 world_matrix;
layout(location=4) in mat4 inverse_world_matrix;
layout(location=8) in mat4 mvp_matrix;
layout(location=12) in vec3 light_setting_color;
layout(location=13) in vec3 aPosition;

layout(location=0) out mat4 out_inverse_world_matrix;
layout(location=4) out vec3 out_world_direction;
struct ParallelLightSettings {
    vec3 color;
};
layout(location=5) out ParallelLightSettings out_light_setting;

#include "include/camera_uniforms.glsl"

void main() {
    gl_Position = mvp_matrix*vec4(aPosition, 1.0);
    out_inverse_world_matrix = inverse_world_matrix;
    out_world_direction = normalize(world_matrix[2].xyz);
    out_light_setting.color = light_setting_color;
}
