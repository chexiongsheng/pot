// 原版溅射片元（pretty.js NR）：小水冠 + 中心水柱（dots 在原版里乘 0，保留以便对照）。
#include <pot/varyings>

in float vLife;

out vec4 fragColor;

void main() {
  float x = vUV.x * 2.0, y = vUV.y;
  float dome = smoothstep(1.0, 0.25, length(vec2(x * 1.15, y * 1.5)));
  float crown = dome * (0.35 + 0.65 * smoothstep(0.25, 0.75, length(vec2(x, y * 1.4))));
  float core = smoothstep(0.5, 0.0, length(vec2(x * 1.6, (y - 0.25) * 1.6))) * (1.0 - vLife);
  float dots = smoothstep(0.16, 0.05, length(vec2(abs(x) - 0.75, y - 0.82))) + smoothstep(0.14, 0.04, length(vec2(x - 0.2, y - 0.93)));
  float a = clamp(crown * 0.5 + core * 0.8 + dots * 0.0, 0.0, 1.0) * vColor.a * 0.6;
  if (a < 0.003) discard;
  fragColor = vec4(vColor.rgb, a);
}
