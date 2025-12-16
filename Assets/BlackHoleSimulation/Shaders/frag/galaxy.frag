#version 330 core

out vec4 FragColor;

in vec2 uv;

uniform float iTime;
uniform vec2 iResolution;


float hash(float n) {
    return fract(cos(n) * 41415.92653);
}

float noise(vec2 x) {
    vec2 p = floor(x);
    vec2 f = smoothstep(0.0, 1.0, fract(x));
    float n = p.x + p.y * 57.0;
    return mix(mix(hash(n + 0.0), hash(n + 1.0), f.x),
               mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y);
}

float noise(vec3 x) {
    vec3 p = floor(x);
    vec3 f = smoothstep(0.0, 1.0, fract(x));
    float n = p.x + p.y * 57.0 + 113.0 * p.z;
    return mix(mix(mix(hash(n + 0.0), hash(n + 1.0), f.x),
                   mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y),
               mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
                   mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y), f.z);
}

mat3 m = mat3(
    0.00,  1.60,  1.20,
   -1.60,  0.72, -0.96,
   -1.20, -0.96,  1.28
);

float fbmslow(vec3 p) {
    float f = 0.5 * noise(p); p = m * p * 1.2;
    f += 0.25 * noise(p); p = m * p * 1.3;
    f += 0.1666 * noise(p); p = m * p * 1.4;
    f += 0.0834 * noise(p); p = m * p * 1.84;
    return f;
}

float fbm(vec3 p) {
    float f = 0.0;
    float a = 1.0;
    float s = 0.0;
    f += a * noise(p); p = m * p * 1.149; s += a; a *= .75;
    f += a * noise(p); p = m * p * 1.41;  s += a; a *= .75;
    f += a * noise(p); p = m * p * 1.51;  s += a; a *= .65;
    f += a * noise(p); p = m * p * 1.21;  s += a; a *= .35;
    f += a * noise(p); p = m * p * 1.41;  s += a; a *= .75;
    f += a * noise(p);
    return f / s;
}

void main() {
    vec2 fragCoord = gl_FragCoord.xy;
    float time = iTime * 0.1;
    vec2 xy = -1.0 + 2.0 * fragCoord.xy / iResolution.xy;

    float fade = min(1., time * 1.) * min(1., max(0., 15. - time));
    float fade2 = max(0., time - 10.) * 0.37;
    float glow = max(-.25, 1. + pow(fade2, 10.) - 0.001 * pow(fade2, 25.));

    vec3 campos = vec3(500.0, 850.0, -cos((time - 1.4) / 2.0) * 2000.0);
    vec3 camtar = vec3(0.0, 0.0, 0.0);

    float roll = 0.34;
    vec3 cw = normalize(camtar - campos);
    vec3 cp = vec3(sin(roll), cos(roll), 0.0);
    vec3 cu = normalize(cross(cw, cp));
    vec3 cv = normalize(cross(cu, cw));
    vec3 rd = normalize(xy.x * cu + xy.y * cv + 1.6 * cw);

    vec3 light = normalize(-campos);
    float sundot = clamp(dot(light, rd), 0.0, 1.0);

    vec3 col = glow * 1.2 * min(vec3(1.0), vec3(2.0, 1.0, 0.5) * pow(sundot, 100.0));
    col += 0.3 * vec3(0.8, 0.9, 1.2) * pow(sundot, 8.0);

    vec3 stars = 85.5 * pow(fbmslow(rd.xyz * 312.0), 7.0) *
                 pow(fbmslow(rd.zxy * 440.3), 8.0) * vec3(1.0);

    vec3 cpos = 1500.0 * rd + vec3(831.0 - time * 30.0, 321.0, 1000.0);
    col += vec3(0.4, 0.5, 1.0) * (fbmslow(cpos * 0.0035) - 0.5);

    cpos += vec3(831.0 - time * 33.0, 321.0, 999.0);
    col += vec3(0.6, 0.3, 0.6) * 10.0 * pow(fbmslow(cpos * 0.0045), 10.0);

    cpos += vec3(3831.0 - time * 39.0, 221.0, 999.0);
    col += 0.03 * vec3(0.6, 0.0, 0.0) * 10.0 * pow(fbmslow(cpos * 0.0145), 2.0);

    cpos = 1500.0 * rd + vec3(831.0, 321.0, 999.0);
    col += stars * fbm(cpos * 0.0021);

    vec2 xy2 = fragCoord.xy / iResolution.xy;
    col *= vec3(0.5) + 0.25 * pow(100.0 * xy2.x * xy2.y * (1.0 - xy2.x) * (1.0 - xy2.y), 0.5);

    FragColor = vec4(col, 1.0);
}

