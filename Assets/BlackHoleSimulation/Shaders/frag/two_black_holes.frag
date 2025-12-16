#version 330 core
out vec4 fragColor;
uniform vec2 iResolution;
uniform float iTime;
uniform vec3 iCamPos;
uniform vec3 iCamRotation;

uniform vec3 uBlackHole1Pos;
uniform float uBlackHole1Mass;
uniform vec3 uBlackHole2Pos;
uniform float uBlackHole2Mass;

uniform float uDiskRadius;
uniform float uDiskRotationSpeed;
uniform float uDiskLayers;
uniform float uDiskSize;
uniform float uFade = 1.0;

uniform sampler2D iChannel0;


float hash(vec3 p) 
{
    p = fract(p * 0.3183099 + vec3(0.1));
    p *= 17.0;
    float result = p.x * p.y * p.z * (p.x + p.y + p.z);
    return fract(result);
}

float noise(vec3 x) 
{
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (vec3(3.0) - 2.0 * f);

    float h000 = hash(i + vec3(0, 0, 0));
    float h100 = hash(i + vec3(1, 0, 0));
    float h010 = hash(i + vec3(0, 1, 0));
    float h110 = hash(i + vec3(1, 1, 0));
    float h001 = hash(i + vec3(0, 0, 1));
    float h101 = hash(i + vec3(1, 0, 1));
    float h011 = hash(i + vec3(0, 1, 1));
    float h111 = hash(i + vec3(1, 1, 1));

    float x00 = mix(h000, h100, f.x);
    float x10 = mix(h010, h110, f.x);
    float x01 = mix(h001, h101, f.x);
    float x11 = mix(h011, h111, f.x);

    float y0 = mix(x00, x10, f.y);
    float y1 = mix(x01, x11, f.y);

    return mix(y0, y1, f.z);
}

float hash(float x) { return fract(sin(x)*152754.742); }
float hash(vec2 x) { return hash(x.x + hash(x.y)); }

float value(vec2 p, float f)
{
    float bl = hash(floor(p.x*f) + floor(p.y*f));
    float br = hash(floor(p.x*f + 1.0) + floor(p.y*f));
    float tl = hash(floor(p.x*f) + floor(p.y*f + 1.0));
    float tr = hash(floor(p.x*f + 1.0) + floor(p.y*f + 1.0));
    
    vec2 fr = fract(p*f);    
    fr = (3.0 - 2.0*fr)*fr*fr;	
    float b = mix(bl, br, fr.x);	
    float t = mix(tl, tr, fr.x);
    return mix(b,t, fr.y);
}

vec2 rotateVector(vec2 v, float angle) 
{
    float s = sin(angle);
    float c = cos(angle);
    return vec2(
        v.x * c - v.y * s,
        v.x * s + v.y * c
    );
}

float sphere(vec4 s) 
{
    return length(s.xyz) - s.w;
}

vec4 getGlow(float minPDist) 
{
    float mainGlow = minPDist * 1.2;
    mainGlow = pow(mainGlow, 32.0);
    mainGlow = clamp(mainGlow, 0.0, 1.0);

    float outerGlow = minPDist * 0.4;
    outerGlow = pow(outerGlow, 2.0);
    outerGlow = clamp(outerGlow, 0.0, 1.0);

    vec4 glow = vec4(10, 5, 3, mainGlow);
    glow += vec4(0, 0, 0, outerGlow);
    glow.w = min(glow.w, 1.0);

    return glow;
}

