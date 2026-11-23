// 原版远景闪灯（pb：MeshBasicMaterial + onBeforeCompile，无雾）机械移植。
// 自定义顶点属性（Float32 原样传，不经色彩空间转换）：
//   aLamp = 线性 HDR 颜色（原版顶点色，可远大于 1）
//   blink = (周期, 相位, 占空比)；周期 <= 0 时常亮
#include <pot/varyings>

out float vBlink;

void main() {
  float uTime = pot_Time.x;
  float bph = fract(uTime / max(blink.x, 0.001) + blink.y);
  vBlink = blink.x <= 0.0 ? 1.0 : mix(0.02, 1.0, smoothstep(0.0, 0.06, bph) * (1.0 - smoothstep(blink.z, blink.z + 0.12, bph)));
  vec4 world = pot_Model * vec4(pot_Position, 1.0);
  vWorldPos = world.xyz;
  vNormal = vec3(0.0, 1.0, 0.0);
  vUV = vec2(0.0);
  vColor = vec4(aLamp, 1.0);
  vTangent = vec4(1.0, 0.0, 0.0, 1.0);
  gl_Position = pot_ViewProj * world;
}
