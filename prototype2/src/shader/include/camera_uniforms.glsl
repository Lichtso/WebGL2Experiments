layout(set=1, binding=0) readonly buffer CameraUniforms {
    mat4 world_matrix;
    mat4 projection_matrix;
    mat4 inverse_view_matrix;
} camera;
