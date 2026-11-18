// 原版海面 kb 顶点部分（pretty.js CR）机械移植：4 个 Gerstner 波，离码头 (30, 0) 50..220 m 内逐渐衰减到 0。
// 计算在原版 three 坐标下进行：swp = (x, y, -z)，位移的 z 分量转回 Unity 时取反。
// 常量由原版 B1 表按 fi() 格式化生成（方向已归一化，k = 2π/λ，ω = sqrt(9.81k)）。
#include <pot/varyings>

out vec3 vGWorld;
out float vSAmp;

void main() {
  float uTime = pot_Time.x;
  vec4 world = pot_Model * vec4(pot_Position, 1.0);
  vec3 swp = vec3(world.x, world.y, -world.z);
  vSAmp = 1.0 - smoothstep(50.0, 220.0, distance(swp.xz, vec2(30.0, 0.0)));
  vec3 sdisp = vec3(0.0);
  { float ph = 0.66139 * dot(vec2(-0.92069, 0.39029), swp.xz) - 2.54720 * uTime; sdisp.y += 0.06000 * sin(ph); sdisp.xz += vec2(-0.92069, 0.39029) * (0.03600 * cos(ph)); }
  { float ph = 1.10231 * dot(vec2(-0.75071, -0.66063), swp.xz) - 3.28842 * uTime; sdisp.y += 0.04000 * sin(ph); sdisp.xz += vec2(-0.75071, -0.66063) * (0.02400 * cos(ph)); }
  { float ph = 1.90400 * dot(vec2(-0.99273, 0.12033), swp.xz) - 4.32183 * uTime; sdisp.y += 0.02600 * sin(ph); sdisp.xz += vec2(-0.99273, 0.12033) * (0.01560 * cos(ph)); }
  { float ph = 3.14159 * dot(vec2(-0.49828, 0.86701), swp.xz) - 5.55149 * uTime; sdisp.y += 0.01600 * sin(ph); sdisp.xz += vec2(-0.49828, 0.86701) * (0.00960 * cos(ph)); }
  sdisp *= vSAmp;
  // 原版 vGWorld 取位移前的位置（片元的斜率、泡沫都按它计算）
  vGWorld = swp;
  world.xyz += vec3(sdisp.x, sdisp.y, -sdisp.z);
  vWorldPos = world.xyz;
  vNormal = vec3(0.0, 1.0, 0.0);
  vUV = pot_UV;
  vColor = vec4(1.0);
  vTangent = vec4(1.0, 0.0, 0.0, 1.0);
  gl_Position = pot_ViewProj * world;
}
