#version 300 es
precision highp float;

uniform vec2 iResolution;
uniform float iTime;
uniform sampler2D iChannel0;

// Simplex 3D noise
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.0 / sqrt(r); }

float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    
    i = mod289(i);
    vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// Temperature to RGB approximation (Kelvin)
vec3 colorFromTemperature(float T) {
    T = clamp(T, 1000.0, 40000.0);
    float red = smoothstep(3000.0, 10000.0, T) * (1.0 - smoothstep(10000.0, 40000.0, T));
    float green = smoothstep(5000.0, 8000.0, T) * (1.0 - smoothstep(8000.0, 12000.0, T));
    float blue = smoothstep(9000.0, 15000.0, T);
    return vec3(red, green, blue) * (1.0 + smoothstep(15000.0, 40000.0, T));
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
    float aspect = iResolution.x / iResolution.y;
    uv.x *= aspect;
    
    // Black hole parameters (Schwarzschild metric)
    const float G = 1.0;          // Gravitational constant
    const float c = 1.0;          // Speed of light
    const float M = 0.15;         // Black hole mass
    const float rs = 2.0 * G * M / (c * c); // Schwarzschild radius
    const float r_in = 6.0 * rs;  // Inner disk radius (ISCO)
    const float r_out = 30.0 * rs;// Outer disk radius
    const float r_shadow = 2.6 * rs; // Photon sphere radius
    
    // Disk parameters
    const float h0 = 0.08;        // Thickness parameter
    const float beta = 0.8;       // Thickness exponent
    const float A = 0.25;         // Turbulence amplitude (thickness)
    const float B = 0.15;         // Turbulence amplitude (temperature)
    const float T_max = 30000.0;  // Max temperature at inner edge (K)
    const float C = 0.4;          // Hotspot intensity
    const float sigma2 = 0.005;   // Hotspot spread
    
    // Camera setup (inclined view)
    const float inclination = 1.1; // 63 degrees inclination
    const float camera_z = 8.0;
    mat3 viewRot = mat3(
        1.0, 0.0, 0.0,
        0.0, cos(inclination), -sin(inclination),
        0.0, sin(inclination), cos(inclination)
    );
    
    // Ray setup
    vec3 ray_origin = vec3(0.0, 0.0, camera_z);
    vec3 ray_dir = normalize(vec3(uv, -1.0));
    ray_dir = viewRot * ray_dir;
    
    vec3 color = vec3(0.0);
    bool in_shadow = false;
    
    // Check for black hole shadow
    float r_impact = length(uv);
    if (r_impact < r_shadow) {
        color = vec3(0.0);
        in_shadow = true;
    }
    
    // Ray-disk intersection (z=0 plane in disk coordinates)
    if (!in_shadow && ray_dir.z != 0.0) {
        float t = -ray_origin.z / ray_dir.z;
        if (t > 0.0) {
            vec3 hit = ray_origin + t * ray_dir;
            hit.xy = (viewRot * vec3(hit.xy, 0.0)).xy; // Transform to disk space
            
            float r = length(hit.xy);
            float phi = atan(hit.y, hit.x);
            
            // Disk bounds check
            if (r > r_in && r < r_out) {
                // Disk thickness with turbulence
                float H_base = h0 * pow(r, beta);
                float noise_thickness = snoise(vec3(r * 3.0, phi * 5.0, iTime * 0.2)) * 0.5 + 0.5;
                float H_turb = H_base * (1.0 + A * noise_thickness);
                
                // Check if ray intersects disk volume
                if (abs(hit.z) < H_turb) {
                    // Temperature profile with turbulence
                    float T_base = T_max * pow(r / r_in, -0.75) * pow(1.0 - sqrt(r_in / r), 0.25);
                    float noise_temp = snoise(vec3(r * 2.0, phi * 4.0, iTime * 0.3 + 10.0)) * 0.5 + 0.5;
                    float T_turb = T_base * (1.0 + B * noise_temp);
                    
                    // Hotspot (orbiting)
                    vec2 hotspot_pos = vec2(
                        r_in * 1.5 * cos(iTime * 2.0 + 1.0),
                        r_in * 1.5 * sin(iTime * 2.0 + 1.0)
                    );
                    float dist2 = distance(hit.xy, hotspot_pos);
                    float hotspot = C * exp(-dist2 * dist2 / sigma2);
                    T_turb += hotspot * T_max * 0.5;
                    
                    // Relativistic effects
                    float v_orb = sqrt(G * M / r); // Orbital velocity
                    v_orb = min(v_orb, 0.99 * c);   // Prevent superluminal
                    
                    // Velocity vector (azimuthal direction)
                    vec3 velocity = vec3(-sin(phi) * v_orb, cos(phi) * v_orb, 0.0);
                    
                    // Observer direction (from emission point to camera)
                    vec3 obs_dir = normalize(ray_origin - hit);
                    
                    // Doppler factor
                    float v_dot_n = dot(velocity, obs_dir);
                    float gamma = 1.0 / sqrt(1.0 - (v_orb * v_orb) / (c * c));
                    float f_doppler = 1.0 / (gamma * (1.0 - v_dot_n / c));
                    
                    // Gravitational redshift
                    float f_grav = sqrt(1.0 - rs / r);
                    
                    // Combined relativistic factor
                    float f_rel = f_doppler * f_grav;
                    
                    // Observed temperature and intensity
                    float T_obs = T_turb * f_rel;
                    vec3 disk_color = colorFromTemperature(T_obs);
                    disk_color *= pow(f_rel, 3.0); // Relativistic beaming
                    
                    // Add emission lines (H-alpha)
                    float h_alpha = smoothstep(650.0, 660.0, T_obs) * 0.3;
                    disk_color.r += h_alpha;
                    
                    // Disk opacity based on viewing angle
                    float cos_theta = abs(dot(vec3(0,0,1), obs_dir));
                    disk_color *= (0.3 + 0.7 * cos_theta);
                    
                    // Self-shadowing approximation
                    if (hit.z < 0.0 && cos_theta < 0.3) {
                        disk_color *= 0.4; // Dim backside when edge-on
                    }
                    
                    color = disk_color;
                }
            }
        }
    }
    
    // Background with gravitational lensing
    if (all(equal(color, vec3(0.0)))) {
        // Strong lensing near photon sphere
        float lens_strength = smoothstep(r_shadow * 1.1, r_shadow * 0.9, r_impact);
        float bend = rs / (r_impact + 0.01) * (1.0 + lens_strength * 5.0);
        vec2 lens_uv = uv * (1.0 + bend);
        
        // Weak lensing for outer regions
        if (r_impact > r_shadow) {
            lens_uv = uv * (1.0 + rs / (2.0 * r_impact + 0.01));
        }
        
        color = texture(iChannel0, lens_uv / 2.0 + 0.5).rgb;
        
        // Lensing glare near photon sphere
        if (r_impact < r_shadow * 1.5) {
            float glare = smoothstep(r_shadow * 1.5, r_shadow, r_impact);
            color += vec3(0.8, 0.4, 0.2) * glare * 0.5;
        }
    }
    
    // Gamma correction and exposure
    color = pow(color, vec3(1.0 / 2.2));
    color *= 1.5; // Exposure boost
    
    // Vignette
    float vig = 1.0 - smoothstep(0.8, 1.2, length(uv));
    color *= vig;
    
    gl_FragColor = vec4(color, 1.0);
}