// 地面：自定义着色器 + 光照库，接收主光阴影（pot_Lit 内部已乘 pot_Shadow）
#include <pot/varyings>
#include <pot/lit>

uniform vec4 uColor;

out vec4 fragColor;

void main() {
  vec2 g = abs(fract(vWorldPos.xz) - 0.5);
  float line = step(0.48, max(g.x, g.y));
  PotSurface s = pot_DefaultSurface(normalize(vNormal));
  s.albedo = uColor.rgb * mix(1.0, 0.7, line);
  s.roughness = 0.85;
  fragColor = pot_Lit(s, vWorldPos);
}
