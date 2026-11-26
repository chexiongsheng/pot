// 原版雨滴（pretty.js Ub + kR）机械移植。原版是实例化网格（每实例 aSeed vec4）；gfx 没有实例化，
// 由 rain.ts 把每个实例的 4 个角点直接展开进网格：pot_Position = 角点 (x, y, 0)，pot_Normal = aSeed.xyz，pot_UV.x = aSeed.w。
// 计算在原版 three 坐标下进行（z 取反），输出时转回 Unity。绑定须 frustumCull:false（位置在这里重算，网格包围盒不可信）。
#include <pot/varyings>

uniform float uRain, uDrip;
uniform vec3 uVel, uBox, uSunDir, uSunCol, uAmb;
// 室内盒子（three 坐标，已外扩）与天窗 (x, z, 半宽, 半深)：室内不下雨，天窗下照下
uniform vec4 uBoxMin[4];
uniform vec4 uBoxMax[4];
uniform vec4 uSky[8];

bool wInside(vec3 p) {
  for (int i = 0; i < 4; i++) { if (all(greaterThan(p, uBoxMin[i].xyz)) && all(lessThan(p, uBoxMax[i].xyz))) return true; }
  return false;
}
bool wSky(vec3 p) {
  for (int i = 0; i < 8; i++) { if (abs(p.x - uSky[i].x) < uSky[i].z && abs(p.z - uSky[i].y) < uSky[i].w) return true; }
  return false;
}
float wPhase(float c) { float g = 0.72; return (1.0 - g * g) / (12.566 * pow(1.0 + g * g - 2.0 * g * c, 1.5)); }

void main() {
  float uTime = pot_Time.x;
  vec4 aSeed = vec4(pot_Normal, pot_UV.x);
  vec3 cameraPosition = vec3(pot_CameraPos.x, pot_CameraPos.y, -pot_CameraPos.z);
  // 原版 uPix = 2·tan(fov/2) / 屏幕高（像素在 1 米处对应的世界尺寸）
  float uPix = 2.0 * pot_Camera.z * pot_Resolution.w;
  vec2 uv = pot_Position.xy;
  float sp = 0.82 + 0.36 * aSeed.w;
  vec3 vel = uVel * sp;
  vec3 p; float len; float kill = 0.0;
  if (aSeed.w < 0.0) {                       // 仓库南檐滴水线，从 7 m 自由落下
    float T = 1.19; float t = fract(uTime / T * (0.9 + 0.2 * aSeed.y) + aSeed.z) * T;
    p = vec3(mix(-16.0, 12.0, aSeed.x), 7.0 - 4.9 * t * t, -10.72 + 0.05 * sin(aSeed.x * 911.0));
    vel = vec3(0.0, -9.81 * t - 0.3, 0.0); len = 0.022 * length(vel) + 0.03;
    kill = 1.0 - uDrip;
    if (fract(aSeed.x * 37.7) > 0.55 + 0.45 * uRain) kill = 1.0;
  } else {
    p = aSeed.xyz * uBox + vel * uTime;
    p = mod(p - cameraPosition + 0.5 * uBox, uBox) - 0.5 * uBox + cameraPosition;
    len = 0.03 * length(vel);
    if (fract(aSeed.w * 7.13 + aSeed.x) > uRain) kill = 1.0;
    if (wInside(p) && !wSky(p)) kill = 1.0;
  }
  if (p.y < (p.x > 30.0 ? -1.6 : 0.0)) kill = 1.0;
  vec3 dir = normalize(vel);
  vec3 toP = p - cameraPosition; float dist = length(toP);
  vec3 side = normalize(cross(dir, toP));
  float w0 = 0.005 + 0.004 * fract(aSeed.w * 3.7);
  float w = max(w0, dist * uPix * 0.75);
  vec3 wp = p + dir * (len * (uv.y - 0.5)) + side * (w * uv.x);
  float a = (w0 / w) * smoothstep(0.7, 2.6, dist) * (1.0 - smoothstep(0.38, 0.5, dist / uBox.x));
  float c = dot(toP / max(dist, 1e-3), uSunDir);
  vec3 world = vec3(wp.x, wp.y, -wp.z);
  vWorldPos = world;
  vNormal = vec3(0.0, 1.0, 0.0);
  vUV = uv;
  vColor = vec4(uAmb + uSunCol * wPhase(c), a * (0.55 + 0.45 * fract(aSeed.w * 13.3)));
  vTangent = vec4(1.0, 0.0, 0.0, 1.0);
  gl_Position = kill > 0.5 ? vec4(2.0, 2.0, 2.0, 1.0) : pot_ViewProj * vec4(world, 1.0);
}
