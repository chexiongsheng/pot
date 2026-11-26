// 原版雨滴片元（pretty.js FR）：横向收窄、两端淡出；颜色与透明度来自顶点（vColor）。叠加混合，不受雾影响。
#include <pot/varyings>

out vec4 fragColor;

void main() {
  float x = 1.0 - abs(vUV.x) * 2.0;
  float e = smoothstep(0.0, 0.12, vUV.y) * smoothstep(1.0, 0.55, vUV.y);
  fragColor = vec4(vColor.rgb, vColor.a * x * e);
}
