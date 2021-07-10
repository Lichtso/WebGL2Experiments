#version 460

layout(location=0) in vec3 vPosition;
layout(location=1) in vec3 vNormal;
layout(location=2) in vec2 vTexCoord;

layout(location=0) out vec4 gBufferPosition;
layout(location=1) out ivec4 gBufferNormal;
layout(location=2) out vec4 gBufferAlbedo;
layout(location=3) out vec4 gBufferMaterial;

layout(set=0, binding=0) uniform sampler diffuseSampler;
layout(set=0, binding=1) uniform texture2D diffuseTexture;

void main() {
    gBufferNormal = ivec4(vNormal*32767.0, 0.0);
    gBufferPosition = vec4(vPosition, 0.0);
    gBufferAlbedo = texture(sampler2D(diffuseTexture, diffuseSampler), vTexCoord, 0);
    gBufferMaterial = vec4(0.0);
}
