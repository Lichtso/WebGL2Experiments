#version 460
#extension GL_EXT_samplerless_texture_functions : require
#extension GL_GOOGLE_include_directive : require

#include "include/ray_tracing_frag.glsl"

layout(location=0) in flat vec3 world_position;
layout(location=1) in flat float world_radius;
layout(location=2) in vec4 vClipPos;
layout(location=0) out vec4 gBufferColor;

layout(set=0, binding=0) uniform texture2D gBufferPosition;

#include "include/camera_uniforms.glsl"

layout(set=2, binding=0) uniform sampler density_sampler;
layout(set=2, binding=1) uniform texture2D density_texture;
layout(push_constant) uniform MetaData {
    vec3 sun_light_direction;
};

const vec3 sun_brightness = vec3(0.6); // TODO
const vec3 wave_lengths = vec3(572.0, 500.0, 430.0); // g=539.5
const vec3 scatter_coefficents = pow(vec3(400.0)/wave_lengths, vec3(4.0))*1.0;

vec2 lookupRay(vec3 position, vec3 direction, float atmosphere_radius, float planet_radius) {
    vec3 relative_position = position-world_position;
	float angle = 0.5-0.5*dot(normalize(relative_position), direction);
    float altitude = length(relative_position)-planet_radius;
    float normalized_altitude = max(0.0, altitude/(atmosphere_radius-planet_radius));
    return texture(sampler2D(density_texture, density_sampler), vec2(angle, normalized_altitude)).xy;
}

void main() {
    compute_view_ray()

    float atmosphere_radius = world_radius;
    float planet_radius = atmosphere_radius/1.2;
    vec3 atmosphere_intersections[2];
    if(line_sphere_intersection(view_ray_origin, view_ray_direction, world_position, atmosphere_radius, atmosphere_intersections) == 0.0)
        discard;
    vec3 position = texelFetch(gBufferPosition, ivec2(gl_FragCoord.xy), 0).xyz;
    if(position != vec3(0.0))
        view_ray_hit = position;

    if(dot(view_ray_hit-view_ray_origin, view_ray_direction) > dot(atmosphere_intersections[1]-view_ray_origin, view_ray_direction))
        view_ray_hit = atmosphere_intersections[1];

    frag_depth(atmosphere_intersections[0])
    if(gl_FragDepth < 0.0) {
        gl_FragDepth = 0.0;
        vec3 point_on_near_plane = view_ray_origin-camera.world_matrix[2].xyz*(camera.projection_matrix[3][2]/camera.projection_matrix[2][2]);
        atmosphere_intersections[0] = view_ray_origin+view_ray_direction*line_plane_intersection(view_ray_origin, view_ray_direction, point_on_near_plane, camera.world_matrix[2].xyz);
    }

    const int iterations = 5;
    float step_size = distance(atmosphere_intersections[0], view_ray_hit)/float(iterations);
    for(int i = 0; i < iterations; ++i) {
    	float t = float(i)/float(iterations-1);
        vec3 position = mix(atmosphere_intersections[0], view_ray_hit, t);
        vec2 view_ray = lookupRay(position, view_ray_direction, atmosphere_radius, planet_radius);
        vec2 sun_ray = lookupRay(position, sun_light_direction, atmosphere_radius, planet_radius);
        gBufferColor.rgb += exp(-(view_ray.r+sun_ray.r)*scatter_coefficents)*scatter_coefficents*view_ray.g*step_size*sun_brightness;
    }
    gBufferColor.a *= 0.1;
}
