#version 460

layout(local_size_x=32, local_size_y=1, local_size_z=1) in;

layout(set=0, binding=0) readonly buffer InstancesIn {
    mat4 instances_world_matrix[];
};

layout(set=0, binding=1) buffer InstancesOut {
    mat4 instances_inverse_world_matrix[];
};

void main() {
    instances_inverse_world_matrix[gl_GlobalInvocationID.x] = inverse(instances_world_matrix[gl_GlobalInvocationID.x]);
}
