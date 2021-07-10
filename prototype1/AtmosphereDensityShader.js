export const vertexShader = `
layout(location=0) in vec2 vPosition;
out vec2 fTexcoord;

void main() {
    gl_Position = vec4(vPosition, 0.0, 1.0);
    fTexcoord = (vPosition+vec2(1.0))*0.5;
}`;

export const fragmentShader = `
in vec2 fTexcoord;
layout(location=0) out vec2 color;

uniform float atmosphereRadius;
uniform float planetRadius;
uniform float atmosphereDensityFalloff;

float density(float altitude) {
    float normalizedAltitude = altitude/(atmosphereRadius-planetRadius);
	return exp(-normalizedAltitude*atmosphereDensityFalloff)*(1.0-normalizedAltitude);
}

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

void main() {
    float angle = asin(fTexcoord.x*2.0-1.0);
    float centerDist = mix(planetRadius, atmosphereRadius, fTexcoord.y);
    vec3 viewRayOrigin = vec3(0.0, centerDist, 0.0);
    vec3 viewRayDirection = normalize(vec3(cos(angle), sin(angle), 0.0));

    vec3 atmosphereIntersections[2];
    float atmosphereDist = lineSphereIntersection(viewRayOrigin, viewRayDirection, vec3(0.0), atmosphereRadius, atmosphereIntersections);

    const int iterations = 10;
    float accumulatedDensity = 0.0;
    float stepLength = distance(viewRayOrigin, atmosphereIntersections[1])/float(iterations);
    for(int i = 0; i < iterations; ++i) {
    	float t = float(i)/float(iterations-1);
        vec3 position = mix(viewRayOrigin, atmosphereIntersections[1], t);
        float altitude = length(position)-planetRadius;
        accumulatedDensity += density(altitude)*stepLength;
    }

    /*vec3 planetIntersections[2];
    float planetDist = lineSphereIntersection(viewRayOrigin, viewRayDirection, vec3(0.0), planetRadius, planetIntersections);
    if(planetDist > 0.0 && dot(planetIntersections[0]-viewRayOrigin, viewRayDirection) > 0.0)
    	atmosphereIntersections[1] = planetIntersections[0];*/
    color.r = accumulatedDensity;
    color.g = density(centerDist-planetRadius);
    // color.b = distance(viewRayOrigin, atmosphereIntersections[1]);
}`;
