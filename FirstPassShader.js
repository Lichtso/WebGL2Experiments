export const vertexShader = `
uniform mat4 worldMatrix;
uniform mat3 normalMatrix;
uniform mat4 projectionMatrix;
uniform float widthInRadians, sphereRadius, unfold;

layout(location=0) in vec4 vPosition;
layout(location=1) in vec3 vNormal;
layout(location=2) in vec2 vTexcoord;
out vec3 fPosition;
out vec3 fNormal;
out vec2 fTexcoord;

void main() {
    float xPos = widthInRadians*0.5*smoothstep(0.0, 1.0, unfold-1.0);
    float yAngle = (vTexcoord.x-0.5)*widthInRadians;
    float xSign = sign(yAngle);
    bool onTheRoll = xPos < abs(yAngle);
    yAngle = (onTheRoll) ? yAngle-xPos*xSign : 0.0;
    vec4 cylindricProjection = vec4(sin(yAngle)*sphereRadius, -(vTexcoord.y-0.5)*sphereRadius*3.2, cos(yAngle)*sphereRadius, 1.0);
    vec4 positionInWorld = mix(vPosition, cylindricProjection, smoothstep(0.0, 1.0, unfold));
    positionInWorld.x += sphereRadius*((onTheRoll) ? xPos*xSign : widthInRadians*(vTexcoord.x-0.5));
    positionInWorld = worldMatrix*positionInWorld;
    gl_Position = projectionMatrix*positionInWorld;
    fPosition = positionInWorld.xyz;
    fNormal = normalMatrix*vNormal;
    fTexcoord = vTexcoord;
}`;

export const fragmentShader = `
layout(binding=0) uniform sampler2D diffuseMap;
in vec3 fPosition;
in vec3 fNormal;
in vec2 fTexcoord;
layout(location=0) out vec3 position;
layout(location=1) out vec3 normal;
layout(location=2) out vec2 texcoord;
layout(location=3) out vec4 diffuse;

void main() {
    position = fPosition;
    normal = fNormal;
    texcoord = fTexcoord;
    diffuse = texture(diffuseMap, fTexcoord.xy);
}`;
