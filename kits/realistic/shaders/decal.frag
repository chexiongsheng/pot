// 弹孔贴花（原版 fx_decals：MeshStandardMaterial + map / roughnessMap(G) / metalnessMap(B) / normalMap，vertexColors，透明）
// 切线来自网格的 tangents 属性（decals.ts 按贴花朝向写入）：T = dP/du，B = cross(N, T) * w = dP/dv。
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
  vec3 T = normalize(vTangent.xyz - N * dot(N, vTangent.xyz));
  vec3 B = cross(N, T) * vTangent.w;
  vec3 tn = texture(uNrm, vUV).xyz * 2.0 - 1.0;
  vec3 n = normalize(T * tn.x + B * tn.y + N * tn.z);
  PotSurface s = pot_DefaultSurface(n);
  s.albedo = albedo.rgb * vColor.rgb;
  s.roughness = clamp(orm.g, 0.04, 1.0);
  s.metallic = orm.b;
  s.alpha = a;
  fragColor = pot_Lit(s, vWorldPos);
  fragColor.a = a;
}
