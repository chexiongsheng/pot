// 原版远景闪灯片元：顶点色 × 闪烁系数，不受雾和光照影响。
#include <pot/varyings>

in float vBlink;

out vec4 fragColor;

void main() {
  fragColor = vec4(vColor.rgb * vBlink, 1.0);
}
