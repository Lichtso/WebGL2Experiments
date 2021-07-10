#version 460
#extension GL_GOOGLE_include_directive : require

#include "include/ray_tracing_frag.glsl"
#include "include/simplex_noise.glsl"

layout(location=0) in flat vec3 world_position;
layout(location=1) in flat float world_radius;
layout(location=2) in vec4 vClipPos;
layout(location=0) out vec4 gBufferColor;

#include "include/camera_uniforms.glsl"

void main() {
    compute_view_ray()

    float animation_time = 0.0;

    float atmosphere_radius = world_radius;
    float star_radius = atmosphere_radius/1.75;
    vec3 intersections[2];
    if(line_sphere_intersection(view_ray_origin, view_ray_direction, world_position, atmosphere_radius, intersections) == 0.0)
        discard;

    view_ray_hit = (intersections[0]+intersections[1])*0.5;
    float altitude = length(view_ray_hit-world_position);
    if(altitude < star_radius)
        discard;

    view_ray_hit = view_ray_origin+view_ray_direction*line_plane_intersection(view_ray_origin, view_ray_direction, world_position, camera.world_matrix[3].xyz);
    vec3 normal = normalize(view_ray_hit-world_position);
    float normalized_altitude = (altitude-star_radius)/(atmosphere_radius-star_radius);
    gBufferColor.rgb = vec3(1.0, 0.1, 0.0)*pow(max(0.0, simplex_noise(vec4(normal*10.0, animation_time))*0.5+0.5-normalized_altitude), 2.0);
    gBufferColor.rgb += vec3(0.4, 0.1, 0.0)*pow(1.0-normalized_altitude, 10.0);
}
