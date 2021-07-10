int hash(int v) {
    v += v<<10;
    v ^= v>>6;
    v += v<<3;
    v ^= v>>11;
    v += v<<15;
    return v;
}

int hash(ivec2 v) {
    return hash(v.x^hash(v.y));
}

int hash(ivec3 v) {
    return hash(v.x^hash(v.y)^hash(v.z));
}

int hash(ivec4 v) {
    return hash(v.x^hash(v.y)^hash(v.z)^hash(v.w));
}

float unit_interval(int m) {
    m &= 0x007FFFFF;
    m |= 0x3F800000;
    return intBitsToFloat(m)-1.0;
}

float noise(float v) {
    return unit_interval(hash(floatBitsToInt(v)));
}

float noise(vec2 v) {
    return unit_interval(hash(floatBitsToInt(v)));
}

float noise(vec3 v) {
    return unit_interval(hash(floatBitsToInt(v)));
}

float noise(vec4 v) {
    return unit_interval(hash(floatBitsToInt(v)));
}

/*float rand2D(vec2 v) {
    return fract(sin(dot(v, vec2(12.9898,78.233))) * 43758.5453);
}

float rand3D(vec3 v) {
    return fract(sin(dot(v, vec3(12.9898,78.233,144.7272))) * 43758.5453);
}*/
