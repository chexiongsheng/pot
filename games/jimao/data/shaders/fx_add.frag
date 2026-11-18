// 原版加法粒子片元（pretty.js WR）机械移植：水珠、涟漪环、火花、闪光。绑定 blend: add（alpha 恒为 1 → One, One）。
#include <pot/varyings>

uniform sampler2D uTex;

out vec4 fragColor;

void main() {
  float t = texture(uTex, vUV).r;
  float k = t * vColor.a;
  if (k < 0.002) discard;
  fragColor = vec4(vColor.rgb * k, 1.0);
}
