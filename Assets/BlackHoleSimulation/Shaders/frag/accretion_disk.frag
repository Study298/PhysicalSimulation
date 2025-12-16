#version 330 core

out vec4 FragColor;

uniform vec2 iResolution;
uniform float iTime;
uniform sampler2D iChannel0;

uniform float CAMERA_DIST;
uniform float SINGULARITY_RADIUS;
uniform float MASS;
uniform float DISK_RADIUS;

uniform int MAX_STEPS;
uniform float MIN_DIST;

uniform vec3 BACKGROUND_COLOR;
uniform float TEMPERATURE_MULTIPLIER;
uniform float NOISE_INTENSITY;

const float PI = 3.14159265;
const float e = 2.71828182846;
const float TAU = PI * 2.0;
const float INV_255 = 1.0 / 255.0;

uniform float TURBULENCE_STRENGTH;
uniform float SPIRAL_FREQUENCY; 
uniform float STREAM_INTENSITY;
uniform float ROTATION_SPEED;

const uint BLACK_BODY[38] = uint[](
    0x00000000u, 0x44270800u, 0x884e1001u, 0xAA751802u, 0xCC9c2103u, 0xEEc42903u, 0xFFeb3104u, 0xFFff3605u,
    0xFFff6200u, 0xFFff7c00u, 0xFFff8f1du, 0xFFffa042u, 0xFFffb05eu, 0xFFffbc76u, 0xFFffc78bu, 0xFFffd09fu,
    0xFFffd8b1u, 0xFFffe0c0u, 0xFFffe7d0u, 0xFFffeddeu, 0xFFfff1eau, 0xFFfff6f5u, 0xFFfff9feu, 0xFFf7f5ffu,
    0xFFeff0ffu, 0xFFe8ecffu, 0xFFe2e9ffu, 0xFFdce5ffu, 0xFFd7e2ffu, 0xFFd3dfffu, 0xFFcfddffu, 0xFFcbdbffu,
    0xFFc8d9ffu, 0xFFc5d7ffu, 0xFFc3d5ffu, 0xFFc0d4ffu, 0xFFbed2ffu, 0xFFbbd1ffu
);

struct Ray {
    vec3 origin;
    vec3 dir;
};

#define RAY_SRC_DISK 1u
#define RAY_SRC_HORIZON 2u
#define RAY_SRC_SPACE 3u

uint raySrc = 0u;
float rayDistance = 0.0;
Ray camera = Ray(vec3(0), vec3(0));
vec3 srcPos;

// Define Uint2RGB first
vec3 Uint2RGB(uint col) {
    return vec3(
        float((col >> 16u) & 0xFFu) * INV_255,
        float((col >> 8u) & 0xFFu) * INV_255,
        float(col & 0xFFu) * INV_255
    );
}

// Utility functions from provided code
float Hash(vec2 pos) {
    pos = fract(pos * 13.654678) * 65.247743;
    float f = fract((pos.x + pos.y) * pos.x * pos.y);
    return f * f;
}

float pn(in vec3 x) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
    vec2 uv = (p.xy+vec2(37.0,17.0)*p.z) + f.xy;
    vec2 rg = textureLod(iChannel0, (uv+ 0.5)/256.0, 0.0).yx;
    return -1.0+2.4*mix(rg.x, rg.y, f.z);
}

float fpn(vec3 p) {
   return pn(p*.06125)*.5 + pn(p*.125)*.25 + pn(p*.25)*.125;
}

mat2 Spin(float angle) {
    return mat2(cos(angle),-sin(angle),sin(angle),cos(angle));
}

float length2(vec2 p) {
    return sqrt(p.x*p.x + p.y*p.y);
}

float length8(vec2 p) {
    p = p*p; p = p*p; p = p*p;
    return pow(p.x + p.y, 1.0/8.0);
}

float VolumetricDisk(vec3 p, vec3 t) {
    vec2 q = vec2(length2(p.xy)-t.x, p.z*0.5);
    return max(length8(q)-t.y, abs(p.z) - t.z);
}

float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0);
    return mix(b, a, h) - k*h*(1.0-h);
}

