#version 330 core

struct Light {
    vec3 position;
    vec3 color;
    float intensity;
    float emission;
};

uniform int uLightCount;
uniform Light uLights[8];

uniform vec3 uViewPos;
uniform vec3 uObjectColor;
uniform float uEmissiveStrength;

in vec3 FragPos;
in vec3 Normal;

out vec4 FragColor;


float computeShadow(vec3 fragPos, vec3 lightPos, vec3 norm)
{
    vec3 lightDir = normalize(lightPos - fragPos);
    float facing = dot(norm, lightDir);


    return clamp(facing * 0.8 + 0.2, 0.0, 1.0);
}

void main()
{
    vec3 norm = normalize(Normal);
    vec3 viewDir = normalize(uViewPos - FragPos);

    vec3 lighting = vec3(0.0);
    vec3 ambient = 0.03 * uObjectColor;

    for (int i = 0; i < uLightCount; i++)
    {
        vec3 lightDir = normalize(uLights[i].position - FragPos);
        float diff = max(dot(norm, lightDir), 0.0);


        float shadow = computeShadow(FragPos, uLights[i].position, norm);

        vec3 reflectDir = reflect(-lightDir, norm);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);

        vec3 diffuse  = diff * uLights[i].color * uLights[i].intensity * shadow;
        vec3 specular = spec * uLights[i].color * 0.3 * uLights[i].intensity * shadow;

        lighting += diffuse + specular;
    }


    float emissionPower = 0.0;
    for (int i = 0; i < uLightCount; i++)
    {
        float d = length(FragPos - uLights[i].position);
        emissionPower += uLights[i].emission / (1.0 + d * d * 2.0);
    }

    vec3 baseColor = ambient + lighting * uObjectColor + emissionPower * uObjectColor;


    if (gl_FragCoord.y < 20.0)
        baseColor += vec3(0.02, 0.04, 0.06) * (1.0 - gl_FragCoord.y / 20.0);

    FragColor = vec4(baseColor, 1.0);
}
