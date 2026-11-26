// 体积光（移植原版 $6 的太阳光柱部分）：沿视线 raymarch 主光阴影图，输出散射进视线的太阳光（线性 HDR）
// 只取光柱项；环境散射与远景雾仍由 Runner 的高度雾负责，避免重复叠加。grade 按 uVol 加回画面
#include <pot/post>
#include <pot/shadow>
#include "common.glsl"
uniform sampler2D tDepth;
uniform float uVolSigma, uVolMaxDist;
out vec4 fragColor;

const int VOL_STEPS = 24;
float shape(float h) { return 0.30 + 0.70 * exp(-max(h, 0.0) / 5.5); }
float hg(float mu, float g) { float g2 = g * g; return (1.0 - g2) / (12.566371 * pow(max(1.0 + g2 - 2.0 * g * mu, 1e-4), 1.5)); }

void main() {
  float raw = texture(tDepth, vUv).r;
  bool sky = pot_IsSky(raw);
  vec3 cam = pot_CameraPos.xyz;
  vec3 end = sky ? cam + pot_ViewDir(vUv) * uVolMaxDist : pot_WorldPos(vUv, raw);
  vec3 rd = normalize(end - cam);
  float maxD = min(length(end - cam), sky ? uVolMaxDist * 0.55 : uVolMaxDist);
  float mu = dot(rd, normalize(pot_SunDir.xyz));
  // 双瓣相位：前向窄瓣给朝太阳的金色辉光，宽瓣让侧光下的光柱也看得见
  float ph = min(hg(mu, 0.78) * 0.55 + hg(mu, 0.25) * 0.45, 1.15);
  float j = ign(gl_FragCoord.xy + fract(pot_Time.x * 7.0) * 64.0);
  float acc = 0.0, T = 1.0, tPrev = 0.0;
  for (int i = 0; i < VOL_STEPS; i++) {
    float f = (float(i) + 1.0) / float(VOL_STEPS);
    float t1 = maxD * f * (0.35 + 0.65 * f);  // 近处采样更密
    float ds = t1 - tPrev;
    float t = tPrev + ds * j;
    vec3 p = cam + rd * t;
    float ext = uVolSigma * shape(p.y);
    float Ti = exp(-ext * ds);
    float nearW = mix(2.3, 0.55, smoothstep(4.0, 85.0, t));
    acc += T * ph * pot_SunVisibility(p) * nearW * (1.0 - Ti);
    T *= Ti;
    tPrev = t1;
  }
  fragColor = vec4(pot_SunColor.rgb * acc, 1.0);
}
