#version 460
#extension GL_EXT_samplerless_texture_functions : require
#extension GL_GOOGLE_include_directive : require

#include "include/ray_tracing_frag.glsl"

layout(location=0) in flat mat4 inverse_world_matrix;
layout(location=4) in flat vec3 world_position;
layout(location=5) in flat float world_radius;
layout(location=6) in vec4 vClipPos;
layout(location=0) out vec4 gBufferPosition;
layout(location=1) out ivec4 gBufferNormal;
layout(location=2) out vec4 gBufferAlbedo;
layout(location=3) out vec4 gBufferMaterial;

#include "include/camera_uniforms.glsl"

layout(set=0, binding=0) uniform sampler diffuseSampler;
layout(set=0, binding=1) uniform texture2DArray diffuseTexture;
layout(set=0, binding=2) uniform utexture2D terrain_and_selection_texture;



const vec3 ICOSAHEDRON_VERTICES[12] = vec3[](
    vec3(0.0, -1.0, 0.0),
    vec3(-0.27639320492744446, -0.4472135901451111, -0.8506507873535156),
    vec3(-0.8944271802902222, -0.4472135901451111, -1.6430361299034693e-16),
    vec3(-0.27639320492744446, -0.4472135901451111, 0.8506507873535156),
    vec3(0.7236068248748779, -0.4472135901451111, 0.525731086730957),
    vec3(0.7236068248748779, -0.4472135901451111, -0.525731086730957),
    vec3(0.27639320492744446, 0.4472135901451111, -0.8506507873535156),
    vec3(-0.7236068248748779, 0.4472135901451111, -0.525731086730957),
    vec3(-0.7236068248748779, 0.4472135901451111, 0.525731086730957),
    vec3(0.27639320492744446, 0.4472135901451111, 0.8506507873535156),
    vec3(0.8944271802902222, 0.4472135901451111, 1.6430361299034693e-16),
    vec3(0.0, 1.0, 0.0)
);

#define rotate_around(angle, center) \
    mat3(1.0, 0.0, 0.0, 0.0, 1.0, 0.0, center.x, center.y, 1.0)* \
    mat3( \
        cos(angle), -sin(angle), 0.0, \
        sin(angle), cos(angle), 0.0, \
        0.0, 0.0, 1.0 \
    )* \
    mat3(1.0, 0.0, 0.0, 0.0, 1.0, 0.0, -center.x, -center.y, 1.0)

/*#define rotate_around(angle, center) \
    mat3( \
        cos(angle), sin(angle), 0.0, \
        -sin(angle), cos(angle), 0.0, \
        -center.x*cos(angle)+center.y*sin(angle)-center.x, -center.x*sin(angle)-center.y*cos(angle)-center.y, 0.0 \
    )*/

const mat3 rotate_m60 = rotate_around(radians(-60.0), vec2(0.5));
const mat3 rotate_p60 = rotate_around(radians(60.0), vec2(0.5));
const float icosahedron_radius_by_edge_length = sin(M_PI*2.0/5.0);
const float blending_region = 0.3;

bool side_of_half_plane(vec3 direction, int pole_index_a, int pole_index_b) {
    vec3 aux_a = cross(ICOSAHEDRON_VERTICES[pole_index_a], ICOSAHEDRON_VERTICES[pole_index_b]);
    return dot(direction, aux_a) > 0.0;
}

vec3 inverse_barycentric_interpolation(vec3 direction, ivec3 pole_indices, bool angular_interpolation) {
    float sum = 0.0;
    vec3 barycentric = vec3(0.0);
    for(int i = 0; i < 3; ++i) {
        float dot_product = dot(cross(ICOSAHEDRON_VERTICES[pole_indices[(i+1)%3]], ICOSAHEDRON_VERTICES[pole_indices[(i+2)%3]]), direction);
        barycentric[i] = (angular_interpolation) ? asin(dot_product) : dot_product;
        sum += barycentric[i];
    }
    return barycentric/sum;
}

