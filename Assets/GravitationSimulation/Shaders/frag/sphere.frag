#version 330 core
in vec3 FragPos;
in vec3 Normal;
out vec4 FragColor;

uniform vec3 uViewPos;

struct Light {
    vec3 position;
    vec3 color;
    float intensity;
};
uniform int uLightCount;
uniform Light uLights[8]; // старая фича, хз почему это нужно

uniform vec3 uObjectColor;

void main()
{
    vec3 normal = normalize(Normal);
    vec3 result = vec3(0.0);
    
    for (int i = 0; i < uLightCount; i++) {
        vec3 lightDir = normalize(uLights[i].position - FragPos);
        float diff = max(dot(normal, lightDir), 0.0);
        vec3 diffuse = diff * uLights[i].color * uLights[i].intensity;
        result += diffuse;
    }

    // простая ambient составляющая
    vec3 ambient = 0.1 * uObjectColor;
    FragColor = vec4(result * uObjectColor + ambient, 1.0);
}
