#version 330 core

out vec4 FragColor;

uniform vec2 iResolution;
uniform float iTimeDelta;
uniform int iFrame;
uniform sampler2D iChannel0;
uniform int particle_count;

#define PI 3.14159

vec4 read(ivec2 coord) {
    return texelFetch(iChannel0, coord, 0);
}

vec2 hash22(uvec2 p) {
    p ^= (p.yx << 16);
    p *= 0x7feb352dU;
    p ^= (p >> 15);
    p *= 0x846ca68bU;
    p ^= (p >> 16);
    return vec2(p) * (1.0 / 4294967296.0);
}

vec4 processPoint(vec4 p, float deltaTime) {
    deltaTime = min(deltaTime, 1./60.);
    vec2 gravityCenter = vec2(0.,0.);
    float G = 1.0;
    float mass = 1.0;                

    vec2 r = gravityCenter - p.xy;
    float distSq = dot(r, r);
    float invDist = inversesqrt(distSq);
    vec2 dir = r * invDist;

    vec2 acceleration = dir * (G * mass * invDist * invDist);

    p.zw += acceleration * deltaTime;
    p.xy += p.zw * deltaTime;

    return p;
}

void main() {
    ivec2 coord = ivec2(gl_FragCoord.xy);
    if (coord.x < particle_count && coord.y < particle_count){
        vec4 particleData;
        
        particleData = read(coord);
        particleData = processPoint(particleData, iTimeDelta * 0.1);
        
        if (iFrame < 5) {
            particleData.xy = (hash22(uvec2(coord + 10)) - 0.5) * 0.2 + vec2(0., 0.25);
            particleData.zw = (hash22(uvec2(coord + 20)) - 0.5) * 0.5 + vec2(2., 0.);
        }
        
        FragColor = particleData;
    } else {
        FragColor = vec4(0.0);
    }
}