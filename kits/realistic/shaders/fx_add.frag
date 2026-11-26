// 原版加法粒子片元（pretty.js WR）机械移植：水珠、涟漪环、火花、闪光。绑定 blend: add（alpha 恒为 1 → One, One）。
// softFade：贴近背后不透明表面时淡出（读场景深度，需透明队列）。
#include <pot/varyings>
#include <pot/depth>

uniform sampler2D uTex;

in float vSoftD;

out vec4 fragColor;

void main() {
  float t = texture(uTex, vUV).r;
  float k = t * vColor.a * pot_SoftFade(vWorldPos, vSoftD);
  if (k < 0.002) discard;
  fragColor = vec4(vColor.rgb * k, 1.0);
}
