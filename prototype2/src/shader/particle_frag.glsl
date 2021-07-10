#version 460
#extension GL_GOOGLE_include_directive : require

#include "include/ray_tracing_frag.glsl"

layout(location=0) in flat vec3 world_position;
layout(location=1) in flat float world_radius;
layout(location=2) in flat vec4 color;
layout(location=3) in vec4 vClipPos;
layout(location=0) out vec4 gBufferPosition;
layout(location=1) out ivec4 gBufferNormal;
layout(location=2) out vec4 gBufferAlbedo;
layout(location=3) out vec4 gBufferMaterial;

#include "include/camera_uniforms.glsl"

void main() {
    compute_view_ray()

    vec3 intersections[2];
    if(line_sphere_intersection(view_ray_origin, view_ray_direction, world_position, world_radius, intersections) == 0.0)
        discard;

    gBufferNormal = ivec4(normalize(intersections[0]-world_position)*32767.0, 0.0);
    gBufferPosition = vec4(intersections[0], 0.0);
    clip_frag_depth(gBufferPosition.xyz)

    gBufferAlbedo = color;
    gBufferMaterial = vec4(0.0);
}
