#version 330 core
uniform vec3      iResolution;           // Viewport resolution (pixels)
uniform float     iTime;                 // Shader playback time (seconds)
uniform sampler2D iChannel0;             // Background texture input

// Hash function for deterministic noise generation
// Based on Dave Hoskins' hash algorithm (2013)
float hash(vec2 p) {
    p = fract(p * vec2(5.3983, 5.4427));  // Break symmetry
    p += dot(p.yx, p.xy + vec2(21.9898, 14.3137));  // Create complex interaction
    return fract(p.x * p.y * 95.4307);  // Final hash value in [0,1]
}

// Value noise implementation using hash function
// Creates smooth transitions between lattice points
float noise(vec2 st) {
    vec2 i = floor(st);  // Integer grid coordinates
    vec2 f = fract(st);  // Fractional part for interpolation
    
    // Four corners of the grid cell
    float a = hash(i);  // Bottom-left
    float b = hash(i + vec2(1.0, 0.0));  // Bottom-right
    float c = hash(i + vec2(0.0, 1.0));  // Top-left
    float d = hash(i + vec2(1.0, 1.0));  // Top-right
    
    // Smooth interpolation curve (better than linear)
    vec2 u = f * f * (3.0 - 2.0 * f);
    
    // Interpolate horizontally then vertically
    return mix(a, b, u.x) + 
           (c - a) * u.y * (1.0 - u.x) + 
           (d - b) * u.x * u.y;
}

// Fractal Brownian Motion noise
// Creates turbulent, multi-scale noise patterns
float fbm(vec2 st, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    // Sum multiple noise octaves
    for (int i = 0; i < octaves; i++) {
        value += amplitude * noise(st * frequency);
        st += vec2(123.45, 678.90);  // Offset to avoid grid artifacts
        amplitude *= 0.5;  // Decrease contribution of higher frequencies
        frequency *= 2.0;  // Increase frequency for finer details
    }
    
    return value;
}

// Coordinate transformation utilities
vec2 toPolar(vec2 cartesian) {
    // Convert Cartesian to polar coordinates (angle, radius)
    return vec2(atan(cartesian.y, cartesian.x), length(cartesian));
}

vec2 toCartesian(vec2 polar) {
    // Convert polar to Cartesian coordinates
    return vec2(cos(polar.x) * polar.y, sin(polar.x) * polar.y);
}

// Gravitational lensing simulation
// Simulates spacetime curvature around massive objects
vec2 gravitationalLens(vec2 uv, vec2 center, float strength, float decay) {
    vec2 dir = uv - center;
    float distance = max(0.001, length(dir));  // Prevent division by zero
    
    // Calculate angular displacement based on gravitational strength
    // Follows inverse power law with customizable decay
    float angle = strength / pow(distance, decay);
    
    // Apply tangential displacement in polar coordinates
    vec2 polar = toPolar(dir);
    polar.x += angle * sin(iTime * 0.1);  // Subtle time-based variation
    
    return center + toCartesian(polar);
}

// Accretion disk generator
// Creates a physically-inspired disk with Doppler effects
vec3 generateAccretionDisk(vec2 uv, vec2 center, float innerRadius, float outerRadius) {
    vec2 dir = uv - center;
    float dist = length(dir);
    float angle = atan(dir.y, dir.x);
    
    // Smooth disk mask with feathered edges
    float diskMask = smoothstep(innerRadius, innerRadius + 0.005, dist) 
                   - smoothstep(outerRadius - 0.005, outerRadius, dist);
    
    // Early exit if outside disk area
    if (diskMask < 0.01) return vec3(0.0);
    
    // Animate disk rotation with time
    float rotation = iTime * 0.3;
    float relativeAngle = angle - rotation;
    
    // Simulate Doppler shifting:
    // Blue shift for approaching side (cos > 0)
    // Red shift for receding side (cos < 0)
    float doppler = cos(relativeAngle) * 0.4 + 0.6;
    vec3 blueShift = vec3(0.2, 0.5, 1.0) * doppler;
    vec3 redShift = vec3(1.0, 0.3, 0.2) * (1.0 - doppler);
    
    // Temperature gradient from hot inner edge to cooler outer edge
    float temperature = smoothstep(innerRadius, outerRadius, dist);
    vec3 baseColor = mix(blueShift, redShift, temperature);
    
    // Add turbulent plasma effects using FBM noise
    float turbulence = fbm(vec2(relativeAngle * 3.0, dist * 10.0 + iTime * 0.5), 3);
    float brightness = (1.0 - smoothstep(innerRadius, outerRadius, dist)) 
                     * (0.7 + turbulence * 0.3);
    
    // Apply emission intensity and mask
    return baseColor * brightness * 5.0 * diskMask;
}

// Event horizon visualization
// Creates the black sphere of no return
float eventHorizon(vec2 uv, vec2 center, float radius) {
    float dist = length(uv - center);
    
    // Create sharp but anti-aliased edge
    return 1.0 - smoothstep(radius - 0.002, radius + 0.002, dist);
}

