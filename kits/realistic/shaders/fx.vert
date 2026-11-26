// 原版粒子顶点着色器（pretty.js HR）机械移植。原版是实例化四边形；这里每粒子 4 个顶点、中心相同，
// 由 fx.ts 打包（自定义顶点属性，Float32 原样传，不经色彩空间转换）：
//   pot_Position = 中心，pot_UV.x = 角点 0..3
//   aAxis = mode 1 时 (拉伸轴 xyz, size)，否则 (roll, 0, 0, size)
//   aCol  = rgb（HDR，可大于 1）+ a
//   aMisc = (frame, mode, age, shade)
// 全部在 Unity 世界坐标下计算（相机右/上取自 pot_View 前两行，与原版 viewMatrix 写法相同）。
#include <pot/varyings>

uniform vec2 uAtlas;

out vec3 vOff;
out vec3 vToCam;
out vec3 vInfo;     // 视深, age, shade
out vec3 vT;
out vec3 vB;
out float vSoftD;   // 软粒子淡出距离（原版 clamp(size·.4, .04, .7)）

void main() {
  float k = floor(pot_UV.x + 0.5);
  float frame = floor(aMisc.x + 0.5);
  float mode = floor(aMisc.y + 0.5);
  vec2 c = vec2((k > 0.5 && k < 2.5) ? 0.5 : -0.5, k > 1.5 ? 0.5 : -0.5);
  vec3 center = pot_Position; float size = aAxis.w;
  vec3 camR = vec3(pot_View[0][0], pot_View[1][0], pot_View[2][0]);
  vec3 camU = vec3(pot_View[0][1], pot_View[1][1], pot_View[2][1]);
  vec3 toCam = pot_CameraPos.xyz - center; float dist = length(toCam); toCam /= max(dist, 1e-4);
  float roll = mode > 0.5 && mode < 1.5 ? 0.0 : aAxis.x;
  float sn = sin(roll), cs = cos(roll);
  vec2 rc = vec2(c.x * cs - c.y * sn, c.x * sn + c.y * cs);
  vec3 off; float comp = 1.0;
  vec3 T, B;
  if (mode < 0.5) {
    off = (camR * rc.x + camU * rc.y) * size;
    T = camR * cs + camU * sn; B = camU * cs - camR * sn;
  } else if (mode < 1.5) {
    float uPx = 2.0 * pot_Camera.z * pot_Resolution.w;
    vec3 axis = aAxis.xyz;
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
  vColor = vec4(aCol.rgb * comp, aCol.a);
  vWorldPos = world;
  vNormal = toCam;
  vTangent = vec4(T, 1.0);
  vOff = off / max(size, 1e-4);
  vToCam = toCam;
  vInfo = vec3(abs(mv.z), mode < 0.5 ? aMisc.z : 0.0, mode < 0.5 ? aMisc.w : 1.0);
  vT = T; vB = B;
  vSoftD = clamp(size * 0.4, 0.04, 0.7);
}
