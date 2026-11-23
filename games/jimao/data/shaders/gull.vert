// 原版海鸥（wb：MeshBasicMaterial + onBeforeCompile，双面、无雾）机械移植。
// 每只 6 个顶点；pot_Position 为原版 three 坐标下的局部位置（y 预先减了 60），不做 z 取反。
//   aOrbit = (盘旋中心 xyz, 半径)
//   aPar   = (角速度（符号为方向）, 初相, 扑翼频率, 是否翼尖)
// 计算全在原版 three 坐标下进行，最后 z 取反转回 Unity。
#include <pot/varyings>

void main() {
  float uTime = pot_Time.x;
  float ga = aPar.y + uTime * aPar.x;
  float gdir = sign(aPar.x);
  vec3 gfw = vec3(-sin(ga), 0.0, cos(ga)) * gdir;
  vec3 grt = vec3(gfw.z, 0.0, -gfw.x);
  vec3 wl = pot_Position + vec3(0.0, 60.0, 0.0);
  float glide = smoothstep(-0.2, 0.5, sin(uTime * 0.31 + aPar.y * 3.0));
  float gflap = sin(uTime * aPar.z + aPar.y * 7.0) * mix(0.12, 0.55, glide) + 0.18;
  wl.y += aPar.w * gflap * abs(wl.z);
  wl.z *= mix(1.0, 0.86, aPar.w * abs(gflap));
  vec3 gc = aOrbit.xyz + vec3(cos(ga), 0.0, sin(ga)) * aOrbit.w + vec3(0.0, sin(ga * 0.7 + aPar.y) * 2.2 + sin(uTime * 0.23 + aPar.y) * 1.5, 0.0);
  vec3 p = gc + gfw * wl.x + grt * wl.z + vec3(0.0, wl.y - 0.3 * gdir * wl.z, 0.0);
  vec4 world = pot_Model * vec4(p.x, p.y, -p.z, 1.0);
  vWorldPos = world.xyz;
  vNormal = vec3(0.0, 1.0, 0.0);
  vUV = vec2(0.0);
  vColor = vec4(1.0);
  vTangent = vec4(1.0, 0.0, 0.0, 1.0);
  gl_Position = pot_ViewProj * world;
}
