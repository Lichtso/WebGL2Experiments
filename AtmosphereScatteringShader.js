export const vertexShader = `
layout(location=0) in vec3 vPosition;
out vec4 fPosition;

uniform mat4 cameraCombinedMatrix;

void main() {
    fPosition = gl_Position = cameraCombinedMatrix*vec4(-vPosition, 1.0);
}`;

export const fragmentShader = `
in vec4 fPosition;
layout(location=0) out vec4 color;
layout(binding=0) uniform sampler2D depthMap;
layout(binding=1) uniform sampler2D densityMap;
layout(binding=2) uniform sampler2D positionMap;

const vec3 sunBrightness = vec3(0.8);
const vec3 waveLengths = vec3(572.0, 500.0, 430.0); // g=539.5
const vec3 scatterCoefficents = pow(vec3(400.0)/waveLengths, vec3(4.0))*1.0;

uniform vec3 sunLightDirection;
uniform vec3 planetCenter;
uniform float atmosphereRadius;
uniform float planetRadius;

float lineSphereIntersection(vec3 origin, vec3 direction, vec3 center, float radius, out vec3 intersections[2]) {
    vec3 diagonal = origin-center;
	vec3 parallel = dot(diagonal, direction)*direction;
    vec3 orthogonal = diagonal-parallel;
    float orthogonalDist = length(orthogonal);
    if(orthogonalDist > radius)
        return 0.0;
   	float parallelDist = sin(acos(orthogonalDist/radius))*radius;
    intersections[0] = origin-parallel-direction*parallelDist;
    intersections[1] = origin-parallel+direction*parallelDist;
    return parallelDist*2.0;
}

vec3 lookupRay(vec3 position, vec3 direction) {
	float angle = 0.5-0.5*dot(normalize(position-planetCenter), direction);
    float altitude = distance(planetCenter, position)-planetRadius;
    float normalizedAltitude = altitude/(atmosphereRadius-planetRadius);
    return texture(densityMap, vec2(angle, normalizedAltitude)).xyz;
}

// https://www.khronos.org/opengl/wiki/Compute_eye_space_from_window_space
uniform mat4 cameraProjectionMatrix;
uniform mat4 cameraInverseCombinedMatrix;
uniform mat4 cameraWorldMatrix;
void viewRayReconstruction(vec2 fTexcoord, out vec3 viewRayOrigin, out vec3 viewRayDirection, out vec3 viewRayHit) {
    vec3 ndcPos = vec3(fTexcoord, texture(depthMap, fTexcoord).x)*2.0-vec3(1.0);
	vec4 clipPos = vec4(ndcPos, cameraProjectionMatrix[3][2]/(ndcPos.z-(cameraProjectionMatrix[2][2]/cameraProjectionMatrix[2][3])));
	clipPos.xyz *= clipPos.w;
    viewRayOrigin = cameraWorldMatrix[3].xyz;
    viewRayHit = (cameraInverseCombinedMatrix*clipPos).xyz;
    viewRayDirection = normalize(viewRayHit-viewRayOrigin);
}

void main() {
    vec2 fTexcoord = (fPosition.xy/fPosition.w+vec2(1.0))*0.5;
    color.a = 0.0;

    vec3 viewRayOrigin, viewRayDirection, viewRayHit;
    viewRayReconstruction(fTexcoord, viewRayOrigin, viewRayDirection, viewRayHit);
    /* viewRayOrigin = cameraWorldMatrix[3].xyz;
    viewRayHit = texture(positionMap, fTexcoord).xyz;
    viewRayDirection = normalize(viewRayHit-viewRayOrigin);*/

    vec3 atmosphereIntersections[2];
    float atmosphereParallelDist = lineSphereIntersection(viewRayOrigin, viewRayDirection, planetCenter, atmosphereRadius, atmosphereIntersections)*0.5;
    if(atmosphereParallelDist == 0.0) {
        color.rgb = vec3(0.0);
        return;
    }
    if(dot(viewRayHit-viewRayOrigin, viewRayDirection) > dot(atmosphereIntersections[1]-viewRayOrigin, viewRayDirection))
        viewRayHit = atmosphereIntersections[1];

    float camPlanetCenterDist = distance(viewRayOrigin, planetCenter);
    vec3 atmosphereBegin = (camPlanetCenterDist < atmosphereRadius)
        ? viewRayOrigin
        : atmosphereIntersections[0];
    vec2 atmosphereHitUV = (camPlanetCenterDist < atmosphereRadius)
    	? vec2(0.5+0.5*dot(normalize(viewRayOrigin-planetCenter), viewRayDirection), (camPlanetCenterDist-planetRadius)/(atmosphereRadius-planetRadius))
    	: vec2(0.5-0.5*atmosphereParallelDist/atmosphereRadius, 1.0);

    const int iterations = 5;
    float accumulatedDensity = 0.0;
    float stepSize = distance(atmosphereBegin, viewRayHit)/float(iterations);
    for(int i = 0; i < iterations; ++i) {
    	float t = float(i)/float(iterations-1);
        vec3 position = mix(atmosphereBegin, viewRayHit, t);
        vec3 viewRay = lookupRay(position, viewRayDirection);
        vec3 sunRay = lookupRay(position, sunLightDirection);
        color.rgb += exp(-(viewRay.r+sunRay.r)*scatterCoefficents)*scatterCoefficents*viewRay.g*stepSize*sunBrightness;
        color.a += viewRay.g;
    }
    color.a *= 0.1;
}`;
