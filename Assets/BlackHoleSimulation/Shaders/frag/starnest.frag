#version 330 core
out vec4 FragColor;
in vec2 TexCoords;
uniform vec2 iResolution;
uniform float iTime;

#define iterations 17      // фрактальные итерации  
#define formuparam 0.58    // форма фрактала  
#define volsteps 20        // шаги луча (глубина)  
#define stepsize 0.1       // длина шага луча  
#define zoom 0.85          // масштаб сцены  
#define tile 0.95          // повторение узора  
#define speed 0.0001       // скорость движения  
#define brightness 0.0028  // яркость звёзд  
#define darkmatter 0.6     // тьма/плотность пустот  
#define distfading 0.36    // затухание по расстоянию  
#define saturation 0.85    // насыщенность цвета  


void main()
{
    vec2 uv = gl_FragCoord.xy / iResolution.xy - 0.5;
    uv.y *= iResolution.y / iResolution.x;

    vec3 dir = vec3(uv * zoom, 1.0);
    float time = iTime * speed + 0.25;

    vec3 from = vec3(0.0, 0.0, 0.0);
    from += vec3(time * 2.0, time, -2.0);

    float s = 0.1, fade = 1.0;
    vec3 col = vec3(0.0);

    for (int r = 0; r < volsteps; r++) {
        vec3 p = from + s * dir * 0.5;
        p = abs(vec3(tile) - mod(p, vec3(tile * 2.0)));
        float pa = 0.0, a = 0.0;
        for (int i = 0; i < iterations; i++) {
            p = abs(p) / dot(p, p) - formuparam;
            a += abs(length(p) - pa);
            pa = length(p);
        }
        float dm = max(0.0, darkmatter - a * a * 0.001);
        a *= a * a;
        if (r > 6) fade *= 1.0 - dm;
        col += fade * vec3(s, s * s, s * s * s * s) * a * brightness;
        fade *= distfading;
        s += stepsize;
    }

    col = mix(vec3(length(col)), col, saturation);
    col = pow(col * 1.5, vec3(0.8));

    FragColor = vec4(mix(vec3(0.02, 0.03, 0.06), col, smoothstep(-0.2, 0.8, dir.y)), 1.0);

}
