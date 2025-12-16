uniform vec2 iResolution;
uniform float iTime;
uniform sampler2D iChannel0;

uniform vec3 iCamPos;

// Основные параметры диска
uniform float diskInnerRadius;  // Внутренний радиус (от 1.5)
uniform float diskOuterRadius;  // Внешний радиус (до 6.0)
uniform float diskMaxHeight;    // Максимальная высота в средней части
uniform float diskEdgeHeight;   // Высота на краях (внутреннем и внешнем)
uniform float diskTiltAngle;    // Угол наклона диска в радианах
uniform vec2 diskTiltDirection; // Направление наклона (vec2 для оси наклона)

// Параметры формы и плотности
uniform float diskDensity;      // Общая плотность/непрозрачность
uniform float diskWarpFactor;   // Коэффициент искривления (релятивистский эффект)
uniform float diskTurbulence;   // Турбулентность/неоднородность

// Параметры черной дыры
uniform float blackHoleMass;    // Масса черной дыры
uniform float gravitationalStrength; // Сила гравитационного линзирования

#define MAX_STEPS 200
#define MAX_DIST 100.0
#define SURF_DIST 0.001
#define STEP_SIZE 0.05

// Функция расстояния до сферы (черная дыра)
float sdSphere(vec3 p, float r) {
    return length(p) - r;
}

// Вращение вокруг произвольной оси
vec3 rotateAroundAxis(vec3 p, vec3 axis, float angle) {
    axis = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;
    return vec3(
        p.x * (c + axis.x * axis.x * oc) + p.y * (axis.x * axis.y * oc - axis.z * s) + p.z * (axis.x * axis.z * oc + axis.y * s),
        p.x * (axis.y * axis.x * oc + axis.z * s) + p.y * (c + axis.y * axis.y * oc) + p.z * (axis.y * axis.z * oc - axis.x * s),
        p.x * (axis.z * axis.x * oc - axis.y * s) + p.y * (axis.z * axis.y * oc + axis.x * s) + p.z * (c + axis.z * axis.z * oc)
    );
}

// 3D шум для создания неоднородностей в диске
float noise3D(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 423.5))) * 43758.5453);
}

// Улучшенный 3D шум с интерполяцией
float improvedNoise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
    float a = noise3D(i);
    float b = noise3D(i + vec3(1.0, 0.0, 0.0));
    float c = noise3D(i + vec3(0.0, 1.0, 0.0));
    float d = noise3D(i + vec3(1.0, 1.0, 0.0));
    float e = noise3D(i + vec3(0.0, 0.0, 1.0));
    float f2 = noise3D(i + vec3(1.0, 0.0, 1.0));
    float g = noise3D(i + vec3(0.0, 1.0, 1.0));
    float h = noise3D(i + vec3(1.0, 1.0, 1.0));
    
    float bottom = mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    float top = mix(mix(e, f2, f.x), mix(g, h, f.x), f.y);
    return mix(bottom, top, f.z);
}

