#version 460

const vec2 quad_vertices[] = vec2[](
    vec2(-1.0, -1.0),
    vec2(1.0, -1.0),
    vec2(-1.0, 1.0),
    vec2(1.0, 1.0)
);

void main() {
    gl_Position = vec4(quad_vertices[gl_VertexIndex], 0.0, 1.0);
}
