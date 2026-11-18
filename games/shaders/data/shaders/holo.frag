// 全息：边缘发光 + 滚动扫描线（叠加混合）
#include <pot/varyings>

uniform vec4 uColor;

out vec4 fragColor;

void main() {
  vec3 v = normalize(pot_CameraPos.xyz - vWorldPos);
  float rim = pow(1.0 - abs(dot(normalize(vNormal), v)), 2.5);
  float scan = smoothstep(0.35, 0.5, fract(vWorldPos.y * 6.0 - pot_Time.x * 1.5));
  float k = rim * 2.0 + scan * 0.35;
  fragColor = vec4(uColor.rgb * k * 2.0, 1.0);
}
