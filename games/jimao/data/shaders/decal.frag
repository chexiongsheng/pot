// 弹孔贴花（原版 fx_decals：MeshStandardMaterial + map / roughnessMap(G) / metalnessMap(B) / normalMap，vertexColors，透明）
// 没有切线属性：用屏幕导数重建切线框架（Mikkelsen cotangent frame），切线方向 = dP/du，副切线 = dP/dv。
#include <pot/varyings>
#include <pot/lit>

uniform sampler2D uMap, uOrm, uNrm;

out vec4 fragColor;

void main() {
  vec4 albedo = texture(uMap, vUV);
  float a = albedo.a * vColor.a;
  if (a < 0.004) discard;
  vec3 orm = texture(uOrm, vUV).rgb;
  vec3 N = normalize(vNormal);
  vec3 dp1 = dFdx(vWorldPos), dp2 = dFdy(vWorldPos);
  vec2 duv1 = dFdx(vUV), duv2 = dFdy(vUV);
  vec3 dp2perp = cross(dp2, N), dp1perp = cross(N, dp1);
  vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
  vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;
  float inv = inversesqrt(max(max(dot(T, T), dot(B, B)), 1e-20));
  vec3 tn = texture(uNrm, vUV).xyz * 2.0 - 1.0;
  vec3 n = normalize(T * inv * tn.x + B * inv * tn.y + N * tn.z);
  PotSurface s = pot_DefaultSurface(n);
  s.albedo = albedo.rgb * vColor.rgb;
  s.roughness = clamp(orm.g, 0.04, 1.0);
  s.metallic = orm.b;
  s.alpha = a;
  fragColor = pot_Lit(s, vWorldPos);
  fragColor.a = a;
}
