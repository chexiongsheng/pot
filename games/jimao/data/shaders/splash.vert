// 原版雨点溅射（pretty.js UR）机械移植。实例展开方式同 rain.vert（pot_Normal = aSeed.xyz，pot_UV.x = aSeed.w）。
// 位置以相机所在 4 m 网格对齐、在 ±15 m 内随周期重抽；积水处（apron 遮罩 r < 0.49）更密更大。three 坐标计算。
#include <pot/varyings>

uniform float uRain;
uniform vec3 uSunDir, uSunCol, uAmb, uMaskRect;
uniform sampler2D uMask;
uniform vec4 uBoxMin[4];
uniform vec4 uBoxMax[4];

out float vLife;

bool wInside(vec3 p) {
  for (int i = 0; i < 4; i++) { if (all(greaterThan(p, uBoxMin[i].xyz)) && all(lessThan(p, uBoxMax[i].xyz))) return true; }
  return false;
}
float wPhase(float c) { float g = 0.72; return (1.0 - g * g) / (12.566 * pow(1.0 + g * g - 2.0 * g * c, 1.5)); }
vec2 sHash(vec2 p) { vec3 q = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }

void main() {
  float uTime = pot_Time.x;
  vec4 aSeed = vec4(pot_Normal, pot_UV.x);
  vec3 cameraPosition = vec3(pot_CameraPos.x, pot_CameraPos.y, -pot_CameraPos.z);
  vec2 uv = pot_Position.xy;
  float period = 0.26 + 0.14 * aSeed.z;
  float tt = uTime / period + aSeed.w * 10.0; float cyc = floor(tt); float life = fract(tt);
  vec2 r = sHash(aSeed.xy * 91.7 + cyc * 0.371);
  vec2 rr = r - 0.5; rr *= 0.35 + 1.3 * abs(rr);                    // 越靠近玩家越密
  vec2 snap = floor(cameraPosition.xz / 4.0) * 4.0;
  vec3 p = vec3(snap.x + rr.x * 30.0, 0.0, snap.y + rr.y * 30.0);
  float kill = 0.0;
  vec2 muv = (p.xz - uMaskRect.xy) * uMaskRect.z;
  float inM = step(0.0, muv.x) * step(muv.x, 1.0) * step(0.0, muv.y) * step(muv.y, 1.0);
  float pud = step(textureLod(uMask, muv, 0.0).r, 0.49) * inM;
  float k = fract(aSeed.w * 5.3 + cyc * 0.17);
  if (pud < 0.5 && k > 0.3) kill = 1.0;
  if (k > 0.2 + 0.8 * uRain) kill = 1.0;
  if (p.x > 29.7 || wInside(p + vec3(0.0, 0.2, 0.0))) kill = 1.0;
  float sz = mix(0.04, 0.08, aSeed.z) * mix(0.65, 1.0, pud);
  float wd = sz * (0.7 + 1.5 * life), ht = sz * (0.4 + 1.3 * sin(life * 3.14159));
  vec3 toP = p - cameraPosition; float dist = length(toP);
  vec3 side = normalize(vec3(toP.z, 0.0, -toP.x));
  vec3 wp = p + side * (wd * uv.x * 2.0) + vec3(0.0, ht * uv.y + 0.004, 0.0);
  float c = dot(toP / max(dist, 1e-3), uSunDir);
  vec3 world = vec3(wp.x, wp.y, -wp.z);
  vWorldPos = world;
  vNormal = vec3(0.0, 1.0, 0.0);
  vUV = uv;
  vColor = vec4(uAmb * 1.4 + uSunCol * wPhase(c) * 0.8, (1.0 - life) * (1.0 - smoothstep(11.0, 15.0, dist)) * mix(0.5, 1.0, pud));
  vTangent = vec4(1.0, 0.0, 0.0, 1.0);
  vLife = life;
  gl_Position = kill > 0.5 ? vec4(2.0, 2.0, 2.0, 1.0) : pot_ViewProj * vec4(world, 1.0);
}
