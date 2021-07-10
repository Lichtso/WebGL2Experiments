#version 460
#extension GL_EXT_samplerless_texture_functions : require

layout(local_size_x=32, local_size_y=32, local_size_z=1) in;

layout(set=0, binding=0) uniform texture2DArray src_texture;
layout(set=0, binding=1) uniform writeonly image2DArray dst_texture;

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
    ivec3 src_uv = dst_uv;
    src_uv.xy *= 2;

    ivec2 prev_size = textureSize(src_texture, 0).xy;
    ivec2 next_size = imageSize(dst_texture).xy;
    vec2 w0s, w0e, w2s, w2e;
    interpolationFactor(x)
    interpolationFactor(y)

    vec2 uv = vec2(gl_GlobalInvocationID.xy)/vec2(next_size);
    vec2 w[] = { mix(w0s, w0e, uv), w0s, mix(w2s, w2e, uv) };

    vec4 color = vec4(0.0);
    vec4 row;
    row = texelFetch(src_texture, src_uv+ivec3(0, 0, 0), 0)*w[0].x;
    row += texelFetch(src_texture, src_uv+ivec3(1, 0, 0), 0)*w[1].x;
    row += texelFetch(src_texture, src_uv+ivec3(2, 0, 0), 0)*w[2].x;
    color += row*w[0].y;
    row = texelFetch(src_texture, src_uv+ivec3(0, 1, 0), 0)*w[0].x;
    row += texelFetch(src_texture, src_uv+ivec3(1, 1, 0), 0)*w[1].x;
    row += texelFetch(src_texture, src_uv+ivec3(2, 1, 0), 0)*w[2].x;
    color += row*w[1].y;
    row = texelFetch(src_texture, src_uv+ivec3(0, 2, 0), 0)*w[0].x;
    row += texelFetch(src_texture, src_uv+ivec3(1, 2, 0), 0)*w[1].x;
    row += texelFetch(src_texture, src_uv+ivec3(2, 2, 0), 0)*w[2].x;
    color += row*w[2].y;
    /*for(int y = 0; y < 3; ++y) {
        vec4 row = vec4(0.0);
        for(int x = 0; x < 3; ++x) {
            row += texelFetch(src_texture, src_uv+ivec3(x, y, 0), 0)*w[x].x;
        }
        color += row*w[y].y;
    }*/
    imageStore(dst_texture, dst_uv, color);
}
