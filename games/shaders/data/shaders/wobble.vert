// 摆动：按高度沿 x 方向正弦位移（自定义顶点着色器，输出与 <pot/standard.vert> 相同的 varyings）
#include <pot/varyings>

uniform float uAmount;

void main() {
  vec3 p = pot_Position;
  p.x += sin(p.y * 4.0 + pot_Time.x * 3.0) * uAmount;
  vec4 world = pot_Model * vec4(p, 1.0);
  vWorldPos = world.xyz;
  vNormal = normalize(pot_NormalMatrix * pot_Normal);
  vUV = pot_UV;
  vColor = pot_VertexColor;
  vTangent = vec4(0.0);
  gl_Position = pot_ViewProj * world;
}
