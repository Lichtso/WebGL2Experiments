exports.vertexShader = `
uniform mat4 worldMatrix;
uniform mat4 projectionMatrix;
layout(location=0) in vec4 vPosition;
layout(location=1) in vec3 vNormal;
layout(location=2) in vec2 vTexcoord;
out vec3 fPosition;
out vec3 fNormal;
out vec2 fTexcoord;

void main() {
    mat3 normalTransform = mat3(
        worldMatrix[0].xyz,
        worldMatrix[1].xyz,
        worldMatrix[2].xyz
    );
    gl_Position = projectionMatrix*(worldMatrix*vPosition);
    fPosition = (worldMatrix*vPosition).xyz;
    fNormal = normalTransform*vNormal;
    fTexcoord = vTexcoord;
}`;

exports.fragmentShader = `
layout(binding=0) uniform sampler2D diffuseMap;
in vec3 fPosition;
in vec3 fNormal;
in vec2 fTexcoord;
out vec4 diffuse;

void main() {
    diffuse = texture(diffuseMap, fTexcoord);
    vec3 lightVector = normalize(vec3(-1.0, 1.0, 2.0));
    diffuse.rgb *= clamp(pow(1024.0, dot(fNormal, lightVector))-1.0, 0.5, 1.0);
}`;