vec4 raymarchDisk(vec3 ray, vec3 zeroPos, vec3 holePos, float mass)
{
    vec3 position = zeroPos - holePos;
    
    float diskSize = uDiskSize * mass;
    float lengthPos = length(position.xz);
    float dist = min(1.0, lengthPos*(1.0/diskSize)*0.5) * diskSize * 0.4 * (1.0/uDiskLayers) / max(abs(ray.y), 0.001);

    position += dist * uDiskLayers * ray * 0.5;

    vec2 deltaPos;
    deltaPos.x = -position.z * 0.01 + position.x;
    deltaPos.y = position.x * 0.01 + position.z;
    deltaPos = normalize(deltaPos - position.xz);
    
    float parallel = dot(ray.xz, deltaPos);
    parallel /= max(sqrt(lengthPos), 0.001);
    parallel *= 0.5;
    float redShift = parallel + 0.3;
    redShift *= redShift;
    redShift = clamp(redShift, 0.0, 1.0);
    
    float disMix = clamp((lengthPos - diskSize * 2.0) * (1.0/diskSize) * 0.24, 0.0, 1.0);
    vec3 insideCol = mix(vec3(1.0, 0.8, 0.0), vec3(0.5, 0.13, 0.02) * 0.2, disMix);
    
    insideCol *= mix(vec3(0.4, 0.2, 0.1), vec3(1.6, 2.4, 4.0), redShift);
    insideCol *= 1.25;
    redShift += 0.12;
    redShift *= redShift;

    vec4 o = vec4(0.0);

    for(float i = 0.0; i < uDiskLayers; i++)
    {                      
        position -= dist * ray;

        float intensity = clamp(1.0 - abs((i - 0.8) * (1.0/uDiskLayers) * 2.0), 0.0, 1.0);
        float currentLengthPos = length(position.xz);
        float distMult = 1.0;

        distMult *= clamp((currentLengthPos - diskSize * 0.75) * (1.0/diskSize) * 1.5, 0.0, 1.0);
        distMult *= clamp((diskSize * 10.0 - currentLengthPos) * (1.0/diskSize) * 0.20, 0.0, 1.0);
        distMult *= distMult;

        float u = currentLengthPos + iTime * diskSize * 0.3 + intensity * diskSize * 0.2;

        vec2 xy;
        float rot = mod(iTime * uDiskRotationSpeed, 8192.0);
        xy.x = -position.z * sin(rot) + position.x * cos(rot);
        xy.y = position.x * sin(rot) + position.z * cos(rot);

        float x = abs(xy.x / max(xy.y, 0.001));
        float angle = 0.02 * atan(x);
 
        float f = 70.0;
        float n = value(vec2(angle, u * (1.0/diskSize) * 0.05), f);
        n = n * 0.66 + 0.33 * value(vec2(angle, u * (1.0/diskSize) * 0.05), f * 2.0);

        float extraWidth = n * 1.0 * (1.0 - clamp(i * (1.0/uDiskLayers) * 2.0 - 1.0, 0.0, 1.0));

        float alpha = clamp(n * (intensity + extraWidth) * ((1.0/diskSize) * 10.0 + 0.01) * dist * distMult, 0.0, 1.0);

        vec3 col = 2.0 * mix(vec3(0.3, 0.2, 0.15) * insideCol, insideCol, min(1.0, intensity * 2.0));
        o = clamp(vec4(col * alpha + o.rgb * (1.0 - alpha), o.a * (1.0 - alpha) + alpha), vec4(0.0), vec4(1.0));

        currentLengthPos *= (1.0/diskSize);
        o.rgb += redShift * (intensity * 1.0 + 0.5) * (1.0/uDiskLayers) * 100.0 * distMult / max(currentLengthPos * currentLengthPos, 0.001);
    }  
 
    o.rgb = clamp(o.rgb - 0.005, 0.0, 1.0);
    return o;
}

float blackHoleDist(vec3 p, vec3 holePos, float mass) {
    return length(p - holePos) - 1.5 * mass;
}

vec3 getGravity(vec3 p) {
    vec3 g = vec3(0.0);
    
    vec3 dir1 = uBlackHole1Pos - p;
    float dist1 = length(dir1);
    if (dist1 > 0.0) {
        g += uBlackHole1Mass * normalize(dir1) / (dist1 * dist1);
    }
    
    vec3 dir2 = uBlackHole2Pos - p;
    float dist2 = length(dir2);
    if (dist2 > 0.0) {
        g += uBlackHole2Mass * normalize(dir2) / (dist2 * dist2);
    }
    
    return g * 20.0;
}

