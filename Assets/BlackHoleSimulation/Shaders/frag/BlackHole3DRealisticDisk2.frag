#version 330 core
out vec4 FragColor;

in vec2 TexCoord;

// Uniforms from Config2
uniform vec3 u_cameraPos;
uniform vec2 u_resolution;
uniform float u_time;

// Black hole parameters
uniform float u_bhMass;
uniform float u_accretionRate;
uniform float u_spin;
uniform vec3 u_lightDir;

// Disk parameters
uniform float u_innerRadius;
uniform float u_outerRadius;
uniform float u_thicknessBase;
uniform float u_thicknessExp;
uniform float u_turbulenceAmp;
uniform float u_tempFluctAmp;
uniform float u_hotspotAmp;
uniform float u_hotspotSize;
uniform float u_exposure;

// New Config2 parameters
uniform float u_frameDragging;
uniform float u_diskTwist;
uniform float u_jetIntensity;
uniform float u_magneticField;
uniform float u_emissionLineStrength;
uniform float u_timeScale;

// Constants
const float PI = 3.141592653589793;
const float G = 6.67430e-11;
const float c = 299792458.0;
const float SOLAR_MASS = 1.989e30;
const float RS = 2.0 * G * SOLAR_MASS / (c * c); // Schwarzschild radius for 1 solar mass

// Noise functions (simplified for brevity)
float hash(float n) { return fract(sin(n) * 1e4); }
float noise(vec3 x) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    float n = p.x + p.y * 157.0 + 113.0 * p.z;
    return mix(mix(mix(hash(n), hash(n + 1.0), f.x),
                   mix(hash(n + 157.0), hash(n + 158.0), f.x), f.y),
               mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
                   mix(hash(n + 270.0), hash(n + 271.0), f.x), f.y), f.z);
}

// Frame dragging effect (Lense-Thirring precession)
vec3 applyFrameDragging(vec3 pos, float r) {
    if (r < u_innerRadius * 2.0) return pos;
    
    float a = u_spin;
    float omega = 2.0 * a / (r * r * r + a * a * r + 2.0 * a * a);
    float phi = atan(pos.y, pos.x);
    
    // Apply twisting based on radius
    float twistFactor = u_diskTwist * exp(-r / (u_outerRadius * 0.3));
    phi += u_time * omega * twistFactor * u_frameDragging;
    
    float dist = length(pos.xy);
    return vec3(cos(phi) * dist, sin(phi) * dist, pos.z);
}

// Magnetic field effects
float magneticPressure(float r, float phi) {
    float base = 1.0 / (r * r);
    
    // Add time-varying magnetic loops
    vec3 noiseCoord = vec3(r * 0.1, phi, u_time * 0.5);
    float magneticNoise = noise(noiseCoord);
    
    return base * (1.0 + u_magneticField * 0.3 * magneticNoise);
}

// Relativistic jet emission
vec3 jetEmission(vec3 rayDir) {
    if (u_jetIntensity <= 0.0) return vec3(0.0);
    
    // Jet along spin axis (z-axis)
    float jetAngle = acos(abs(rayDir.z));
    float jetCore = exp(-jetAngle * 30.0);
    float jetSheath = exp(-jetAngle * 10.0);
    
    // Time-varying jet
    float jetPulse = 0.5 + 0.5 * sin(u_time * 2.0);
    
    vec3 jetColor = mix(vec3(0.3, 0.5, 1.0), vec3(1.0, 0.8, 0.3), jetPulse);
    
    return jetColor * u_jetIntensity * (jetCore + 0.3 * jetSheath);
}

// Enhanced temperature distribution with magnetic heating
float diskTemperature(float r, float phi, float z) {
    if (r < u_innerRadius || r > u_outerRadius) return 0.0;
    
    // Base Shakura-Sunyaev temperature
    float T0 = 6.23e7;
    float T_base = T0 * pow(u_accretionRate, 0.25) * pow(u_bhMass, 0.25) *
                   pow(r, -0.75) * pow(1.0 - sqrt(u_innerRadius / r), 0.25);
    
    // Magnetic heating
    float magneticHeat = magneticPressure(r, phi) * 2e6 * u_magneticField;
    T_base += magneticHeat;
    
    // Temperature fluctuations
    vec3 noiseCoord = vec3(r * 0.05, phi * 3.0, u_time * 0.2);
    float tempNoise = noise(noiseCoord);
    T_base *= (1.0 + u_tempFluctAmp * tempNoise);
    
    // Hot spots with magnetic reconnection
    float hotspot = 0.0;
    for (int i = 0; i < 4; i++) {
        float hotspotPhi = float(i) * PI / 2.0 + u_time * 0.3;
        float hotspotR = u_innerRadius * 2.0 + float(i) * 3.0;
        
        float dPhi = mod(abs(phi - hotspotPhi), 2.0 * PI);
        dPhi = min(dPhi, 2.0 * PI - dPhi);
        
        float distance2 = pow((r - hotspotR) / u_hotspotSize, 2.0) +
                         pow(dPhi * r / (u_hotspotSize * 0.5), 2.0);
        
        hotspot += u_hotspotAmp * exp(-distance2) * (1.0 + sin(u_time * 2.0 + float(i)));
    }
    
    return T_base * (1.0 + hotspot);
}

