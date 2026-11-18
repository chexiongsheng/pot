// 陶土：棋盘格 UV + 光照库
#include <pot/varyings>
#include <pot/lit>

uniform vec4 uTint;

out vec4 fragColor;

void main() {
  vec2 c = floor(vUV * 4.0);
  float checker = mod(c.x + c.y, 2.0);
  PotSurface s = pot_DefaultSurface(normalize(vNormal));
  s.albedo = uTint.rgb * mix(0.55, 1.0, checker);
  s.roughness = 0.7;
  fragColor = pot_Lit(s, vWorldPos);
}
