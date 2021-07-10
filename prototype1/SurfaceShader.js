export const vertexShader = `
uniform mat4 worldMatrix;
uniform mat3 normalMatrix;
uniform mat4 cameraCombinedMatrix;
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
    gl_Position = cameraCombinedMatrix*positionInWorld;
    fPosition = positionInWorld.xyz;
    fNormal = normalMatrix*vNormal;
    fTexcoord = vTexcoord;
}`;

export const fragmentShader = `
layout(binding=0) uniform sampler2D colorMap;
in vec3 fPosition;
in vec3 fNormal;
in vec2 fTexcoord;
layout(location=0) out vec4 color;
layout(location=1) out vec3 position;
layout(location=2) out ivec3 normal;
layout(location=3) out uvec2 texcoord;

// uniform vec3 highLight;

const vec3 ICOSAHEDRON_VERTICES[12] = vec3[](
    vec3(0.0, -1.0, 0.0),
    vec3(-0.27639320492744446, -0.4472135901451111, -0.8506507873535156),
    vec3(-0.8944271802902222, -0.4472135901451111, -1.6430361299034693e-16),
    vec3(-0.27639320492744446, -0.4472135901451111, 0.8506507873535156),
    vec3(0.7236068248748779, -0.4472135901451111, 0.525731086730957),
    vec3(0.7236068248748779, -0.4472135901451111, -0.525731086730957),
    vec3(0.27639320492744446, 0.4472135901451111, -0.8506507873535156),
    vec3(-0.7236068248748779, 0.4472135901451111, -0.525731086730957),
    vec3(-0.7236068248748779, 0.4472135901451111, 0.525731086730957),
    vec3(0.27639320492744446, 0.4472135901451111, 0.8506507873535156),
    vec3(0.8944271802902222, 0.4472135901451111, 1.6430361299034693e-16),
    vec3(0.0, 1.0, 0.0)
);

#define M_PI 3.1415926535897932384626433832795
const float pentagonY = -1.0/sqrt(5.0);
const float triangleAngle = M_PI*0.25+0.5*atan(0.5);
const float gp_index = 10.0;

vec3 roundCubeCoords(vec3 barycentric) {
    vec3 rounded = round(barycentric);
    vec3 diff = abs(rounded-barycentric);
    if(diff.x > diff.y && diff.x > diff.z)
        rounded.x = -rounded.y-rounded.z;
    else if(diff.y > diff.z)
        rounded.y = -rounded.x-rounded.z;
    else
        rounded.z = -rounded.x-rounded.y;
    rounded[0] = gp_index-(rounded[1]+rounded[2]);
    return rounded;
}

vec3 spherical_tangent(vec3 src, vec3 dst) {
    return normalize(cross(cross(src, dst), src));
}

float spherical_angle(vec3 a, vec3 b, vec3 c) {
    return acos(dot(
        spherical_tangent(a, b),
        spherical_tangent(a, c)
    ));
}

vec3 inverse_barycentric_interpolation(vec3 direction, ivec3 pole_indices, bool angular_interpolation) {
    float sum = 0.0,
          minimum = 1.0/0.0,
          maximum = 0.0;
    vec3 barycentric = vec3(0.0);
    for(int i = 0; i < 3; ++i) {
        vec3 aux_a = cross(ICOSAHEDRON_VERTICES[pole_indices[(i+1)%3]], ICOSAHEDRON_VERTICES[pole_indices[(i+2)%3]]);
        float dot_a = dot(aux_a, direction);
        if(angular_interpolation) {
            dot_a = asin(dot_a);
        }
        barycentric[i] = dot_a;
        sum += barycentric[i];
        minimum = min(minimum, barycentric[i]);
        maximum = max(maximum, barycentric[i]);
    }
    barycentric /= (barycentric.x+barycentric.y+barycentric.z);
    // return barycentric/(barycentric.x+barycentric.y+barycentric.z);
    return vec3((barycentric.x-barycentric.y)*0.5+0.5);
}

void main() {
    position = fPosition;
    normal = ivec3(fNormal*32767.0);
    texcoord = uvec2(fTexcoord*65535.0);
    // color = texture(colorMap, fTexcoord.xy);

    vec3 direction = normalize(fNormal);
    float longitude = 1.0-acos(fNormal[1])/M_PI;
    float latitudeSouth = mod((0.9+atan(fNormal[0], fNormal[2])/M_PI)*0.5, 1.0);
    float latitudeNorth = mod((1.1+atan(fNormal[0], fNormal[2])/M_PI)*0.5, 1.0);
    int triangleLatitudeSouth = int(floor(latitudeSouth*5.0));
    int triangleLatitudeNorth = int(floor(latitudeNorth*5.0));

    ivec3 poleIndices;
    if(dot(direction, normalize(cross(ICOSAHEDRON_VERTICES[1+(triangleLatitudeSouth+1)%5], ICOSAHEDRON_VERTICES[1+triangleLatitudeSouth]))) > 0.0) {
        poleIndices = ivec3(1+(triangleLatitudeSouth+1)%5, 1+triangleLatitudeSouth, 0);
    } else if(dot(direction, normalize(cross(ICOSAHEDRON_VERTICES[6+triangleLatitudeNorth], ICOSAHEDRON_VERTICES[6+(triangleLatitudeNorth+1)%5]))) > 0.0) {
        poleIndices = ivec3(6+triangleLatitudeNorth, 6+(triangleLatitudeNorth+1)%5, 11);
    } else if(dot(direction, normalize(cross(ICOSAHEDRON_VERTICES[6+triangleLatitudeNorth], ICOSAHEDRON_VERTICES[1+triangleLatitudeNorth]))) > 0.0 &&
              dot(direction, normalize(cross(ICOSAHEDRON_VERTICES[1+triangleLatitudeNorth], ICOSAHEDRON_VERTICES[6+(triangleLatitudeNorth+1)%5]))) > 0.0) {
        poleIndices = ivec3(6+(triangleLatitudeNorth+1)%5, 6+triangleLatitudeNorth, 1+triangleLatitudeNorth);
    } else {
        poleIndices = ivec3(1+triangleLatitudeSouth, 1+(triangleLatitudeSouth+1)%5, 6+(triangleLatitudeSouth+1)%5);
    }
    vec3 barycentric = inverse_barycentric_interpolation(direction, poleIndices, true);
    // color.rgb = floor(barycentric*gp_index)/gp_index;
    // barycentric *= gp_index;
    // barycentric[0] = -(barycentric[1]+barycentric[2]);
    // color.rgb = roundCubeCoords(barycentric)/gp_index;
    color.rgb = texture(colorMap, fTexcoord.xy).rgb;

    // color.rgb += vec3(clamp((0.1-length(barycentric-highLight))*10.0, 0.0, 1.0));
    // color.rgb += vec3(clamp((0.03-length(fTexcoord-highLight))*10.0, 0.0, 1.0));
    // color.rgb += vec3(clamp((0.02-length(normalize(fPosition)-highLight))*10.0, 0.0, 1.0));
}`;
