#version 460
#extension GL_EXT_samplerless_texture_functions : require

layout(local_size_x=32, local_size_y=32, local_size_z=1) in;

layout(set=0, binding=0) uniform texture3D src_texture;
layout(set=0, binding=1) uniform writeonly image3D dst_texture;

void main() {
    ivec3 dst_uv = ivec3(gl_GlobalInvocationID.xyz);
    ivec3 src_uv = dst_uv*2;

    vec4 color = vec4(0.0);
    for(int z = 0; z < 2; ++z)
        for(int y = 0; y < 2; ++y)
            for(int x = 0; x < 2; ++x)
                color += texelFetch(src_texture, src_uv+ivec3(x, y, z), 0);
    imageStore(dst_texture, dst_uv, color*0.125);
}
