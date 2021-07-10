#version 460
#extension GL_GOOGLE_include_directive : require

#include "include/ray_tracing_frag.glsl"

layout(location=0) in flat vec3 world_position;
layout(location=1) in flat float world_radius;
layout(location=2) in vec4 vClipPos;

#include "include/camera_uniforms.glsl"

void main() {
    compute_view_ray()

    vec3 intersections[2];
    if(line_sphere_intersection(view_ray_origin, view_ray_direction, world_position, world_radius, intersections) == 0.0)
        discard;

    clip_frag_depth(intersections[1])
}
