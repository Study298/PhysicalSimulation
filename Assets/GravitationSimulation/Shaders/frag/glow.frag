#version 330 core

in vec2 TexCoord;
out vec4 FragColor;

uniform vec3 uLightColor;
uniform float uGlowRadius;
uniform float uGlowIntensity;

void main()
{
    vec2 center = vec2(0.5, 0.5);
    float dist = length(TexCoord - center);

    float falloff = exp(-6.0 * pow(dist / uGlowRadius, 2.0));

    float intensity = uGlowIntensity * falloff;

    float alpha = clamp(intensity, 0.0, 1.0);

    vec3 color = uLightColor * intensity;
    FragColor = vec4(color, alpha);
}
