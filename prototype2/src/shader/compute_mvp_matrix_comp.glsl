#version 460

layout(local_size_x=32, local_size_y=1, local_size_z=1) in;

layout(set=0, binding=0) readonly buffer InstancesIn {
    mat4 instances_world_matrix[];
};

layout(set=0, binding=1) buffer InstancesOut {
    mat4 instances_mvp_matrix[];
};

layout(push_constant) uniform Camera {
    mat4 view_matrix;
} camera;

void main() {
    instances_mvp_matrix[gl_GlobalInvocationID.x] = camera.view_matrix*instances_world_matrix[gl_GlobalInvocationID.x];
}