// Background distortion handler
// Applies gravitational lensing to background texture
vec3 distortBackground(vec2 uv, vec2 center) {
    // Apply multiple lensing iterations for depth
    vec2 p1 = gravitationalLens(uv, center, 0.3, 1.8);
    vec2 p2 = gravitationalLens(p1, center, 0.1, 2.2);
    
    // Sample distorted background
    vec3 color = texture(iChannel0, p2).rgb;
    
    // Apply gravitational redshift near the black hole
    float proximity = 1.0 - smoothstep(0.15, 0.02, length(uv - center));
    vec3 redshiftColor = vec3(0.35, 0.15, 0.1) * proximity;
    
    // Blend redshift with original color
    return mix(color, redshiftColor, proximity * 0.6);
}

// Bloom effect generator
// Creates glowing emission around bright areas
vec3 applyBloom(vec2 uv, vec2 center, float intensity) {
    float dist = length(uv - center);
    float glow = 0.0;
    
    // Multiple glow layers with different characteristics
    glow += 0.5 / (dist * 40.0 + 0.3);  // Wide soft glow
    glow += 0.3 / (dist * 20.0 + 0.15); // Medium glow
    glow += 0.2 / (dist * 8.0 + 0.05);  // Tight intense glow
    
    // Animate glow intensity using noise
    float pulse = sin(iTime * 1.5 + dist * 10.0) * 0.1 + 0.9;
    glow *= pulse;
    
    // Color temperature gradient for realistic bloom
    vec3 warm = vec3(1.0, 0.8, 0.4);
    vec3 cool = vec3(0.2, 0.4, 1.0);
    vec3 glowColor = mix(warm, cool, dist * 3.0);
    
    return glowColor * glow * intensity;
}

// Lens flare artifacts
// Simulates optical artifacts from bright light sources
vec3 generateLensFlare(vec2 uv, vec2 center) {
    float dist = length(uv - center);
    float angle = atan(uv.y - center.y, uv.x - center.x);
    
    // Primary flare elements
    float primaryFlare = pow(0.05 / (dist + 0.01), 1.2) * 0.8;
    
    // Secondary diffraction spikes
    float spikes = abs(cos(angle * 6.0 + iTime * 0.5)) * 0.3;
    float diffraction = pow(0.1 / (dist + 0.2), 0.8) * spikes;
    
    // Chromatic aberration effect
    vec3 color = vec3(0.0);
    color.r += primaryFlare * 1.2;  // Red channel strongest
    color.g += primaryFlare * 0.9;  // Green medium
    color.b += primaryFlare * 0.7;  // Blue weakest
    
    // Add diffraction spikes
    color += vec3(1.0, 0.9, 0.8) * diffraction * 0.5;
    
    // Vignette to contain flares
    float vignette = smoothstep(0.8, 0.3, dist);
    return color * vignette;
}

void main() {
    // Normalize fragment coordinates [0,1]
    vec2 uv = gl_FragCoord.xy / iResolution.xy;
    
    // Aspect ratio correction and centering
    vec2 centeredUV = (uv - 0.5) * vec2(iResolution.x / iResolution.y, 1.0);
    
    // Black hole parameters (adjustable)
    vec2 blackHoleCenter = vec2(0.0, 0.0);  // Center of the screen
    float eventRadius = 0.04;               // Event horizon size
    float innerDiskRadius = 0.07;           // Inner accretion disk boundary
    float outerDiskRadius = 0.22;           // Outer accretion disk boundary
    
    // Generate visual components
    float horizon = eventHorizon(centeredUV, blackHoleCenter, eventRadius);
    vec3 accretionDisk = generateAccretionDisk(
        centeredUV, 
        blackHoleCenter, 
        innerDiskRadius, 
        outerDiskRadius
    );
    vec3 distortedBackground = distortBackground(centeredUV, blackHoleCenter);
    vec3 bloom = applyBloom(centeredUV, blackHoleCenter, 0.25);
    vec3 lensFlare = generateLensFlare(centeredUV, blackHoleCenter);
    
    // Composite rendering
    vec3 finalColor = vec3(0.0);
    
    // Background visible outside gravitational influence
    float diskArea = smoothstep(outerDiskRadius - 0.03, outerDiskRadius + 0.03, length(centeredUV));
    finalColor = mix(distortedBackground, accretionDisk, 1.0 - diskArea);
    
    // Apply event horizon (pure black)
    finalColor = mix(finalColor, vec3(0.0), horizon);
    
    // Add glow effects
    finalColor += bloom;
    finalColor += lensFlare * 0.5;
    
    // Relativistic beaming effect (brightening in direction of motion)
    float beaming = dot(normalize(centeredUV), vec2(cos(iTime*0.2), sin(iTime*0.2)));
    beaming = smoothstep(0.0, 1.0, beaming * 0.7 + 0.3);
    finalColor *= beaming * 1.3;
    
    // Gamma correction for display
    finalColor = pow(finalColor, vec3(0.75));
    
    // Cinematic vignette effect
    float vignette = 1.0 - length(centeredUV) * 1.3;
    vignette = clamp(vignette * vignette, 0.0, 1.0);
    finalColor *= vignette;
    
    // Temporal anti-aliasing simulation
    float temporalNoise = hash(gl_FragCoord.xy + vec2(iTime)) / 255.0;
    finalColor += (temporalNoise - 0.002);
    
    // Final output with alpha channel
    gl_FragColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0);
}