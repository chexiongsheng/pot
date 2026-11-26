// 原版海鸥片元：纯色（线性），不受雾和光照影响。
#include <pot/varyings>

uniform vec3 uColor;

out vec4 fragColor;

void main() {
  fragColor = vec4(uColor, 1.0);
}
