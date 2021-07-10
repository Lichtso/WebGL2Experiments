#version 460
#extension GL_EXT_samplerless_texture_functions : require

layout(location=0) out vec4 gBufferColor;

layout(set=0, binding=0) uniform texture2D gBufferPosition;
layout(set=0, binding=1) uniform itexture2D gBufferNormal;
layout(set=0, binding=2) uniform texture2D gBufferAlbedo;
layout(set=0, binding=3) uniform texture2D gBufferMaterial;

/*struct AmbidentLightSettings {
    vec3 color;
};
layout(set=1, binding=0) readonly buffer LightSettingUniforms {
    AmbidentLightSettings light_setting;
};*/

void main() {
    ivec2 at = ivec2(gl_FragCoord.xy);
    vec4 albedo = texelFetch(gBufferAlbedo, at, 0);
    vec4 material = texelFetch(gBufferMaterial, at, 0);
    gBufferColor.rgb = albedo.rgb*vec3(0.1+material.b*2.0);
}
