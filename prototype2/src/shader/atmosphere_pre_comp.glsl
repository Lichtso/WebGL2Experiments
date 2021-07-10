#version 460
#extension GL_GOOGLE_include_directive : require

layout(local_size_x=32, local_size_y=32, local_size_z=1) in;

layout(push_constant) readonly uniform MetaData {
    float atmosphere_radius;
    float planet_radius;
    float atmosphere_density_falloff;
};
layout(set=0, binding=0) uniform writeonly image2D dst_texture;

float densityAtAltitude(float altitude) {
    float normalized_altitude = altitude/(atmosphere_radius-planet_radius);
	return exp(-normalized_altitude*atmosphere_density_falloff)*(1.0-normalized_altitude);
}

#include "include/ray_tracing_frag.glsl"

void main() {
    vec2 fTexCoord = vec2(gl_GlobalInvocationID.xy)/vec2(imageSize(dst_texture));
    float angle = asin(fTexCoord.x*2.0-1.0);
    float centerDist = mix(planet_radius, atmosphere_radius, fTexCoord.y);
    vec3 view_ray_origin = vec3(0.0, centerDist, 0.0);
    vec3 view_ray_direction = normalize(vec3(cos(angle), sin(angle), 0.0));

    vec3 atmosphereIntersections[2];
    float atmosphereDist = line_sphere_intersection(view_ray_origin, view_ray_direction, vec3(0.0), atmosphere_radius, atmosphereIntersections);

    const int iterations = 10;
    float accumulatedDensity = 0.0;
    float stepLength = distance(view_ray_origin, atmosphereIntersections[1])/float(iterations);
    for(int i = 0; i < iterations; ++i) {
    	float t = float(i)/float(iterations-1);
        vec3 position = mix(view_ray_origin, atmosphereIntersections[1], t);
        float altitude = length(position)-planet_radius;
        accumulatedDensity += densityAtAltitude(altitude)*stepLength;
    }

    /*vec3 planetIntersections[2];
    float planetDist = line_sphere_intersection(view_ray_origin, view_ray_direction, vec3(0.0), planet_radius, planetIntersections);
    if(planetDist > 0.0 && dot(planetIntersections[0]-view_ray_origin, view_ray_direction) > 0.0)
    	atmosphereIntersections[1] = planetIntersections[0];*/
    vec4 density = vec4(
        accumulatedDensity,
        densityAtAltitude(centerDist-planet_radius),
        0, // distance(view_ray_origin, atmosphereIntersections[1]),
        0
    );
    imageStore(dst_texture, ivec2(gl_GlobalInvocationID.xy), density);
}