vec3 rotate_cube_coord(vec3 cube_coord) {
    return vec3(
        cube_coord.y-cube_coord.z,
        cube_coord.z-cube_coord.x,
        cube_coord.x-cube_coord.y
    );
}

vec3 round_cube_coord(vec3 barycentric) {
    vec3 rounded = round(barycentric);
    vec3 diff = abs(rounded-barycentric);
    if(diff.x > diff.y && diff.x > diff.z)
        rounded.x = -rounded.y-rounded.z;
    else if(diff.y > diff.z)
        rounded.y = -rounded.x-rounded.z;
    else
        rounded.z = -rounded.x-rounded.y;
    return rounded;
}

ivec3 color_at_field(int gp_index, int triangle_latitude, int triangle_longitude, ivec3 cube_coord, vec2 tex_coord, float edge_blending) {
    ivec2 parallelogram_coord = cube_coord.xy;
    if((triangle_longitude&1) == 1) {
        parallelogram_coord = ivec2(3*gp_index)-parallelogram_coord;
    }
    if(triangle_longitude >= 2) {
        parallelogram_coord[1] += 3*gp_index;
    }
    parallelogram_coord[1] = parallelogram_coord[1]*2+parallelogram_coord[0]%2;
    parallelogram_coord[0] = (parallelogram_coord[0]+gp_index*2)/2-gp_index;
    parallelogram_coord[1] = (parallelogram_coord[1]+gp_index*3)/3-gp_index;
    int parallelogram_width = 1+gp_index/2*3+gp_index%2;
    parallelogram_coord += ivec2(1+triangle_latitude*(parallelogram_width+2), 2);
    // gBufferAlbedo.rgb += cube_coord/gp_index*edge_blending;
    // gBufferAlbedo.rg += vec2(parallelogram_coord.xy)/(gp_index*4.0)*edge_blending;
    // const float checker_board = 0.25;
    // gBufferAlbedo.rgb += vec3(cube_coord)/float(gp_index)*edge_blending*((mod(tex_coord.s, checker_board) < checker_board*0.5 != mod(tex_coord.t, checker_board) < checker_board*0.5) ? 1.0 : 0.8);
    uvec4 terrain_and_selection = texelFetch(terrain_and_selection_texture, parallelogram_coord, 0);
    // gBufferAlbedo.rgb = vec3(vec2(terrain_and_selection.xy)/10.0, 0.0); //*edge_blending;
    gBufferAlbedo.rgb += texture(sampler2DArray(diffuseTexture, diffuseSampler), vec3(tex_coord, float(terrain_and_selection.x&0x0F)), 0).rgb*edge_blending;
    // gBufferMaterial.rgba += vec4(0.0);
    return ivec3((terrain_and_selection.x>>4)&0x0F, (terrain_and_selection.y>>4)&0x0F, terrain_and_selection.y&0x0F);
}