// Фрактальный шум для более сложной структуры
float fractalNoise3D(vec3 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    for (int i = 0; i < octaves; i++) {
        value += amplitude * improvedNoise3D(p * frequency + iTime * 0.1);
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    
    return value;
}

// Профиль высоты диска
float calculateHeightProfile(float radius) {
    float t = (radius - diskInnerRadius) / (diskOuterRadius - diskInnerRadius);
    t = clamp(t, 0.0, 1.0);
    
    // Параболический профиль - выше в середине, ниже по краям
    float height = mix(diskEdgeHeight, diskMaxHeight, 4.0 * t * (1.0 - t));
    
    return height;
}

// Функция плотности объемного диска
float diskDensityFunction(vec3 p) {
    // Применяем наклон диска
    vec3 axis = vec3(diskTiltDirection.x, 0.0, diskTiltDirection.y);
    vec3 diskSpace = rotateAroundAxis(p, axis, diskTiltAngle);
    
    // Вычисляем радиальное расстояние
    float r = length(diskSpace.xz);
    
    // Проверяем границы диска
    if (r < diskInnerRadius || r > diskOuterRadius) {
        return 0.0;
    }
    
    // Получаем высоту в этой точке
    float height = calculateHeightProfile(r);
    
    // Вычисляем расстояние до центральной плоскости диска
    float distToPlane = abs(diskSpace.y);
    
    // Плотность уменьшается с расстоянием от центральной плоскости
    float verticalDensity = 1.0 - smoothstep(0.0, height, distToPlane);
    
    // Радиальная плотность - выше в средней части
    float radialT = (r - diskInnerRadius) / (diskOuterRadius - diskInnerRadius);
    float radialDensity = 4.0 * radialT * (1.0 - radialT); // Параболический профиль
    
    // Добавляем 3D турбулентность
    vec3 noisePos = diskSpace * 4.0 + vec3(iTime * 0.5);
    float turbulence = fractalNoise3D(noisePos, 3) * diskTurbulence;
    
    // Общая плотность
    float density = verticalDensity * radialDensity * (0.8 + 0.4 * turbulence);
    
    return max(0.0, density);
}

// Получаем цвет точки в объемном диске
vec3 getDiskVolumeColor(vec3 p, float density) {
    // Белый цвет как требовалось
    vec3 baseColor = vec3(1.0);
    
    // Добавляем небольшую вариацию яркости на основе шума
    vec3 noisePos = p * 3.0 + vec3(iTime * 0.3);
    float brightness = 0.8 + 0.4 * improvedNoise3D(noisePos);
    
    return baseColor * brightness * density * diskDensity;
}

// ИСПРАВЛЕНО: убрано применение шума к фоновой текстуре
vec3 getBackgroundColor(vec3 rd) {
    vec2 texUV = vec2(
        atan(rd.z, rd.x) / (2.0 * 3.1415926535) + 0.5,
        asin(rd.y) / 3.1415926535 + 0.5
    );
    
    // Возвращаем цвет текстуры без модификаций
    return texture2D(iChannel0, texUV).rgb;
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
    
    // Позиция и направление камеры
    vec3 ro = iCamPos;
    vec3 rd = normalize(vec3(uv, 1.0));
    
    // Вращение камеры вокруг сферы
    float angle = iTime * 0.1;
    ro = rotateAroundAxis(ro, vec3(0.0, 1.0, 0.0), angle);
    rd = rotateAroundAxis(rd, vec3(0.0, 1.0, 0.0), angle);
    
    // Ray marching с накоплением объема
    float t = 0.0;
    vec3 finalColor = vec3(0.0);
    float transmittance = 1.0; // Начальная прозрачность
    
    // Сначала проверяем пересечение с черной дырой
    bool hitBlackHole = false;
    float blackHoleT = MAX_DIST;
    
    for(int i = 0; i < MAX_STEPS; i++) {
        vec3 p = ro + rd * t;
        
        // Расстояние до черной дыры
        float dBlackHole = sdSphere(p, blackHoleMass);
        
        // Если попали в черную дыру - запоминаем позицию и выходим
        if(dBlackHole < SURF_DIST) {
            hitBlackHole = true;
            blackHoleT = t;
            break;
        }
        
        t += STEP_SIZE;
        if(t > MAX_DIST) break;
    }
    
    // Теперь рендерим объемный диск до черной дыры
    t = 0.0;
    transmittance = 1.0;
    vec3 diskColor = vec3(0.0);
    
    for(int i = 0; i < MAX_STEPS; i++) {
        // Останавливаемся перед черной дырой
        if(t >= blackHoleT - STEP_SIZE) break;
        
        vec3 p = ro + rd * t;
        
        // Получаем плотность диска в текущей точке
        float density = diskDensityFunction(p);
        
        if(density > 0.0) {
            // Получаем цвет в этой точке объема
            vec3 pointColor = getDiskVolumeColor(p, density);
            
            // Коэффициент поглощения/рассеяния
            float absorption = density * STEP_SIZE * diskDensity;
            
            // Накопление цвета (approximation of volume rendering)
            diskColor += pointColor * absorption * transmittance;
            
            // Уменьшаем прозрачность (поглощение)
            transmittance *= exp(-absorption);
        }
        
        // Проверяем, стоит ли продолжать (если прозрачность очень мала)
        if(transmittance < 0.01) {
            break;
        }
        
        t += STEP_SIZE;
        if(t > MAX_DIST) break;
    }
    
    // Комбинируем все элементы
    if(hitBlackHole) {
        // Если есть черная дыра, показываем ее (черный цвет)
        // и добавляем цвет диска поверх
        finalColor = diskColor;
    } else {
        // Если черной дыры нет, показываем фон сквозь диск
        vec3 backgroundColor = getBackgroundColor(rd);
        finalColor = mix(backgroundColor, diskColor, 1.0 - transmittance);
    }
    
    // Тоновая коррекция
    finalColor = pow(finalColor, vec3(0.8)); // Гамма-коррекция
    
    gl_FragColor = vec4(finalColor, 1.0);
}