// Enhanced color with emission lines
vec3 temperatureToColor(float T) {
    T = clamp(T, 3000.0, 100000.0);
    
    // Base blackbody color
    vec3 color;
    if (T > 50000.0) {
        color = vec3(0.5, 0.7, 1.0) * 2.0;
    } else if (T > 25000.0) {
        color = vec3(0.8, 0.9, 1.0) * 1.5;
    } else if (T > 15000.0) {
        color = vec3(1.0, 1.0, 0.9);
    } else if (T > 10000.0) {
        color = vec3(1.0, 0.95, 0.8);
    } else if (T > 7000.0) {
        color = vec3(1.0, 0.9, 0.6);
    } else if (T > 5000.0) {
        color = vec3(1.0, 0.8, 0.4);
    } else {
        color = vec3(1.0, 0.6, 0.2);
    }
    
    // Emission lines (astrophysical plasma)
    float h_alpha = u_emissionLineStrength * 0.5 * exp(-pow((T - 10000.0) / 4000.0, 2.0));
    float h_beta = u_emissionLineStrength * 0.3 * exp(-pow((T - 15000.0) / 5000.0, 2.0));
    float oiii = u_emissionLineStrength * 0.4 * exp(-pow((T - 35000.0) / 10000.0, 2.0));
    
    color.r += h_alpha * 0.8 + h_beta * 0.3;
    color.g += h_alpha * 0.2 + h_beta * 0.6 + oiii * 0.9;
    color.b += h_beta * 0.1 + oiii * 0.7;
    
    return clamp(color, 0.0, 3.0);
}

// Main ray marching function
void main() {
    vec2 uv = (TexCoord * 2.0 - 1.0) * vec2(u_resolution.x / u_resolution.y, 1.0);
    
    // Camera setup
    vec3 rayOrigin = u_cameraPos;
    vec3 rayDir = normalize(vec3(uv, 1.5));
    
    // Apply camera rotation
    float camYaw = 0.0;
    float camPitch = 0.0;
    
    mat3 rotY = mat3(
        cos(camYaw), 0.0, sin(camYaw),
        0.0, 1.0, 0.0,
        -sin(camYaw), 0.0, cos(camYaw)
    );
    
    mat3 rotX = mat3(
        1.0, 0.0, 0.0,
        0.0, cos(camPitch), -sin(camPitch),
        0.0, sin(camPitch), cos(camPitch)
    );
    
    rayDir = rotX * rotY * rayDir;
    
    vec3 color = vec3(0.0);
    float absorption = 1.0;
    
    // Ray march through disk
    float stepSize = 0.5;
    int maxSteps = 150;
    
    for (int i = 0; i < maxSteps; i++) {
        vec3 samplePos = rayOrigin + rayDir * float(i) * stepSize;
        
        // Apply frame dragging
        float r = length(samplePos.xy);
        float phi = atan(samplePos.y, samplePos.x);
        samplePos = applyFrameDragging(samplePos, r);
        
        // Update coordinates after frame dragging
        r = length(samplePos.xy);
        phi = atan(samplePos.y, samplePos.x);
        float z = abs(samplePos.z);
        
        if (r < u_innerRadius * 0.5) {
            // Inside black hole - complete absorption
            absorption = 0.0;
            break;
        }
        
        if (r > u_outerRadius * 1.5) {
            // Far outside disk
            break;
        }
        
        // Disk geometry
        float H = u_thicknessBase * pow(r, u_thicknessExp);
        
        // Turbulence
        vec3 noiseCoord = vec3(r * 0.1, phi, u_time * 0.1);
        float turbulence = 1.0 + u_turbulenceAmp * noise(noiseCoord);
        H *= turbulence;
        
        if (z < H && r > u_innerRadius && r < u_outerRadius) {
            // Inside disk
            float density = exp(-(z * z) / (2.0 * H * H));
            density *= exp(-r / u_outerRadius);
            
            if (density > 0.01) {
                // Calculate temperature with height dependence
                float T = diskTemperature(r, phi, z);
                
                // Relativistic effects
                float gamma = 1.0 / sqrt(1.0 - 2.0 / (r + 1e-6));
                float doppler = 1.0 / (gamma * (1.0 - u_spin * 0.3 * sin(phi)));
                T *= doppler;
                
                // Get color
                vec3 emission = temperatureToColor(T);
                
                // Add to accumulated color
                color += absorption * density * emission * stepSize;
                
                // Absorption
                absorption *= exp(-density * stepSize * 0.2);
                
                if (absorption < 0.01) break;
            }
        }
    }
    
    // Add jet emission
    vec3 jet = jetEmission(rayDir);
    color += jet * absorption;
    
    // Background
    vec3 bgColor = vec3(0.02, 0.03, 0.05);
    color = mix(bgColor, color, min(1.0, length(color) * 2.0));
    
    // Tone mapping and exposure
    color = color * u_exposure;
    color = color / (color + vec3(1.0));
    
    // Gamma correction
    color = pow(color, vec3(1.0 / 2.2));
    
    FragColor = vec4(color, 1.0);
}