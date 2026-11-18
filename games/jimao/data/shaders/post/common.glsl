// 后处理公共函数（移植自原版 Js/Og 片段）
#ifndef JIMAO_POST_COMMON
#define JIMAO_POST_COMMON
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }

// 自动曝光：tAdapt 为 1x1 的 (平均亮度, 太阳可见度)
uniform sampler2D tAdapt;
uniform float uExposure, uKey, uMinE, uMaxE, uAuto;
float slExposure() {
  float a = texture(tAdapt, vec2(0.5)).r;
  return uExposure * mix(1.0, clamp(pow(uKey / max(a, 1e-4), 0.85), uMinE, uMaxE), uAuto);
}

// 太阳在屏幕上的位置：xy = uv，z = 在画面内的权重（相机背对太阳或远离画面边缘时为 0）
vec3 sunScreen() {
  vec3 s = pot_WorldToUv(pot_CameraPos.xyz + normalize(pot_SunDir.xyz) * 500.0);
  vec2 ndc = s.xy * 2.0 - 1.0;
  float on = s.z > 25.0 ? 1.0 - clamp((max(abs(ndc.x), abs(ndc.y)) - 1.0) / 0.3, 0.0, 1.0) : 0.0;
  return vec3(s.xy, on);
}
#endif
