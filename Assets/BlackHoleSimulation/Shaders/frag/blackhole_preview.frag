#version 330 core

out vec4 FragColor;

uniform vec2 iResolution;
uniform float iTime;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;

uniform int particle_count;
uniform vec3 c1;
uniform vec3 c2;
uniform vec3 c3;
uniform int doBloom;

#define PI 3.14159
#define R iResolution.xy

vec4 read(ivec2 coord) {
    return texelFetch(iChannel1, coord, 0);
}

float circ(vec3 uv, vec3 p, float s, float f) {
    return smoothstep(s + f * 0.5, s, length(uv - p));
}

vec3 get_col(vec2 id) {
    float w1 = id.x / float(particle_count);
    float w2 = id.y / float(particle_count);
    vec3 col = mix(c1, c2, w1);
    col = mix(col, c3, w2);
    return col;
}

vec2 warpCoords(vec2 uv, float fact) {
    return uv / (1.0 + fact * (1.0 - uv.y));
}


vec3 applyBloom(vec3 color, vec2 uv) {
    if (doBloom == 0) return color;

    vec3 bloom = vec3(0.0);
    float bloomIntensity = 0.1;
    int samples = 4;

    for (int x = -samples; x <= samples; x++) {
        for (int y = -samples; y <= samples; y++) {
            vec2 offset = vec2(x, y) / iResolution.xy * 2.0;
            bloom += texture(iChannel0, uv + offset).rgb;
        }
    }

    bloom /= float((2 * samples + 1) * (2 * samples + 1));
    return mix(color, bloom, bloomIntensity);
}

void main() {
    vec2 fragCoord = gl_FragCoord.xy;
    vec2 uv = fragCoord / iResolution.y;


    vec3 col = texture(iChannel0, fragCoord / iResolution.xy).rgb * 0.99;


    uv -= R / R.y * 0.5;
    uv.y *= 3.0;
    uv.y -= 0.51;
    uv = warpCoords(uv, 2.0) * 3.0;


    for (int x = 0; x < particle_count; x++) {
        for (int y = 0; y < particle_count; y++) {
            vec2 p = read(ivec2(x, y)).xy;
            float z = p.y * 0.2;

            float focus = 0.01 + abs(z) * 2.25;
            float size = 0.01;
            float offset = z * 0.14;

            vec2 puv = uv / (1.1 - z);

            vec3 w = vec3(
                circ(vec3(puv + offset, 0.0), vec3(p, z), size, focus),
                circ(vec3(puv, 0.0), vec3(p, z), size, focus),
                circ(vec3(puv - offset, 0.0), vec3(p, z), size, focus)
            );

            vec3 add_col = get_col(vec2(x, y));
            add_col = clamp(add_col, 0.0, 1.0);
            col = mix(col, add_col, w);
        }
    }

    col = applyBloom(col, fragCoord / iResolution.xy);

    FragColor = vec4(col, 1.0);
}