// Assign color to the media - modified to use our black body palette
vec3 ComputeDiskColor(float density, float radius, float temperature) {
    // Use black body color palette based on temperature
    float idx = temperature * 38.0;
    uint i1 = uint(idx);
    uint i2 = i1 + 1u;
    
    vec3 c1 = Uint2RGB(BLACK_BODY[i1]);
    vec3 c2 = Uint2RGB(BLACK_BODY[i2]);
    float f = fract(idx);
    
    vec3 baseColor = mix(c1, c2, f);
    
    // Add density-based variation
    vec3 result = mix(1.1*baseColor, baseColor * 0.5, density);
    
    // Color variation based on radius
    vec3 colCenter = 6.*vec3(0.8,1.0,1.0);
    vec3 colEdge = 2.*vec3(0.48,0.53,0.5);
    result *= mix(colCenter, colEdge, min((radius+.5)/2.0, 1.15));
    
    return result;
}

// Main volumetric mapping function
float VolumetricMap(vec3 p) {
    float t = 0.7 * iTime;
    
    // Scale disk parameters to match our uniform system
    float diskScale = DISK_RADIUS / 2.0;
    vec3 diskParams = vec3(diskScale * 2.0, diskScale, 0.05);
    
    float d1 = VolumetricDisk(p, diskParams) + 
               fpn(vec3(Spin(t*0.25+p.z*.10)*p.xy*20., p.z*20.-t)*5.0) * 0.545;
    
    // Add spiral density waves
    float r = length(p.xz);
    float angle = atan(p.z, p.x) + iTime * ROTATION_SPEED / (pow(r, 1.5) + 0.1);
    float spirals = sin(SPIRAL_FREQUENCY * angle - 3.0 * log(r) - iTime * 0.5);
    
    return d1 + spirals * 0.3 * STREAM_INTENSITY;
}

// Cylinder intersection for bounding volume
bool RayCylinderIntersect(vec3 org, vec3 dir, out float near, out float far) {
    float radius = DISK_RADIUS * 1.5;
    float height = DISK_RADIUS * 0.3;
    
    float a = dot(dir.xy, dir.xy);
    float b = dot(org.xy, dir.xy);
    float c = dot(org.xy, org.xy) - radius*radius;

    float delta = b * b - a * c;
    if(delta < 0.0) return false;

    float deltasqrt = sqrt(delta);
    float arcp = 1.0 / a;
    near = (-b - deltasqrt) * arcp;
    far = (-b + deltasqrt) * arcp;
    
    float temp = min(far, near);
    far = max(far, near);
    near = temp;

    float znear = org.z + near * dir.z;
    float zfar = org.z + far * dir.z;

    vec2 zcap = vec2(height, -height);
    vec2 cap = (zcap - org.z) / dir.z;

    if(znear < zcap.y) near = cap.y;
    else if(znear > zcap.x) near = cap.x;

    if(zfar < zcap.y) far = cap.y;
    else if(zfar > zcap.x) far = cap.x;
    
    return far > 0.0 && far > near;
}

mat3 camMatrix(in float yaw, in float pitch) {
    vec3 forward = normalize(vec3(sin(yaw), sin(pitch), cos(yaw)) * cos(pitch));
    vec3 right = normalize(cross(vec3(0, 1, 0), forward));
    return mat3(right, cross(forward, right), forward);
}

mat3 lookMouse(in vec2 unitMouse) {
    return camMatrix((unitMouse.x * 1.2 - 0.1) * PI, (unitMouse.y + 0.5) * PI);
}

float Temp(float dist) {
    return pow(e, -pow(((PI * (dist - 0.5)) / (dist - 0.1)), 2.0)) * TEMPERATURE_MULTIPLIER;
}

vec4 GetSpace() {
    return vec4(BACKGROUND_COLOR, 1.0);
}

