#version 460
#extension GL_GOOGLE_include_directive : require

#include "include/ray_tracing_frag.glsl"
#include "include/simplex_noise.glsl"

layout(location=0) in flat mat4 inverse_world_matrix;
layout(location=4) in flat vec3 world_position;
layout(location=5) in flat float world_radius;
layout(location=6) in vec4 vClipPos;
layout(location=0) out vec4 gBufferPosition;
layout(location=1) out ivec4 gBufferNormal;
layout(location=2) out vec4 gBufferAlbedo;
layout(location=3) out vec4 gBufferMaterial;

#include "include/camera_uniforms.glsl"

void main() {
    compute_view_ray()

    float animation_time = 0.0;

    vec3 intersections[2];
    float star_radius = world_radius;
    if(line_sphere_intersection(view_ray_origin, view_ray_direction, world_position, star_radius, intersections) == 0.0)
        discard;

    // Normal, Position and Depth
    vec3 normal = normalize(intersections[0]-world_position);
    gBufferNormal = ivec4(normal*32767.0, 0.0);
    gBufferPosition = vec4(intersections[0], 0.0);
    clip_frag_depth(gBufferPosition.xyz)

    gBufferAlbedo.rgb = mix(vec3(0.4, 0.1, 0.0), vec3(1.0, 0.8, 0.4), simplex_noise(vec4(normal*3.0, animation_time))*0.5+simplex_noise(vec4(normal*20.0, animation_time)));
    gBufferMaterial = vec4(0.0, 0.0, 1.0, 0.0);
}
