#extension GL_EXT_samplerless_texture_functions : require

layout(location=0) out vec4 gBufferColor;

layout(set=0, binding=0) uniform texture2D gBufferPosition;
layout(set=0, binding=1) uniform itexture2D gBufferNormal;
layout(set=0, binding=2) uniform texture2D gBufferAlbedo;
layout(set=0, binding=3) uniform texture2D gBufferMaterial;

#include "camera_uniforms.glsl"

float specular_factor(vec3 light_direction, vec3 position, vec3 normal, float specularPower) {
    vec3 viewDir = normalize(camera.world_matrix[3].xyz-position);
    vec3 halfDir = normalize(light_direction+viewDir);
    return pow(max(dot(normal, halfDir), 0.0), specularPower);
}

float light_attenuation(float distance, float radius) {
    float attenuation = clamp(1.0-distance*distance/(radius*radius), 0.0, 1.0);
    return attenuation*attenuation;
}

#define light_gbuffer(LightSettings) \
    ivec2 at = ivec2(gl_FragCoord.xy); \
    vec3 position = texelFetch(gBufferPosition, at, 0).xyz; \
    vec3 normal = vec3(texelFetch(gBufferNormal, at, 0).xyz)/32767.0; \
    vec3 albedo = texelFetch(gBufferAlbedo, at, 0).xyz; \
    vec3 material = texelFetch(gBufferMaterial, at, 0).xyz;

#define light_attenuation_and_direction() \
    vec3 light_direction = world_position-position; \
    float distance = length(light_direction); \
    float attenuation = max(0.0, 1.0-distance*distance/(world_radius*world_radius)); \
    attenuation *= attenuation; \
    light_direction = light_direction/distance;

#define diffuse_specular_color() \
    float specular = specular_factor(light_direction, position, normal, material.g*255.0+1.0); \
    float diffuse = max(0.0, dot(normal, light_direction))*attenuation; \
    gBufferColor.rgb = (albedo*diffuse+vec3(material.r*specular))*light_setting.color;