void main() {
    compute_view_ray()

    vec3 intersections[2];
    float planet_radius = world_radius;
    if(line_sphere_intersection(view_ray_origin, view_ray_direction, world_position, planet_radius, intersections) == 0.0)
        discard;

    // Normal, Position and Depth
    gBufferNormal = ivec4(normalize(intersections[0]-world_position)*32767.0, 0.0);
    gBufferPosition = vec4(intersections[0], 0.0);
    gBufferMaterial = vec4(0.0);
    clip_frag_depth(gBufferPosition.xyz)

    // Triangles and Barycentric
    vec3 direction = normalize((inverse_world_matrix*vec4(intersections[0], 1.0)).xyz);
    float longitude = 1.0-acos(direction[1])/M_PI;
    float latitude = atan(direction[0], direction[2])/M_PI;
    int triangle_latitude_south = int(mod((2.9+latitude)*2.5, 5.0));
    int triangle_latitude_north = int(mod((3.1+latitude)*2.5, 5.0));
    ivec3 pole_indices;
    int triangle_longitude;
    int triangle_latitude;
    if(side_of_half_plane(direction, 1+(triangle_latitude_south+1)%5, 1+triangle_latitude_south)) {
        pole_indices = ivec3(1+(triangle_latitude_south+1)%5, 1+triangle_latitude_south, 0);
        triangle_longitude = 0;
        triangle_latitude = triangle_latitude_south;
    } else if(side_of_half_plane(direction, 6+triangle_latitude_north, 6+(triangle_latitude_north+1)%5)) {
        pole_indices = ivec3(6+triangle_latitude_north, 6+(triangle_latitude_north+1)%5, 11);
        triangle_longitude = 3;
        triangle_latitude = triangle_latitude_north;
    } else if(side_of_half_plane(direction, 6+triangle_latitude_north, 1+triangle_latitude_north) &&
              side_of_half_plane(direction, 1+triangle_latitude_north, 6+(triangle_latitude_north+1)%5)) {
        pole_indices = ivec3(6+(triangle_latitude_north+1)%5, 6+triangle_latitude_north, 1+triangle_latitude_north);
        triangle_longitude = 2;
        triangle_latitude = triangle_latitude_north;
    } else {
        pole_indices = ivec3(1+triangle_latitude_south, 1+(triangle_latitude_south+1)%5, 6+(triangle_latitude_south+1)%5);
        triangle_longitude = 1;
        triangle_latitude = triangle_latitude_south;
    }
    int gp_index = int(planet_radius/(icosahedron_radius_by_edge_length*3.0));
    vec3 barycentric = inverse_barycentric_interpolation(direction, pole_indices, true)*float(gp_index);
    ivec3 cube_coord = ivec3(gp_index)-ivec3(rotate_cube_coord(round_cube_coord(rotate_cube_coord(barycentric))));
    vec3 center_diff;

    // Fix Edge Cases
    if(cube_coord.x == gp_index*3 || cube_coord.y == gp_index*3 || cube_coord.z == gp_index*3) {
        center_diff = barycentric*3.0-vec3(cube_coord);
        if((triangle_longitude&1) == 1) {
            center_diff *= -1.0;
        }
        switch(int(floor(longitude*6.0))) {
            case 0:
                triangle_latitude = (5-triangle_latitude)%5;
            case 5:
                switch(triangle_latitude) {
                    case 1:
                        center_diff = -center_diff.yzx;
                        break;
                    case 2:
                        center_diff = center_diff.zxy;
                        break;
                    case 3:
                        center_diff = center_diff.yzx;
                        break;
                    case 4:
                        center_diff = -center_diff.zxy;
                        break;
                }
                triangle_latitude = 0;
                break;
            case 3:
            case 4:
                cube_coord = ivec3(0.0, gp_index*3, 0.0);
                triangle_latitude = triangle_latitude_south;
                triangle_longitude = 3;
                break;
            case 1:
            case 2:
                cube_coord = ivec3(gp_index*3, 0.0, 0.0);
                triangle_latitude = triangle_latitude_north+4;
                triangle_longitude = 0;
                break;
        }
    } else {
        switch(triangle_longitude) {
            case 3:
                if(cube_coord.y == 0) {
                    cube_coord.xy = cube_coord.yx;
                    barycentric = vec3(-barycentric.y, float(gp_index)-barycentric.z, float(gp_index)-barycentric.x);
                    triangle_latitude += 4;
                }
                break;
            case 2:
                if(cube_coord.x == 0) {
                    cube_coord.yz = ivec2(gp_index*3)-cube_coord.yz;
                    barycentric = vec3(-barycentric.x, float(gp_index)-barycentric.y, float(gp_index)-barycentric.z);
                    triangle_longitude -= 1;
                    triangle_latitude += 4;
                } else if(cube_coord.z == 0) {
                    cube_coord.xy = ivec2(gp_index*3)-cube_coord.xy;
                    barycentric = vec3(float(gp_index)-barycentric.x, float(gp_index)-barycentric.y, -barycentric.z);
                    triangle_longitude += 1;
                }
                break;
            case 1:
                if(cube_coord.y == 0) {
                    cube_coord.xz = ivec2(gp_index*3)-cube_coord.xz;
                    barycentric = vec3(float(gp_index)-barycentric.x, -barycentric.y, float(gp_index)-barycentric.z);
                    triangle_longitude += 1;
                } else if(cube_coord.z == 0) {
                    cube_coord.xy = ivec2(gp_index*3)-cube_coord.xy;
                    barycentric = vec3(float(gp_index)-barycentric.x, float(gp_index)-barycentric.y, -barycentric.z);
                    triangle_longitude -= 1;
                }
                break;
            case 0:
                if(cube_coord.x == 0) {
                    cube_coord.xy = cube_coord.yx;
                    barycentric = vec3(float(gp_index)-barycentric.z, -barycentric.x, float(gp_index)-barycentric.y);
                    triangle_latitude += 4;
                }
                break;
        }
        center_diff = barycentric*3.0-vec3(cube_coord);
        if((triangle_longitude&1) == 1) {
            center_diff *= -1.0;
        }
    }
    triangle_latitude %= 5;

    // Texture Coordinates and Blending
    vec2 tex_coord = vec2(0.5)+0.75*vec2(center_diff.z, (center_diff.x-center_diff.y)/sqrt(3.0))/3.0;
    float selection_edge = 0.0;
#if 1
    vec3 edge_blending = (abs(center_diff)-vec3(1.0-blending_region))/blending_region*0.5;
    edge_blending = smoothstep(vec3(0.0), vec3(1.0), edge_blending);
    if((triangle_longitude&1) == 1) {
        center_diff *= -1.0;
    }
    float sum = 1.0-max(max(max(edge_blending.x, edge_blending.y), edge_blending.z), 0.0);
    ivec3 center_selection = color_at_field(gp_index, triangle_latitude, triangle_longitude, cube_coord, tex_coord, sum);
    for(int i = 0; i < 3; ++i) {
        if(edge_blending[i] > 0.0) {
            int s = int(sign(center_diff[i]));
            ivec3 dir = ivec3(0);
            dir[i] = 2*s;
            dir[(i+1)%3] = -s;
            dir[(i+2)%3] = -s;
            ivec3 neighbor_coord = cube_coord+dir;
            vec2 neighbor_tex_coord = tex_coord;
            switch(triangle_longitude) {
                case 3:
                case 0:
                    if(neighbor_coord.x < 0) {
                        neighbor_tex_coord = (rotate_p60*vec3(tex_coord, 1.0)).xy;
                    } else if(neighbor_coord.y < 1) {
                        neighbor_tex_coord = (rotate_m60*vec3(tex_coord, 1.0)).xy;
                    }
                    break;
            }
            ivec3 neighbor_selection = color_at_field(gp_index, triangle_latitude, triangle_longitude, neighbor_coord, neighbor_tex_coord, edge_blending[i]);
            if(neighbor_selection != center_selection) {
                selection_edge = 1.0;
            }
            sum += edge_blending[i];
        }
    }
    gBufferAlbedo.rgb /= sum;
#else
    // gBufferAlbedo.r = float(triangle_longitude)/4.0;
    // gBufferAlbedo.g = float(triangle_latitude)/5.0;
    // gBufferAlbedo.rgb = cube_coord/(gp_index*3.0);
    // gBufferAlbedo.rgb = center_diff/3.0;
    // gBufferAlbedo.rgb = vec3(tex_coord, 0.0);
    ivec3 center_selection = color_at_field(gp_index, triangle_latitude, triangle_longitude, cube_coord, tex_coord, 1.0);
#endif
    vec3 selection_color = vec3(center_selection)/15.0;
    if(selection_color != vec3(0.0)) {
        gBufferAlbedo.rgb = mix(gBufferAlbedo.rgb, selection_color, 0.5);
        gBufferMaterial.b = selection_edge;
    }
    // float dist_to_field_edge = max(max(abs(center_diff.x), abs(center_diff.y)), abs(center_diff.z))*3.0;
    // gBufferAlbedo.rgb *= 1.0-smoothstep(0.9, 1.0, dist_to_field_edge);
}
