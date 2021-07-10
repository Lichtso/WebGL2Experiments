// https://www.ronja-tutorials.com/2018/09/29/voronoi-noise.html

#include "hash_noise.glsl"

float signed_voronoi_select(float a, float b, float c) {
    a = (a > 0.0) ? a : b;
    a = (a > 0.0) ? a : c;
    return a;
}

void signed_voronoi_noise(float v, float randomness, out vec3 cell_distance, out vec3 cell_position) {
    int base_cell = int(v);
    float direction_to_center[4];
    for(int x = -2; x <= 1; ++x) {
        int cell = base_cell+x;
        float cell_position = float(cell)+randomness*unit_interval(hash(cell));
        direction_to_center[x+2] = cell_position-v;
    }
    float prev_cell_distance = signed_voronoi_select(-direction_to_center[2], -direction_to_center[1], -direction_to_center[0]);
    float prev_cell_position = v-prev_cell_distance;
    float next_cell_distance = signed_voronoi_select(direction_to_center[1], direction_to_center[2], direction_to_center[3]);
    float next_cell_position = v+next_cell_distance;
    float closest_cell_distance = min(min(abs(direction_to_center[1]), abs(direction_to_center[2])), abs(direction_to_center[3]));
    float closest_cell_position = (prev_cell_distance < next_cell_distance) ? prev_cell_position : next_cell_position;
    cell_distance = vec3(prev_cell_distance, closest_cell_distance, next_cell_distance);
    cell_position = vec3(prev_cell_position, closest_cell_position, next_cell_position);
}

vec3 voronoi_noise(float v, float randomness) {
    float direction_to_closest_center;
    int closest_cell, base_cell = int(v);
    float min_distance_to_center = 1.0/0.0;
    for(int x = -1; x <= 1; ++x) {
        int cell = base_cell+x;
        float cell_position = float(cell)+randomness*unit_interval(hash(cell));
        float direction_to_center = cell_position-v;
        float distance_to_center = abs(direction_to_center);
        if(min_distance_to_center > distance_to_center) {
            min_distance_to_center = distance_to_center;
            direction_to_closest_center = direction_to_center;
            closest_cell = cell;
        }
    }
    float min_edge_distance = 1.0/0.0;
    for(int x = -1; x <= 1; ++x) {
        int cell = base_cell+x;
        if(cell == closest_cell) {
            continue;
        }
        float cell_position = float(cell)+randomness*unit_interval(hash(cell));
        float direction_to_center = cell_position-v;
        float to_center = (direction_to_center+direction_to_closest_center)*0.5;
        float cell_difference = sign(direction_to_center-direction_to_closest_center);
        min_edge_distance = min(min_edge_distance, to_center*cell_difference);
    }
    return vec3(min_distance_to_center, min_edge_distance, unit_interval(hash(closest_cell)));
}

vec3 voronoi_noise(vec2 v, float randomness) {
    vec2 direction_to_closest_center;
    ivec2 closest_cell, base_cell = ivec2(v);
    float min_distance_to_center = 1.0/0.0;
    for(int y = -1; y <= 1; ++y) {
        for(int x = -1; x <= 1; ++x) {
            ivec2 cell = base_cell+ivec2(x, y);
            vec2 cell_position = vec2(cell)+randomness*vec2(unit_interval(hash(cell.yx)), unit_interval(hash(cell.xy)));
            vec2 direction_to_center = cell_position-v;
            float distance_to_center = length(direction_to_center);
            if(min_distance_to_center > distance_to_center) {
                min_distance_to_center = distance_to_center;
                direction_to_closest_center = direction_to_center;
                closest_cell = cell;
            }
        }
    }
    float min_edge_distance = 1.0/0.0;
    for(int y = -1; y <= 1; ++y) {
        for(int x = -1; x <= 1; ++x) {
            ivec2 cell = base_cell+ivec2(x, y);
            if(cell == closest_cell) {
            	continue;
            }
            vec2 cell_position = vec2(cell)+randomness*vec2(unit_interval(hash(cell.yx)), unit_interval(hash(cell.xy)));
            vec2 direction_to_center = cell_position-v;
            vec2 to_center = (direction_to_center+direction_to_closest_center)*0.5;
            vec2 cell_difference = normalize(direction_to_center-direction_to_closest_center);
            min_edge_distance = min(min_edge_distance, dot(to_center, cell_difference));
        }
    }
    return vec3(min_distance_to_center, min_edge_distance, unit_interval(hash(closest_cell)));
}

vec3 voronoi_noise(vec3 v, float randomness) {
    vec3 direction_to_closest_center;
    ivec3 closest_cell, base_cell = ivec3(v);
    float min_distance_to_center = 1.0/0.0;
    for(int z = -1; z <= 1; ++z) {
        for(int y = -1; y <= 1; ++y) {
            for(int x = -1; x <= 1; ++x) {
                ivec3 cell = base_cell+ivec3(x, y, z);
                vec3 cell_position = vec3(cell)+randomness*vec3(unit_interval(hash(cell.xyz)), unit_interval(hash(cell.yzx)), unit_interval(hash(cell.zxy)));
                vec3 direction_to_center = cell_position-v;
                float distance_to_center = length(direction_to_center);
                if(min_distance_to_center > distance_to_center) {
                    min_distance_to_center = distance_to_center;
                    direction_to_closest_center = direction_to_center;
                    closest_cell = cell;
                }
            }
        }
    }
    float min_edge_distance = 1.0/0.0;
    for(int z = -1; z <= 1; ++z) {
        for(int y = -1; y <= 1; ++y) {
            for(int x = -1; x <= 1; ++x) {
                ivec3 cell = base_cell+ivec3(x, y, z);
                if(cell == closest_cell) {
                	continue;
                }
                vec3 cell_position = vec3(cell)+randomness*vec3(unit_interval(hash(cell.xyz)), unit_interval(hash(cell.yzx)), unit_interval(hash(cell.zxy)));
                vec3 direction_to_center = cell_position-v;
                vec3 to_center = (direction_to_center+direction_to_closest_center)*0.5;
                vec3 cell_difference = normalize(direction_to_center-direction_to_closest_center);
                min_edge_distance = min(min_edge_distance, dot(to_center, cell_difference));
            }
        }
    }
    return vec3(min_distance_to_center, min_edge_distance, unit_interval(hash(closest_cell)));
}
