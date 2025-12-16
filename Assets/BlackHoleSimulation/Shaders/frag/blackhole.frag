// Star Nest by Pablo Roman Andrioli
// License: MIT

#version 460 core

out vec4 FragColor;
in vec2 TexCoords;

uniform float iTime;
uniform vec2 iResolution;
uniform sampler2D iChannel0;
uniform int doBloom;

const int steps = 90;
const int starAA = 8;
const float holeRadius = 0.1;
const float detail = 3.0;
const float density = 3.0;
const float stepVa = 20.0;
const float bounds = 500.0;
const float vol = 8.0;
const float volDen = 0.7;

vec3 camPos = vec3(0.0, 220.0, 0.0);
const vec3 holePos = vec3(0.0, 0.0, 0.0);

uint lowbias32(uint x) {
    x ^= x >> 16;
    x *= 0x7feb352dU;
    x ^= x >> 15;
    x *= 0x846ca68bU;
    x ^= x >> 16;
    return x;
}

#define hash(x) (float(lowbias32(x)) / float(0xffffffffU))

float rand(vec3 position) {
    uvec3 V = uvec3(position);
    float h = hash(V.x + (V.y<<16) + (V.z<<8));
    return h;
}

float interpolate(vec3 position) {
    vec3 quantPos = round((position + 0.5));
    vec3 divPos = fract(1.0 * position);

    vec4 lerpXY = vec4(
        rand(quantPos + vec3(0.0, 0.0, 0.0)),
        rand(quantPos + vec3(1.0, 0.0, 0.0)),
        rand(quantPos + vec3(1.0, 1.0, 0.0)),
        rand(quantPos + vec3(0.0, 1.0, 0.0))
    );

    vec4 lerpXYZ = vec4(
        rand(quantPos + vec3(0.0, 0.0, 1.0)),
        rand(quantPos + vec3(1.0, 0.0, 1.0)),
        rand(quantPos + vec3(1.0, 1.0, 1.0)),
        rand(quantPos + vec3(0.0, 1.0, 1.0))
    );

    vec4 weights = vec4(
        abs((1.0 - divPos.x) * (1.0 - divPos.y)),
        abs((0.0 - divPos.x) * (1.0 - divPos.y)),
        abs((0.0 - divPos.x) * (0.0 - divPos.y)),
        abs((1.0 - divPos.x) * (0.0 - divPos.y))
    );

    vec4 lerpFinal = mix(lerpXY, lerpXYZ, divPos.z);
    return dot(weights, lerpFinal);
}

float octave(vec3 coord, float octaves, float div) {
    float col = 0.0;
    float it = 1.0;
    float cnt = 1.0;
    for (float i = 1.0; i <= octaves; i++) {
        col += interpolate(it * coord / div) / it;
        it *= 1.9;
        cnt += 1.0 / it;
    }
    return pow(col / cnt, 1.0);
}

vec2 distField(vec3 position, vec3 origin) {
    float radius = 45.0;
    float dist = distance(origin, position);
    float distXY = max(distance(origin.xy, position.xy) - holeRadius, 0.0);
    float fieldZ = max(0.0, pow(distance(origin.z, position.z), 2.5));

    float angle = atan((position.x - origin.x) / (position.y - origin.y));
    if (position.y <= origin.y) angle += 3.1415;
    angle += 0.05 * iTime;

    float cloud = pow(clamp(radius / (dist - holeRadius), 0.0, 1.0), 2.5);
    float spiral = octave(vec3(dist, 50.0 * (1.0 + sin(angle)), 1.0 * distance(origin.z + 3.0 * iTime, position.z)), detail, density);
    float finalDF = cloud * clamp(spiral / (fieldZ + 0.001), 0.0, 1.0);
    return vec2(finalDF, max((volDen - spiral) / (dist * distance(position.z, origin.z) / 500.0), 0.0));
}

vec3 rayCast(vec2 rayAxis)
{
    // Настройки камеры
    float orbitRadius = 220.0;
    float orbitSpeed = 0.15;
    float height = 30.0;

    // Плавное вращение камеры вокруг дыры
    float angle = iTime * orbitSpeed;
    vec3 camPos = vec3(sin(angle) * orbitRadius, height, cos(angle) * orbitRadius);
    vec3 target = holePos;
    vec3 forward = normalize(target - camPos);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
    vec3 up = normalize(cross(forward, right));

    // Создаём локальный луч (в экранных координатах)
    vec3 rayDir = normalize(forward + rayAxis.x * right + rayAxis.y * up);

    float gravDis = 2392.3 * pow(1.0973, holeRadius);
    vec3 rayPos = camPos;
    float rayVol = 0.0;
    float occ = 1.0;

    for (int i = 0; i <= steps; i++)
    {
        float rayDist = max(distance(rayPos, holePos) - 10.0, 0.001);
        float boDist = pow(rayDist / 500.0, 2.0);
        float stepSize = min(clamp(rayDist - (holeRadius + stepVa), 0.05, stepVa),
                             max(boDist + distance(holePos.z, rayPos.z), 0.2));

        // Гравитационное искривление
        vec3 rayDefl = normalize(holePos - rayPos);
        rayDir += gravDis * pow(stepSize, 2.4) * rayDefl / pow(rayDist, 4.0);
        rayDir = normalize(rayDir) * stepSize;

        rayPos += rayDir;

        // Расчёт поля и яркости
        vec2 dField = distField(rayPos, holePos);
        occ += dField.y;
        rayVol += (dField.x * vol * stepSize) / occ;

        // Стоп, если попали в горизонт событий
        if (rayDist <= holeRadius) break;
    }

    return vec3(rayVol);
}


void main() {
    vec2 uv = gl_FragCoord.xy / iResolution.xy * 2.0 - 1.0;
    vec3 col = rayCast(uv);

    if (doBloom == 1)
    {
        col += pow(col, vec3(3.0)) * 0.2;
    }
    //FragColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0); // гамма-коррекция
    FragColor = vec4(col, 1.0);
}
