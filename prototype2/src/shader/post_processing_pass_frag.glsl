#version 460
#extension GL_EXT_samplerless_texture_functions : require

layout(location=0) out vec4 frameColor;

layout(set=0, binding=0) uniform texture2D gBufferColor;
layout(set=0, binding=1) uniform texture2D gBufferDepth;

const mat3 SOBEL_X = mat3(
    1.0, 0.0, -1.0,
    2.0, 0.0, -2.0,
    1.0, 0.0, -1.0
);

const mat3 SOBEL_Y = mat3(
    1.0, 2.0, 1.0,
    0.0, 0.0, 0.0,
    -1.0, -2.0, -1.0
);

float convoluteMatrices(mat3 a, mat3 b) {
    return dot(a[0], b[0])+dot(a[1], b[1])+dot(a[2], b[2]);
}

vec2 sobel() {
    ivec2 texture_size = textureSize(gBufferDepth, 0).xy;
    mat3 imgMat = mat3(0.);
    for(int i = -1; i <= 1; i++)
        for(int j = -1; j <= 1; j++)
            imgMat[i+1][j+1] = texelFetch(gBufferDepth, (ivec2(gl_FragCoord.xy)+ivec2(i, j)+texture_size)%texture_size, 0).r;
    return vec2(convoluteMatrices(SOBEL_X, imgMat), convoluteMatrices(SOBEL_Y, imgMat));
}

void main() {
    ivec2 at = ivec2(gl_FragCoord.xy);
    frameColor = texelFetch(gBufferColor, at, 0);
    frameColor.rgb *= vec3(max(0.0, 1.0-length(sobel())*50.0));
}
