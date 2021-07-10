float line_plane_intersection(vec3 origin, vec3 direction, vec3 point_on_plane, vec3 plane_normal) {
    float determinant = dot(direction, plane_normal);
    if(determinant == 0.0)
        return 0.0/0.0;
    float parallel_distance = dot(point_on_plane-origin, plane_normal)/determinant;
    return parallel_distance;
}

float line_sphere_intersection(vec3 origin, vec3 direction, vec3 center, float radius, out vec3 intersections[2]) {
    vec3 diagonal = origin-center;
	vec3 parallel = dot(diagonal, direction)*direction;
    vec3 orthogonal = diagonal-parallel;
    float orthogonal_distance = length(orthogonal);
    if(orthogonal_distance > radius)
        return 0.0;
   	float parallel_distance = sin(acos(orthogonal_distance/radius))*radius;
    intersections[0] = origin-parallel-direction*parallel_distance;
    intersections[1] = origin-parallel+direction*parallel_distance;
    return parallel_distance*2.0;
}

const float M_PI = radians(180.0);
// #define M_PI 3.1415926535897932384626433832795

#define compute_view_ray() \
    vec3 view_ray_origin = camera.world_matrix[3].xyz; \
    vec3 view_ray_hit = (camera.inverse_view_matrix*vClipPos).xyz; \
    vec3 view_ray_direction = normalize(view_ray_hit-view_ray_origin);

#define frag_depth(position) \
    float csp_z = dot(position-view_ray_origin, camera.world_matrix[2].xyz); \
    float csp_w = abs(csp_z*camera.projection_matrix[2][3]); \
    csp_z = csp_z*camera.projection_matrix[2][2]+camera.projection_matrix[3][2]; \
    gl_FragDepth = csp_z/csp_w;

#define clip_frag_depth(position) \
    frag_depth(position) \
    if(gl_FragDepth < 0.0) \
        discard;
