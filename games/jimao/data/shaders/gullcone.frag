// 原版飞鸥探照灯光锥（ShaderMaterial，AdditiveBlending、DoubleSide、无雾）机械移植。
// vT = 1 - uv.y：锥尖（灯口）为 0，底面为 1；边缘按视线与法线夹角淡出。
#include <pot/varyings>

uniform vec3 uColor;
uniform float uGain;

out vec4 fragColor;

void main() {
  vec3 vV = pot_CameraPos.xyz - vWorldPos;
  float f = abs(dot(normalize(vNormal), normalize(vV)));
  f = f * f * (3.0 - 2.0 * f);
  float t = clamp(1.0 - vUV.y, 0.0, 1.0);
  float k = pow(1.0 - t, 1.7) * (0.35 + 0.65 * smoothstep(0.0, 0.06, t));
  fragColor = vec4(uColor * (uGain * f * k), 1.0);
}
