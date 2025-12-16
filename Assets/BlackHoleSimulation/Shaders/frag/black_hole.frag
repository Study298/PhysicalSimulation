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

// Параметры черной дыры (пока не используются)
uniform float blackHoleMass;    // Масса черной дыры
uniform float gravitationalStrength; // Сила гравитационного линзирования

#define MAX_STEPS 100
#define MAX_DIST 50.0
#define SURF_DIST 0.001

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

// Профиль высоты диска
float calculateHeightProfile(float radius) {
    // Нормализуем радиус между inner и outer
    float t = (radius - diskInnerRadius) / (diskOuterRadius - diskInnerRadius);
    t = clamp(t, 0.0, 1.0);
    
    // Параболический профиль - выше в середине, ниже по краям
    float height = mix(diskEdgeHeight, diskMaxHeight, 4.0 * t * (1.0 - t));
    
    return height;
}

// Функция расстояния до аккреционного диска
float sdAccretionDisk(vec3 p) {
    // Применяем наклон диска
    vec3 axis = vec3(diskTiltDirection.x, 0.0, diskTiltDirection.y);
    vec3 diskSpace = rotateAroundAxis(p, axis, diskTiltAngle);
    
    // Вычисляем радиальное расстояние
    float r = length(diskSpace.xz);
    
    // Проверяем границы диска
    if (r < diskInnerRadius || r > diskOuterRadius) {
        return MAX_DIST;
    }
    
    // Получаем высоту в этой точке
    float height = calculateHeightProfile(r);
    
    // Добавляем турбулентность
    height += diskTurbulence * sin(r * 5.0 + iTime) * 0.1;
    
    // Расстояние до поверхности диска
    return abs(diskSpace.y) - height;
}

// Получаем цвет диска
vec3 getDiskColor(vec3 p) {
    // Применяем наклон для вычисления цвета
    vec3 axis = vec3(diskTiltDirection.x, 0.0, diskTiltDirection.y);
    vec3 diskSpace = rotateAroundAxis(p, axis, diskTiltAngle);
    
    float r = length(diskSpace.xz);
    float t = (r - diskInnerRadius) / (diskOuterRadius - diskInnerRadius);
    t = clamp(t, 0.0, 1.0);
    
    // Градиент от синего к красному
    vec3 color = mix(vec3(0.1, 0.3, 1.0), vec3(1.0, 0.3, 0.1), t);
    
    // Добавляем текстуру
    float texture = sin(r * 8.0 - iTime * 2.0) * 0.3 + 0.7;
    color *= texture;
    
    return color * diskDensity;
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
    
    // Позиция и направление камеры
    vec3 ro = iCamPos;
    vec3 rd = normalize(vec3(uv, 1.0));
    
    // Вращение камеры вокруг сферы
    float angle = iTime * 0.3;
    ro = rotateAroundAxis(ro, vec3(0.0, 1.0, 0.0), angle);
    rd = rotateAroundAxis(rd, vec3(0.0, 1.0, 0.0), angle);
    
    // Ray marching
    float dO = 0.0;
    vec3 color = vec3(0.0);
    bool hit = false;
    
    for(int i = 0; i < MAX_STEPS; i++) {
        vec3 p = ro + rd * dO;
        
        // Расстояния до объектов
        float dBlackHole = sdSphere(p, 1.0); // радиус черной дыры
        float dDisk = sdAccretionDisk(p);
        
        float dScene = min(dBlackHole, dDisk);
        
        if(dScene < SURF_DIST) {
            if(dScene == dBlackHole) {
                color = vec3(0.0);
            } else {
                color = getDiskColor(p);
            }
            hit = true;
            break;
        }
        
        dO += dScene;
        if(dO > MAX_DIST) break;
    }
    
    // Фон
    if(!hit) {
        vec3 backgroundRd = rd;
        vec2 texUV = vec2(
            atan(backgroundRd.z, backgroundRd.x) / (2.0 * 3.1415926535) + 0.5,
            asin(backgroundRd.y) / 3.1415926535 + 0.5
        );
        color = texture2D(iChannel0, texUV).rgb;
    }
    
    gl_FragColor = vec4(color, 1.0);
}