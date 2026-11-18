// 原版受光粒子片元（pretty.js VR）机械移植：烟团 / 水柱 / 水雾。预乘 alpha 输出（绑定 blend: premultiplied）。
// 原版 softFade（读场景深度）未移植；色调映射交给全局后处理。
#include <pot/varyings>

uniform sampler2D uTex;
uniform vec3 uSun, uSunDir, uAmbLo, uAmbHi;

in vec3 vOff;
in vec3 vToCam;
in vec3 vInfo;
in vec3 vT;
in vec3 vB;

out vec4 fragColor;

void main() {
  vec4 t = texture(uTex, vUV);
  float er = vInfo.y * 0.45;
  float a = smoothstep(er, er + (vInfo.z > 1.5 ? 0.38 : 0.6), t.a) * vColor.a;
  a *= smoothstep(0.2, 0.9, vInfo.x);
  if (a < 0.004) discard;
  vec3 V = normalize(vToCam);
  vec3 q = vOff * 2.0; float r2 = min(dot(q, q), 1.0);
  vec3 Ns = q + V * (sqrt(1.0 - r2) * 0.9 + 0.05);
  vec2 tn = t.rg * 2.0 - 1.0;
  vec3 Nb = vT * tn.x + vB * tn.y + V * sqrt(max(1.0 - dot(tn, tn), 0.0));
  vec3 N = normalize(Ns * 0.55 + Nb);
  float wrap = clamp((dot(N, uSunDir) + 0.45) / 1.45, 0.0, 1.0);
  float back = pow(clamp(dot(-V, uSunDir), 0.0, 1.0), 5.0);
  float thin = 1.0 - t.b * smoothstep(0.0, 0.5, a);
  float hot = step(1.5, vInfo.z), shade = vInfo.z - 2.0 * hot;
  vec3 sun = uSun * (wrap * wrap * 0.85 + back * (0.15 + 1.3 * thin)) * shade;
  vec3 amb = mix(uAmbLo, uAmbHi, N.y * 0.5 + 0.5) * (1.0 - 0.35 * t.b);
  vec3 col = vColor.rgb * (amb + sun);
  if (hot > 0.5) {
    float lump = clamp(dot(tn, vec2(0.6, 0.8)) * 0.6 + 0.5, 0.0, 1.0);
    float core = t.b * t.b * smoothstep(0.15, 0.9, t.a);
    vec3 fire = vColor.rgb * (0.10 + 1.7 * core) * (0.45 + 1.1 * lump);
    col = vec3(0.045, 0.042, 0.04) * (amb + sun) + fire;
  }
  fragColor = vec4(col * a, a);
}
