// 原版粒子顶点着色器（pretty.js HR）机械移植。原版是实例化四边形；这里每粒子 4 个顶点、中心相同，
// 由 fx.ts 打包：pot_Position = 中心，pot_UV = (mode·32 + frame·4 + 角点, size)，
// pot_Normal = mode 1 时拉伸轴，否则 (roll, age, shade)；pot_VertexColor.rgb 被 Runner 当 sRGB 转过线性，这里逆变换取回。
// 全部在 Unity 世界坐标下计算（相机右/上取自 pot_View 前两行，与原版 viewMatrix 写法相同）。
#include <pot/varyings>

uniform vec2 uAtlas;

out vec3 vOff;
out vec3 vToCam;
out vec3 vInfo;     // 视深, age, shade
out vec3 vT;
out vec3 vB;

vec3 rawCol(vec3 l) {
  vec3 lo = l * 12.92, hi = 1.055 * pow(max(l, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), l));
}

void main() {
  float code = floor(pot_UV.x + 0.5);
  float mode = floor(code / 32.0);
  float rest = code - mode * 32.0;
  float frame = floor(rest / 4.0);
  float k = rest - frame * 4.0;
  vec2 c = vec2((k > 0.5 && k < 2.5) ? 0.5 : -0.5, k > 1.5 ? 0.5 : -0.5);
  vec3 center = pot_Position; float size = pot_UV.y;
  vec3 camR = vec3(pot_View[0][0], pot_View[1][0], pot_View[2][0]);
  vec3 camU = vec3(pot_View[0][1], pot_View[1][1], pot_View[2][1]);
  vec3 toCam = pot_CameraPos.xyz - center; float dist = length(toCam); toCam /= max(dist, 1e-4);
  float roll = mode > 0.5 && mode < 1.5 ? 0.0 : pot_Normal.x;
  float sn = sin(roll), cs = cos(roll);
  vec2 rc = vec2(c.x * cs - c.y * sn, c.x * sn + c.y * cs);
  vec3 off; float comp = 1.0;
  vec3 T, B;
  if (mode < 0.5) {
    off = (camR * rc.x + camU * rc.y) * size;
    T = camR * cs + camU * sn; B = camU * cs - camR * sn;
  } else if (mode < 1.5) {
    float uPx = 2.0 / (abs(pot_Proj[1][1]) * max(1.0, pot_ScreenSize.y));
    vec3 axis = pot_Normal;
    float len = length(axis); vec3 d = axis / max(len, 1e-5);
    vec3 side = cross(d, toCam); float sl = length(side); side = sl > 1e-3 ? side / sl : camR;
    float w = max(size, dist * uPx * 1.4); comp = size / w;
    off = d * (c.x * max(len, w)) + side * (c.y * w);
    T = d; B = side;
  } else {
    vec3 n = vec3(0.0, 1.0, 0.0);
    vec3 t = vec3(0.0, 0.0, -1.0);
    vec3 b = cross(n, t);
    off = (t * rc.x + b * rc.y) * size;
    T = t * cs + b * sn; B = b * cs - t * sn;
  }
  vec3 world = center + off;
  vec4 mv = pot_View * vec4(world, 1.0);
  gl_Position = pot_ViewProj * vec4(world, 1.0);
  float col = mod(frame, uAtlas.x), row = floor(frame / uAtlas.x);
  vUV = (vec2(col, row) + c + 0.5) / uAtlas;
  vColor = vec4(rawCol(pot_VertexColor.rgb) * comp, pot_VertexColor.a);
  vWorldPos = world;
  vNormal = toCam;
  vTangent = vec4(T, 1.0);
  vOff = off / max(size, 1e-4);
  vToCam = toCam;
  vInfo = vec3(abs(mv.z), mode < 0.5 ? pot_Normal.y : 0.0, mode < 0.5 ? pot_Normal.z : 1.0);
  vT = T; vB = B;
}
