// 横向变形光斑（原版 Q6）：15 tap 高斯，减去随曝光换算的阈值
#include <pot/post>
#include "common.glsl"
uniform sampler2D tSrc;
uniform float uDirPx, uThreshold;
out vec4 fragColor;
void main() {
  float thr = uThreshold / max(slExposure(), 0.2);
  vec2 dir = vec2(uDirPx * pot_ScreenSize.z, 0.0);
  vec3 acc = vec3(0.0);
  float ws = 0.0;
  for (int i = -7; i <= 7; i++) {
    float x = float(i);
    float w = exp(-x * x / 18.0);
    vec3 c = max(texture(tSrc, vUv + dir * x).rgb - vec3(thr), vec3(0.0));
    acc += c * w;
    ws += w;
  }
  fragColor = vec4(acc / ws, 1.0);
}
