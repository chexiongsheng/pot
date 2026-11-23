// 最终（原版 iA）：FXAA、轻度锐化、胶片颗粒、抖动（都在 sRGB 编码空间），最后转回线性写回相机画面
// （链生效时 URP 后处理关闭，最终 blit 负责线性 → sRGB）
#include <pot/post>
#include "common.glsl"
uniform sampler2D tSrc;
uniform float uGrain, uSharpen, uFxaa;
out vec4 fragColor;
void main() {
  vec2 uTexel = pot_ScreenSize.zw;
  vec4 M = texture(tSrc, vUv);
  vec3 col = M.rgb;
  vec4 NW = texture(tSrc, vUv + vec2(-1.0, -1.0) * uTexel), NE = texture(tSrc, vUv + vec2(1.0, -1.0) * uTexel);
  vec4 SW = texture(tSrc, vUv + vec2(-1.0, 1.0) * uTexel), SE = texture(tSrc, vUv + vec2(1.0, 1.0) * uTexel);
  float lMin = min(M.a, min(min(NW.a, NE.a), min(SW.a, SE.a)));
  float lMax = max(M.a, max(max(NW.a, NE.a), max(SW.a, SE.a)));
  float contrast = lMax - lMin;
  if (uFxaa > 0.5 && contrast > max(0.0312, lMax * 0.10)) {
    vec2 dir = vec2(-((NW.a + NE.a) - (SW.a + SE.a)), (NW.a + SW.a) - (NE.a + SE.a));
    float dirReduce = max((NW.a + NE.a + SW.a + SE.a) * 0.03125, 0.0078125);
    float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
    dir = clamp(dir * rcp, vec2(-8.0), vec2(8.0)) * uTexel;
    vec4 A = 0.5 * (texture(tSrc, vUv + dir * (1.0 / 3.0 - 0.5)) + texture(tSrc, vUv + dir * (2.0 / 3.0 - 0.5)));
    vec4 B = A * 0.5 + 0.25 * (texture(tSrc, vUv - dir * 0.5) + texture(tSrc, vUv + dir * 0.5));
    col = (B.a < lMin || B.a > lMax) ? A.rgb : B.rgb;
  }
  vec3 blur = (NW.rgb + NE.rgb + SW.rgb + SE.rgb) * 0.25;
  col += (M.rgb - blur) * uSharpen * (1.0 - smoothstep(0.04, 0.22, contrast));
  vec2 seed = gl_FragCoord.xy + fract(pot_Time.x * vec2(7.31, 3.17)) * vec2(311.7, 173.3);
  float g = hash12(seed) + hash12(seed + 57.3) - 1.0;
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col += g * uGrain * mix(1.0, 0.30, smoothstep(0.25, 0.9, l)) * (0.35 + 0.65 * smoothstep(0.0, 0.08, l));
  col += (hash12(gl_FragCoord.xy * 1.37 + 11.0) + hash12(gl_FragCoord.xy * 0.71 + 3.0) - 1.0) / 255.0;
  fragColor = vec4(toLinear(clamp(col, 0.0, 1.0)), 1.0);
}
