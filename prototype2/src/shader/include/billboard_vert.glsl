layout(location=0) in mat4 world_matrix;
layout(location=4) in mat4 inverse_world_matrix;
layout(location=8) in mat4 mvp_matrix;

#include "camera_uniforms.glsl"

const vec2 quad_vertices[] = vec2[](
    vec2(0.0, 0.0),
    vec2(1.0, 0.0),
    vec2(0.0, 1.0),
    vec2(1.0, 1.0)
);

#define M_PI 3.1415926535897932384626433832795

void billboard_sphere(vec3 world_position, float radius) {
    vec3 direction = world_position-camera.world_matrix[3].xyz;
    gl_Position.z = dot(direction, camera.world_matrix[2].xyz);
    float distance_to_camera = length(direction);
    float sphere_angle = asin(radius/distance_to_camera);
    direction /= distance_to_camera;
    vec2 screen_center = vec2(
        atan(dot(direction, camera.world_matrix[0].xyz)),
        atan(dot(direction, camera.world_matrix[1].xyz))
    );
    vec2 screen_min = tan(max(vec2(-M_PI*0.49), screen_center-vec2(sphere_angle)));
    vec2 screen_max = tan(min(vec2( M_PI*0.49), screen_center+vec2(sphere_angle)));
    gl_Position.xy = mix(screen_min, screen_max, quad_vertices[gl_VertexIndex&3])*distance_to_camera;
    gl_Position.w = 1.0;
    gl_Position = camera.projection_matrix*gl_Position;
    vClipPos = gl_Position;
}