// Volumetric disk rendering
vec4 RenderVolumetricDisk(Ray camera) {
    vec3 ro = camera.origin;
    vec3 rd = camera.dir;
    
    // Apply gravitational lensing to ray direction
    vec3 toCenter = normalize(ro);
    rd = normalize(rd - toCenter * (MASS / (dot(ro, ro) + 0.1)));
    
    float ld = 0., td = 0., w = 0.;
    float d = 1., t = 0.;
    vec4 sum = vec4(0.0);
    
    float min_dist = 0.0, max_dist = 0.0;

    if(RayCylinderIntersect(ro, rd, min_dist, max_dist)) {
        t = min_dist;
        
        // Raymarch through volumetric disk
        for(int i = 0; i < 56; i++) {
            vec3 pos = ro + t * rd;
            
            // Apply gravitational lensing during march
            vec3 toPos = normalize(pos);
            rd = normalize(rd - toPos * (MASS / (dot(pos, pos) + 0.1)));
            
            float fld = 0.0;
            
            // Break conditions
            if(td > (1.-1./80.) || d < 0.008*t || t > max_dist || sum.a > 0.99) break;
            
            // Evaluate volumetric density
            d = VolumetricMap(pos);
            
            // Direction to center for lighting
            vec3 stardir = normalize(vec3(0.0) - pos);
            
            d = max(d, 0.08);
            
            if(d < 0.1) {
                // Compute local density
                ld = 0.1 - d;
                
                #define DENSE_DUST
                #ifdef DENSE_DUST
                fld = clamp((ld - VolumetricMap(pos + 0.2 * stardir)) / 0.4, 0.0, 1.0);
                ld += fld;
                #endif
                
                // Compute weighting factor
                w = (1. - td) * ld;
                
                // Accumulate density
                td += w + 1./200.;
                
                float radiusFromCenter = length(pos);
                float temperature = Temp(radiusFromCenter / DISK_RADIUS);
                vec4 col = vec4(ComputeDiskColor(td, radiusFromCenter, temperature), td);
                
                // Scale and blend
                col.a *= 0.2;
                col.rgb *= col.a / 0.8;
                sum = sum + col * (1.0 - sum.a);
            }
            
            td += 1./70.;
            
            // Central black hole - no light source, just darkness
            vec3 ldst = vec3(0.0) - pos;
            float lDist = max(length(ldst), 0.001);
            
            // Black hole shadow - darken near center
            if(lDist < SINGULARITY_RADIUS * 3.0) {
                sum.rgb *= 1.0 - (SINGULARITY_RADIUS * 3.0 - lDist) / (SINGULARITY_RADIUS * 3.0);
            }
            
            d = max(d, 0.04);
            t += max(d * 0.3, 0.02);
        }
        
        sum = clamp(sum, 0.0, 1.0);
        sum.xyz = sum.xyz * sum.xyz * (3.0 - 2.0 * sum.xyz);
    }
    
    return sum;
}

vec4 March(Ray camera) {
    // First check for black hole horizon
    float horizonDist = length(camera.origin) - SINGULARITY_RADIUS;
    if(horizonDist < 0.0) {
        return vec4(0.0, 0.0, 0.0, 1.0);
    }
    
    // Render volumetric disk
    vec4 diskResult = RenderVolumetricDisk(camera);
    
    if(diskResult.a > 0.01) {
        return diskResult;
    }
    
    return GetSpace();
}

void main() {
    vec2 fragCoord = gl_FragCoord.xy;

    // Orbiting camera to see the 3D structure
    float time = iTime * 0.1;
    float camAngle = time * 0.3;
    float camHeight = 0.3;
    float camDistance = CAMERA_DIST;
    
    vec3 camPos = vec3(
        sin(camAngle) * camDistance,
        camHeight * camDistance,
        cos(camAngle) * camDistance
    );
    
    vec3 lookAt = vec3(0.0);
    vec3 forward = normalize(lookAt - camPos);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
    vec3 up = cross(forward, right);
    
    mat3 vmat = mat3(right, up, forward);
    vec2 uv = (fragCoord - iResolution.xy * 0.5) / iResolution.y;

    camera.origin = camPos;
    camera.dir = normalize(vmat * vec3(uv, 1.5));

    vec4 result = March(camera);
    
    // Add background stars (from provided code)
    if(result.a < 0.8) {
        vec3 stars = vec3(pn(camera.dir * 300.0) * 0.4 + 0.5);
        vec3 starbg = vec3(0.0);
        starbg = mix(starbg, vec3(0.8, 0.9, 1.0), 
                    smoothstep(0.99, 1.0, stars) * 
                    clamp(dot(vec3(0.0), camera.dir) + 0.75, 0.0, 1.0));
        starbg = clamp(starbg, 0.0, 1.0);
        result.xyz += starbg * (1.0 - result.a);
    }
    
    FragColor = vec4(pow(result.xyz, vec3(1.0/2.2)), 1.0);
}