float getDist(vec3 p) {
    float dist1 = blackHoleDist(p, uBlackHole1Pos, uBlackHole1Mass);
    float dist2 = blackHoleDist(p, uBlackHole2Pos, uBlackHole2Mass);
    
    return min(dist1, dist2);
}


vec4 background(vec3 ray)
{
    vec2 uv = 0.5 + 0.5 * vec2(atan(ray.z, ray.x) / 3.1415926, asin(ray.y) / 1.5707963);
    
    // получаем фон из iChannel0 (StarNest)
    vec4 stars = texture(iChannel0, uv);

    stars.rgb = pow(stars.rgb, vec3(1.5));  // усилить тЄмные
    stars.rgb *= 0.7;                        // приглушить €ркость
    
    // осветл€ет центр, чтобы не было чЄрного провала
    float vignette = 1.0 - 0.5 * length(uv - 0.5);
    vignette = clamp(vignette, 0.0, 1.0);
    
    stars.rgb *= vignette;
    
    return stars;
}


vec4 raymarch(vec3 ro, vec3 rd, float time) {
    vec3 p = ro;
    float glow = 0.0;
    vec3 prevP = p;

    for (int i = 0; i < 1000; i++) {
        float dS = getDist(p);
        glow = max(glow, 1.0 / (dS + 1.0));

        vec3 g = getGravity(p);
        float gStrength = length(g);
        
        if (gStrength > 0.0) {
            vec3 gDir = normalize(g);
            
            float avgMass = (uBlackHole1Mass + uBlackHole2Mass) * 0.5;
            float lensingStrength = min(gStrength * 0.1 * (0.5 + avgMass * 0.1), 1.0);
            
            rd = mix(rd, gDir, lensingStrength);
        }

        if (dS > 1000.0) break;

        for (int j = 0; j < 2; j++) {
            vec3 holePos = (j == 0) ? uBlackHole1Pos : uBlackHole2Pos;
            float mass = (j == 0) ? uBlackHole1Mass : uBlackHole2Mass;
            
            vec3 relPrev = prevP - holePos;
            vec3 relCur = p - holePos;
            
            if (sign(relPrev.y) != sign(relCur.y)) {
                float t = abs(relPrev.y) / (abs(relPrev.y) + abs(relCur.y));
                vec3 intP = mix(prevP, p, t);
                vec3 relIntP = intP - holePos;
                float r = length(relIntP.xz);
                
                if (r >= 1.5 * mass && r <= uDiskRadius * mass) {
                    vec4 diskColor = raymarchDisk(rd, intP, holePos, mass);
                    if (diskColor.a > 0.01) {
                        return diskColor;
                    }
                }
            }
        }

        if (length(p - uBlackHole1Pos) < 1.5 * uBlackHole1Mass || 
            length(p - uBlackHole2Pos) < 1.5 * uBlackHole2Mass) {
            return vec4(0.0);
        }

        prevP = p;
        p += rd * max(dS, 0.01);
    }

    vec4 bg = background(rd);
    vec4 gcol = getGlow(glow);
    return vec4(mix(bg.rgb, gcol.rgb, gcol.w), 1.0);
}

void main() {
    vec2 fragCoord = gl_FragCoord.xy;
    vec2 uv = (fragCoord - 0.5 * iResolution) / iResolution.y;
    
    vec3 ro = iCamPos;
    
    vec3 rd = normalize(vec3(uv, 1));

    vec2 rotatedYZ = rotateVector(vec2(rd.y, rd.z), iCamRotation.x);
    rd.y = rotatedYZ.x;
    rd.z = rotatedYZ.y;
    
    vec2 rotatedXZ = rotateVector(vec2(rd.x, rd.z), iCamRotation.y);
    rd.x = rotatedXZ.x;
    rd.z = rotatedXZ.y;
    
    vec2 rotatedXY = rotateVector(vec2(rd.x, rd.y), iCamRotation.z);
    rd.x = rotatedXY.x;
    rd.y = rotatedXY.y;

    vec4 c = raymarch(ro, rd, iTime);
    
    fragColor = vec4(c.rgb * uFade, 1.0);
}