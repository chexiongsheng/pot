// 原版第一人称枪口火焰（N_ 的 ShaderMaterial，AdditiveBlending、DoubleSide、不写深度）机械移植。
// 原版用自定义属性 aType 区分 5 类面片；Runner 不支持自定义顶点属性，改为编码进 uv.y：uv.y = v + aType * 2。
// 0 星芒（两层花瓣）、1 侧焰（十字交叉的两片，沿枪管向前）、2 横向喷流、3 核心光、4 枪管余热
#include <pot/varyings>

uniform float uSeed;
uniform float uInt;
uniform float uHeat;
uniform float uJet;

out vec4 fragColor;

float h1(float n) { return fract(sin(n * 127.1 + uSeed * 311.7) * 43758.5453); }

void main() {
  float vType = floor(vUV.y * 0.5);
  vec2 uv = vec2(vUV.x, vUV.y - vType * 2.0);
  vec2 p = uv * 2.0 - 1.0;
  float r = length(p), a = atan(p.y, p.x);
  float I = 0.0;
  vec3 tintc = vec3(1.0, 0.50, 0.16);
  if (vType < 0.5) {
    float n1 = 3.0 + floor(h1(1.0) * 3.0), n2 = 5.0 + floor(h1(2.0) * 4.0);
    float pet = pow(abs(cos(a * n1 * 0.5 + h1(3.0) * 6.283)), 5.0) * (0.55 + 0.45 * h1(4.0));
    pet += pow(abs(cos(a * n2 * 0.5 + h1(5.0) * 6.283)), 14.0) * 0.55;
    float reach = 0.35 + 0.65 * pet;
    I = (0.25 + pet) * smoothstep(reach, reach * 0.15, r) * (0.75 + 0.25 * sin(r * 26.0 + h1(6.0) * 20.0));
  } else if (vType < 1.5) {
    float y = uv.y, x = p.x * (1.0 + 0.5 * sin(y * 17.0 + h1(7.0) * 30.0) * y);
    float wdt = mix(0.20, 0.75, smoothstep(0.0, 0.35, y)) * (1.0 - y * 0.75);
    I = exp(-x * x / (wdt * wdt * 0.35)) * pow(1.0 - y, 1.4) * (0.7 + 0.3 * sin(y * 31.0 + h1(8.0) * 9.0)) * 0.9;
  } else if (vType < 2.5) {
    float u = abs(p.x), len = 0.55 + 0.45 * h1(9.0 + step(0.0, p.x));
    float wv = p.y * (1.0 + u * 3.0) + 0.12 * sin(u * 14.0 + h1(10.0) * 20.0) * u;
    I = exp(-wv * wv * 22.0) * smoothstep(len, 0.06, u) * smoothstep(0.02, 0.10, u) * 0.85 * uJet;
  } else if (vType < 3.5) {
    I = exp(-r * r * 5.0) * 2.4 * smoothstep(1.0, 0.6, r);
    tintc = vec3(1.0, 0.82, 0.58);
  } else {
    fragColor = vec4(vec3(1.0, 0.28, 0.06) * exp(-r * r * 4.0) * smoothstep(1.0, 0.5, r) * uHeat, 1.0);
    return;
  }
  vec3 col = mix(tintc, vec3(1.0, 0.90, 0.70), clamp(I * I * 0.7, 0.0, 1.0)) * I * uInt;
  fragColor = vec4(col, 1.0);
}
