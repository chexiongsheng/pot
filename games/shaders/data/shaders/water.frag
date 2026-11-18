// 水面：两层波纹法线 + 深浅色随视角混合 + 环境反射，alpha 随菲涅尔变化
#include <pot/varyings>
#include <pot/lit>

uniform vec4 uShallow;
uniform vec4 uDeep;

out vec4 fragColor;

vec2 waveGrad(vec2 p, float t) {
  float c1 = cos(p.x * 1.7 + t * 1.3), s1 = sin(p.x * 1.7 + t * 1.3);
  float c2 = cos(p.y * 1.3 - t * 0.9), s2 = sin(p.y * 1.3 - t * 0.9);
  float c3 = cos(p.x * 3.1 - p.y * 2.3 + t * 2.1);
  return vec2(1.7 * c1 * c2 + 1.55 * c3, -1.3 * s1 * s2 - 1.15 * c3) * 0.08;
}

void main() {
  float t = pot_Time.x;
  vec2 g = waveGrad(vWorldPos.xz, t);
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 v = normalize(pot_CameraPos.xyz - vWorldPos);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);

  PotSurface s = pot_DefaultSurface(n);
  s.albedo = mix(uDeep.rgb, uShallow.rgb, 0.5 + 0.5 * sin(dot(vWorldPos.xz, vec2(0.6, 0.4)) + t));
  s.roughness = 0.08;
  s.metallic = 0.0;
  s.alpha = mix(0.65, 0.95, fres);
  fragColor = pot_Lit(s, vWorldPos);
}
