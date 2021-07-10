#version 460
#extension GL_EXT_samplerless_texture_functions : require

layout(local_size_x=32, local_size_y=32, local_size_z=1) in;

layout(set=0, binding=0) uniform texture2DArray src_texture;
layout(set=0, binding=1) uniform writeonly image2DArray dst_texture;

void main() {
    ivec3 dst_uv = ivec3(gl_GlobalInvocationID.xyz);
    ivec3 src_uv = dst_uv;
    src_uv.xy *= 2;

    vec4 color = vec4(0.0);
    for(int y = 0; y < 2; ++y)
        for(int x = 0; x < 2; ++x)
            color += texelFetch(src_texture, src_uv+ivec3(x, y, 0), 0);
    imageStore(dst_texture, dst_uv, color*0.25);
}
