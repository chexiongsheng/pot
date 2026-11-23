// bloom 升采样（原版 K6）：tent 9 tap，与上一级按 uMix 混合
#include <pot/post>
uniform sampler2D tLow, tHigh;
uniform float uMix;
out vec4 fragColor;
void main() {
  vec2 o = 1.0 / vec2(textureSize(tLow, 0));
  vec3 t = texture(tLow, vUv).rgb * 4.0;
  t += (texture(tLow, vUv + vec2(o.x, 0.0)).rgb + texture(tLow, vUv - vec2(o.x, 0.0)).rgb + texture(tLow, vUv + vec2(0.0, o.y)).rgb + texture(tLow, vUv - vec2(0.0, o.y)).rgb) * 2.0;
  t += texture(tLow, vUv + o).rgb + texture(tLow, vUv - o).rgb + texture(tLow, vUv + vec2(o.x, -o.y)).rgb + texture(tLow, vUv + vec2(-o.x, o.y)).rgb;
  t *= 1.0 / 16.0;
  fragColor = vec4(mix(texture(tHigh, vUv).rgb, t, uMix), 1.0);
}
