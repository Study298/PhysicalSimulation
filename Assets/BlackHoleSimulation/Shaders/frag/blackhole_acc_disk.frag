#version 330 core

uniform vec2 iResolution;
uniform float iTime;
uniform sampler2D iChannel0;

uniform vec3 iCamPos;
uniform vec3 iCamRot;

uniform float uMass;
uniform float uEventHorizon;
uniform float uDiskInner;
uniform float uDiskOuter;
uniform float uDiskScale;
uniform float uDiskDensity;
uniform float uNoiseContrast;
uniform float uStepFactor;
uniform float uMinStep;
uniform float uMaxStep;
uniform int uMaxSteps;
uniform float uExposure;

out vec4 fragColor;

mat3 rotX(float a) {
    float c = cos(a), s = sin(a);
    return mat3(1,0,0, 0,c,-s, 0,s,c);
}

mat3 rotY(float a) {
    float c = cos(a), s = sin(a);
    return mat3(c,0,s, 0,1,0, -s,0,c);
}

mat3 rotZ(float a) {
    float c = cos(a), s = sin(a);
    return mat3(c,-s,0, s,c,0, 0,0,1);
}

// -------------------------------------------------------------
// Camera ray direction (MISSING FROM YOUR CODE - ADDED)
// -------------------------------------------------------------
vec3 cameraRayDir(vec2 uv, vec3 camPos, vec3 camRot) {
    float fov = 45.0;
    float aspect = iResolution.x / iResolution.y;
    
    // Build rotation from camRot
    mat3 R = rotY(camRot.y) * rotX(camRot.x) * rotZ(camRot.z);
    vec3 rd = normalize(R * normalize(vec3(uv.x * aspect * tan(radians(fov*0.5)), uv.y * tan(radians(fov*0.5)), 1.0)));
    return rd;
}

// -------------------------------------------------------------
// Simplex Noise (from your code)
// -------------------------------------------------------------
float simplex(vec3 p) {
    const mat3 G = mat3( 0.0, 1.0, 1.0,
                        -1.0, 0.0, 1.0,
                         1.0, 1.0, 0.0 );

    vec3 i = floor(p + dot(p, vec3(1.0 / 3.0)));
    vec3 x0 = p - i + dot(i, vec3(1.0 / 3.0));
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = x0 - g + (1.0 - g) * vec3(1.0, 0.0, 0.0);
    vec3 x1 = x0 - g + vec3(0.5, 0.5, 0.5);
    return dot(vec3(0.0, 1.0, 1.0), l);
}

// -------------------------------------------------------------
// Gravitational deflection (chromatic lensing) - CORRECTED
// -------------------------------------------------------------
vec3 deflectRayChromatic(vec3 ro, vec3 rd, float mass, vec3 color) {
    float r = length(ro);
    
    // Avoid extreme deflection near center
    if(r < uEventHorizon * 1.5) return rd;
    
    float defMag = mass / (r * r + 0.1);
    vec3 perp = normalize(cross(rd, vec3(0.0, 1.0, 0.0)) + vec3(0.001));
    
    // Apply chromatic lensing: RGB channels bend differently
    vec3 deflected = rd;
    deflected.r += perp.r * defMag * color.r * 0.1;
    deflected.g += perp.g * defMag * color.g * 0.05; 
    deflected.b += perp.b * defMag * color.b * 0.03;
    
    return normalize(deflected);
}

// -------------------------------------------------------------
// Disk Density with Simplex Noise - CORRECTED
// -------------------------------------------------------------
float diskDensity(vec3 p) {
    float r = length(p.xz);
    if (r < uDiskInner || r > uDiskOuter) return 0.0;

    // Height falloff - disk is thin around Y=0
    float h = abs(p.y);
    float heightFactor = exp(-pow(h * 15.0, 1.5));

    // Base density with radial falloff
    float base = uDiskDensity * (1.0 - smoothstep(uDiskInner, uDiskOuter, r));

    // Simplex noise modulation
    vec3 np = p * uDiskScale;
    float n = simplex(np + vec3(0.0, iTime * 0.05, 0.0));
    n = (n - 0.5) * uNoiseContrast;
    float density = max(0.0, base + n) * heightFactor;

    return density;
}

// -------------------------------------------------------------
// Disk Emission Color - CORRECTED
// -------------------------------------------------------------
vec3 diskEmission(vec3 p) {
    float d = diskDensity(p);
    if (d <= 0.0) return vec3(0.0);

    // Color gradient based on radius
    float r = length(p.xz);
    float t = (r - uDiskInner) / (uDiskOuter - uDiskInner);
    vec3 hot = vec3(1.0, 0.9, 0.6);
    vec3 cold = vec3(0.7, 0.2, 0.05);
    vec3 col = mix(hot, cold, t);

    // Noise modulation
    float n = simplex(p * uDiskScale * 2.0);
    col *= 0.7 + 0.6 * n;
    return col * d * 3.0;
}

// -------------------------------------------------------------
// Background sampling
// -------------------------------------------------------------
vec3 backgroundSample(vec3 ro, vec3 rd) {
    vec2 uv = vec2(atan(rd.x, rd.z) / (2.0 * 3.14159265) + 0.5, 
                   asin(rd.y) / 3.14159265 + 0.5);
    return texture(iChannel0, uv).rgb;
}

// -------------------------------------------------------------
// Adaptive Raymarching - CORRECTED
// -------------------------------------------------------------
vec3 trace(vec3 ro, vec3 rd, vec3 color) {
    float t = 0.0;
    vec3 col = vec3(0.0);
    float transmittance = 1.0;

    for (int i = 0; i < 1024; ++i) {
        if (i >= uMaxSteps) break;

        vec3 p = ro + rd * t;
        float r = length(p);

        // Event horizon check
        if (r < uEventHorizon) {
            return col; // Black hole interior
        }

        float dens = diskDensity(p);
        
        if(dens > 0.001) {
            vec3 emit = diskEmission(p);
            
            // Adaptive step size
            float step = clamp(uStepFactor / (dens + 0.1), uMinStep, uMaxStep);
            
            // Absorption and emission
            float absorption = dens * step;
            float transStep = exp(-absorption);
            
            col += emit * absorption * transmittance;
            transmittance *= transStep;
            
            if(transmittance < 0.01) break;
            
            t += step;
        } else {
            // No density, take larger step
            t += uMaxStep;
        }

        // Termination conditions
        if (t > 100.0 || transmittance < 0.001) {
            break;
        }
    }

    // Add background
    if(transmittance > 0.0) {
        vec3 bg = backgroundSample(ro + rd * t, rd);
        col += bg * transmittance;
    }
    
    return col;
}

void main() {
    // Convert to normalized device coordinates
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    // Get camera ray
    vec3 rd = cameraRayDir(uv * 2.0, iCamPos, iCamRot);
    
    // Apply chromatic deflection
    rd = deflectRayChromatic(iCamPos, rd, uMass * 0.02, vec3(1.0, 0.5, 0.3));

    // Trace with chromatic color parameter
    vec3 col = trace(iCamPos, rd, vec3(1.0, 0.5, 0.3));

    // Tone mapping
    col = vec3(1.0) - exp(-col * uExposure);
    col = pow(col, vec3(0.4545)); // gamma 2.2

    fragColor = vec4(col, 1.0);
}