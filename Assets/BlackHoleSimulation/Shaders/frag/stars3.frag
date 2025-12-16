#version 330 core
out vec4 FragColor;
in vec2 TexCoords;
uniform vec2 iResolution;
uniform float iTime;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
    vec2 uv = TexCoords;
    uv.y *= iResolution.y / iResolution.x;
    
    // Deep space background
    vec3 color = vec3(0.01, 0.015, 0.03);
    
    float t = iTime * 0.2;
    
    // Base stars (always visible)
    for (int i = 0; i < 20; i++) {
        float idx = float(i);
        vec2 pos = vec2(
            hash(vec2(idx, 1.0)),
            hash(vec2(idx, 2.0))
        );
        
        float dist = distance(uv, pos);
        float size = 0.004;
        
        if (dist < size) {
            float r = hash(vec2(idx, 3.0));
            vec3 starColor = mix(vec3(0.8, 1.0, 1.2), vec3(1.3, 1.1, 0.7), r);
            float twinkle = sin(t * 4.0 + r * 15.0) * 0.3;
            float intensity = (1.0 - dist/size) * (1.0 + twinkle);
            color += starColor * intensity * 1.2;
        }
    }
    
    // Shooting stars (appear every 3 seconds)
    float shootTime = mod(iTime, 3.0);
    if (shootTime < 0.8) {
        float progress = shootTime / 0.8;
        float seed = hash(vec2(floor(iTime / 3.0), 1.0));
        
        // Random trajectory
        vec2 start = vec2(-0.2, seed * 0.8 + 0.1);
        vec2 end = vec2(1.2, (seed + 0.3) * 0.6 + 0.2);
        vec2 pos = mix(start, end, progress);
        
        float dist = distance(uv, pos);
        float size = 0.006 * (1.0 - progress * 0.7);
        
        if (dist < size * 2.0) {
            // Bright core
            float core = (1.0 - smoothstep(0.0, size, dist)) * 2.5;
            
            // Fading trail
            float trailLen = 0.15;
            float trailStart = progress - trailLen;
            float trailProgress = clamp((progress - trailStart) / trailLen, 0.0, 1.0);
            vec2 trailPos = mix(start, end, trailStart);
            float trailDist = distance(uv, trailPos);
            float trail = (1.0 - smoothstep(0.0, size * 3.0, trailDist)) * (1.0 - trailProgress) * 0.8;
            
            // Combine effects
            vec3 shootColor = vec3(1.5, 1.2, 0.8) * (core + trail);
            color += shootColor;
            
            // Add glow to surrounding area
            float glow = (1.0 - smoothstep(0.0, size * 5.0, dist)) * 0.3;
            color += vec3(0.2, 0.3, 0.5) * glow;
        }
    }
    
    FragColor = vec4(0.5, 0.5, 0.5, 1.0);
}