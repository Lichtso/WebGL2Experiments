#version 460
#extension GL_EXT_samplerless_texture_functions : require

layout(local_size_x=32, local_size_y=32, local_size_z=1) in;

layout(set=0, binding=0) uniform texture3D src_texture;
layout(set=0, binding=1) uniform writeonly image3D dst_texture;

#define interpolationFactor(axis) \
    if((prev_size.axis&1) == 1) { \
        w0s.axis = w2e.axis = float(next_size.axis)/float(prev_size.axis); \
        w0e.axis = w2s.axis = 1.0/float(prev_size.axis); \
    } else { \
        w0s.axis = w0e.axis = 0.5; \
        w2s.axis = w2e.axis = 0.0; \
    }

void main() {
    ivec3 dst_uv = ivec3(gl_GlobalInvocationID.xyz);
    ivec3 src_uv = dst_uv*2;

    ivec3 prev_size = textureSize(src_texture, 0);
    ivec3 next_size = imageSize(dst_texture);
    vec3 w0s, w0e, w2s, w2e;
    interpolationFactor(x)
    interpolationFactor(y)
    interpolationFactor(z)

    vec3 uv = vec3(gl_GlobalInvocationID.xyz)/vec3(next_size);
    vec3 w[] = { mix(w0s, w0e, uv), w0s, mix(w2s, w2e, uv) };

    vec4 color = vec4(0.0);
    vec4 layer, row;
    row = texelFetch(src_texture, src_uv+ivec3(0, 0, 0), 0)*w[0].x;
    row += texelFetch(src_texture, src_uv+ivec3(1, 0, 0), 0)*w[1].x;
    row += texelFetch(src_texture, src_uv+ivec3(2, 0, 0), 0)*w[2].x;
    layer = row*w[0].y;
    row = texelFetch(src_texture, src_uv+ivec3(0, 1, 0), 0)*w[0].x;
    row += texelFetch(src_texture, src_uv+ivec3(1, 1, 0), 0)*w[1].x;
    row += texelFetch(src_texture, src_uv+ivec3(2, 1, 0), 0)*w[2].x;
    layer += row*w[1].y;
    row = texelFetch(src_texture, src_uv+ivec3(0, 2, 0), 0)*w[0].x;
    row += texelFetch(src_texture, src_uv+ivec3(1, 2, 0), 0)*w[1].x;
    row += texelFetch(src_texture, src_uv+ivec3(2, 2, 0), 0)*w[2].x;
    layer += row*w[2].y;
    color += layer*w[0].z;
    row = texelFetch(src_texture, src_uv+ivec3(0, 0, 1), 0)*w[0].x;
    row += texelFetch(src_texture, src_uv+ivec3(1, 0, 1), 0)*w[1].x;
    row += texelFetch(src_texture, src_uv+ivec3(2, 0, 1), 0)*w[2].x;
    layer = row*w[0].y;
    row = texelFetch(src_texture, src_uv+ivec3(0, 1, 1), 0)*w[0].x;
    row += texelFetch(src_texture, src_uv+ivec3(1, 1, 1), 0)*w[1].x;
    row += texelFetch(src_texture, src_uv+ivec3(2, 1, 1), 0)*w[2].x;
    layer += row*w[1].y;
    row = texelFetch(src_texture, src_uv+ivec3(0, 2, 1), 0)*w[0].x;
    row += texelFetch(src_texture, src_uv+ivec3(1, 2, 1), 0)*w[1].x;
    row += texelFetch(src_texture, src_uv+ivec3(2, 2, 1), 0)*w[2].x;
    layer += row*w[2].y;
    color += layer*w[1].z;
    row = texelFetch(src_texture, src_uv+ivec3(0, 0, 2), 0)*w[0].x;
    row += texelFetch(src_texture, src_uv+ivec3(1, 0, 2), 0)*w[1].x;
    row += texelFetch(src_texture, src_uv+ivec3(2, 0, 2), 0)*w[2].x;
    layer = row*w[0].y;
    row = texelFetch(src_texture, src_uv+ivec3(0, 1, 2), 0)*w[0].x;
    row += texelFetch(src_texture, src_uv+ivec3(1, 1, 2), 0)*w[1].x;
    row += texelFetch(src_texture, src_uv+ivec3(2, 1, 2), 0)*w[2].x;
    layer += row*w[1].y;
    row = texelFetch(src_texture, src_uv+ivec3(0, 2, 2), 0)*w[0].x;
    row += texelFetch(src_texture, src_uv+ivec3(1, 2, 2), 0)*w[1].x;
    row += texelFetch(src_texture, src_uv+ivec3(2, 2, 2), 0)*w[2].x;
    layer += row*w[2].y;
    color += layer*w[2].z;
    /*for(int z = 0; z < 3; ++z) {
        vec4 layer = vec4(0.0);
        for(int y = 0; y < 3; ++y) {
            vec4 row = vec4(0.0);
            for(int x = 0; x < 3; ++x) {
                row += texelFetch(src_texture, src_uv+ivec3(x, y, z), 0)*w[x].x;
            }
            layer += row*w[y].y;
        }
        color += layer*w[z].z;
    }*/
    imageStore(dst_texture, dst_uv, color);
}
