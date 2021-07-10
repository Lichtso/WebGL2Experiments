#version 460
#extension GL_GOOGLE_include_directive : require

#include "include/light_shared.glsl"
#include "include/ray_tracing_frag.glsl"

layout(location=0) in flat vec3 world_position;
layout(location=1) in flat float world_radius;
layout(location=2) in vec4 vClipPos;
struct PointLightSettings {
    vec3 color;
};
layout(location=8) in flat PointLightSettings light_setting;

void main() {
    compute_view_ray()

    vec3 intersections[2];
    if(line_sphere_intersection(view_ray_origin, view_ray_direction, world_position, world_radius, intersections) == 0.0)
        discard;

    light_gbuffer(PointLightSettings)

    light_attenuation_and_direction()
    diffuse_specular_color()
}
