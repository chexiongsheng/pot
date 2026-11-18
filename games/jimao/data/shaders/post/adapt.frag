// 自动曝光与太阳遮挡（原版 eA）：中心加权对数平均亮度 + 12 点深度测试太阳可见度，按时间常数平滑
// 输出到 1x1 的 history 目标：r = 平均亮度，g = 太阳可见度
#include <pot/post>
#include "common.glsl"
uniform sampler2D tPrev, tLum, tDepth;
uniform float uRate, uVisRate;
out vec4 fragColor;
void main() {
  float ls = 0.0, ws = 0.0;
  for (int y = 0; y < 5; y++) for (int x = 0; x < 7; x++) {
    vec2 uv = (vec2(float(x), float(y)) + 0.5) / vec2(7.0, 5.0);
    float w = 1.0 - 0.75 * smoothstep(0.1, 0.55, length(uv - 0.5));
    float l = luma(texture(tLum, uv).rgb);
    ls += log(max(l, 1e-4)) * w;
    ws += w;
  }
  float avg = clamp(exp(ls / ws), 0.002, 40.0);
  vec2 ds = vec2(textureSize(tDepth, 0));
  float aspect = ds.x / max(ds.y, 1.0);
  vec3 sun = sunScreen();
  float vis = 0.0;
  for (int i = 0; i < 12; i++) {
    float r = sqrt((float(i) + 0.5) / 12.0) * 0.011;
    float th = float(i) * 2.39996323;
    vec2 uv = sun.xy + vec2(cos(th) / aspect, sin(th)) * r;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) vis += 1.0;
    else vis += pot_IsSky(texture(tDepth, uv).r) ? 1.0 : 0.0;
  }
  vis = vis / 12.0 * sun.z;
  vec4 prev = texture(tPrev, vec2(0.5));
  // 目标新建时为透明黑：首帧直接取当前值
  bool first = !(prev.r > 0.0) || prev.r > 1e4;
  float a = first ? avg : mix(prev.r, avg, uRate);
  float v = first ? vis : mix(prev.g, vis, uVisRate);
  fragColor = vec4(a, v, 0.0, 1.0);
}
