export const vertexShader = `
layout(location=0) in vec2 vPosition;
out vec2 fTexcoord;

void main() {
    gl_Position = vec4(vPosition, 0, 1);
    fTexcoord = (vPosition+vec2(1.0))*0.5;
}`;

export const fragmentShader = `
layout(binding=0) uniform sampler2D positionMap;
layout(binding=1) uniform sampler2D normalMap;
layout(binding=2) uniform sampler2D diffuseMap;
in vec2 fTexcoord;
layout(location=0) out vec4 color;

void main() {
    color = texture(diffuseMap, fTexcoord);
    vec3 normal = texture(normalMap, fTexcoord).xyz;

    vec3 lightVector = normalize(vec3(-1.0, 1.0, 2.0));
    color.rgb *= clamp(pow(1024.0, dot(normal, lightVector))-1.0, 0.5, 1.0);
}`;
