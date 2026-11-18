// 原版海面 kb 片元部分（pretty.js zR/DR/LR + 太阳闪光）机械移植；光照走 <pot/lit>。
// 坐标：vGWorld 为原版 three 世界坐标（位移前），法线 three (-gNxz.x, 1, -gNxz.y) → Unity (-gNxz.x, 1, gNxz.y)。
// 与原版的差异：
// - 原版 gOcc 乘在直射 radiance 与漫反射 IBL 上（不影响镜面 IBL）；这里折算为 albedo 与 s.specular 乘 gOcc，s.ao 保持 1
// - 原版 directSpecular 先对所有光源求和再钳到 40；这里按光源逐个钳（s.specularMax）
#include <pot/varyings>
#include <pot/lit>

uniform sampler2D uDetail, uDetailN;
uniform vec3 uHazeA, uHazeB;

in vec3 vGWorld;
in float vSAmp;

out vec4 fragColor;

void main() {
  vec3 cameraPosition = vec3(pot_CameraPos.x, pot_CameraPos.y, -pot_CameraPos.z);
  vec3 uSunDirW = vec3(pot_SunDir.x, pot_SunDir.y, -pot_SunDir.z);
  float uTime = pot_Time.x;
  vec3 diffuseColor = vec3(1.0);
  float gRough; vec2 gNxz; float gOcc; float gSDist; float gSpark;
  // ===== DR =====
  {
    vec2 sxz = vGWorld.xz;
    float sd = length(cameraPosition - vGWorld); gSDist = sd;
    vec2 slopeA = vec2(0.0), slopeB = vec2(0.0);
    slopeA += vec2(-0.92069, 0.39029) * (0.03968 * cos(0.66139 * dot(vec2(-0.92069, 0.39029), sxz) - 2.54720 * uTime));
    slopeA += vec2(-0.75071, -0.66063) * (0.04409 * cos(1.10231 * dot(vec2(-0.75071, -0.66063), sxz) - 3.28842 * uTime));
    slopeA += vec2(-0.99273, 0.12033) * (0.04950 * cos(1.90400 * dot(vec2(-0.99273, 0.12033), sxz) - 4.32183 * uTime));
    slopeA += vec2(-0.49828, 0.86701) * (0.05027 * cos(3.14159 * dot(vec2(-0.49828, 0.86701), sxz) - 5.55149 * uTime));
    slopeB += vec2(-0.80000, 0.60000) * (0.09593 * cos(4.79632 * dot(vec2(-0.80000, 0.60000), sxz) - 6.85944 * uTime));
    slopeB += vec2(-0.95067, -0.31022) * (0.10598 * cos(7.57010 * dot(vec2(-0.95067, -0.31022), sxz) - 8.61758 * uTime));
    slopeB += vec2(-0.34894, -0.93715) * (0.11023 * cos(11.02313 * dot(vec2(-0.34894, -0.93715), sxz) - 10.39889 * uTime));
    slopeB += vec2(-0.60000, 0.80000) * (0.11278 * cos(16.11073 * dot(vec2(-0.60000, 0.80000), sxz) - 12.57165 * uTime));
    slopeB += vec2(-0.99875, 0.04994) * (0.11636 * cos(23.27106 * dot(vec2(-0.99875, 0.04994), sxz) - 15.10924 * uTime));
    slopeB += vec2(0.30113, 0.95358) * (0.08021 * cos(13.36848 * dot(vec2(0.30113, 0.95358), sxz) - 11.45185 * uTime));
    slopeB += vec2(-0.86013, -0.51008) * (0.10472 * cos(29.91993 * dot(vec2(-0.86013, -0.51008), sxz) - 17.13227 * uTime));
    float nearB = 1.0 - smoothstep(25.0, 110.0, sd);
    vec2 t1 = texture(uDetailN, sxz * 0.113 + uTime * vec2(-0.021, 0.009)).ba - 0.5;
    vec2 t2 = texture(uDetailN, sxz * 0.031 + uTime * vec2(-0.007, -0.004)).ba - 0.5;
    vec2 t3 = texture(uDetailN, sxz.yx * 0.39 + uTime * vec2(0.031, -0.027)).ba - 0.5;
    gNxz = slopeA * vSAmp + slopeB * nearB + t1 * 0.2 + t2 * 0.24 + t3 * 0.1 * nearB;
    // 码头墙（x = 30）与系泊船体 x[33,49] z[-60,-9] 周围的泡沫、浮渣
    float dq = sxz.x - 30.0;
    vec2 hq = abs(sxz - vec2(41.0, -34.5)) - vec2(4.0, 21.5);
    float dh = length(max(hq, 0.0)) + min(max(hq.x, hq.y), 0.0) - 4.0;
    float de = min(dq, dh);
    vec4 fn = texture(uDetail, sxz * 0.41 + uTime * vec2(-0.012, 0.007));
    vec4 fn2 = texture(uDetail, sxz * 0.093 + uTime * vec2(0.004, 0.003));
    float band = 1.0 - smoothstep(0.0, 0.2 + fn2.g * fn2.g * 2.2, de);
    float foam = clamp(band * smoothstep(0.5, 0.68, fn.a * 0.55 + fn.r * 0.25 + fn2.g * 0.3 + band * 0.2), 0.0, 1.0) * step(-0.3, de);
    float scum = (1.0 - smoothstep(0.0, 5.0, de)) * smoothstep(0.4, 0.7, fn2.g);
    vec3 alb = vec3(0.0045, 0.013, 0.017);
    alb = mix(alb, vec3(0.03, 0.04, 0.034), scum * 0.6);
    alb = mix(alb, vec3(0.3, 0.32, 0.3), foam * 0.7);
    diffuseColor.rgb *= alb;
    // 风的结构：大片猫爪风区（更皱、更暗、更钝）与平静油膜相间，再加长涌浪明暗
    vec4 fn3 = texture(uDetail, sxz * 0.0123 + uTime * vec2(0.0016, 0.0011));
    float gust = smoothstep(0.38, 0.62, fn2.g * 0.45 + fn3.g * 0.75 - 0.1);
    float swell = sin(dot(sxz, vec2(-0.118, 0.05)) - uTime * 0.55 + fn3.a * 5.0) * 0.5 + 0.5;
    gNxz = gNxz * mix(0.4, 1.35, gust) + vec2(-0.92, 0.39) * (swell - 0.5) * 0.07;
    gSpark = mix(0.55, 1.0, swell) * mix(1.0, 0.6, gust);
    diffuseColor.rgb *= mix(1.0, 0.6, gust);
    gRough = mix(mix(0.1, 0.32, smoothstep(12.0, 380.0, sd)) * mix(0.62, 1.5, gust), 0.65, max(foam, scum * 0.3));
    gNxz *= 1.0 - foam * 0.6;
    gOcc = mix(0.3, 1.0, smoothstep(0.0, 8.0, de)) * mix(0.8, 1.05, swell);
  }
  // 太阳闪光：沿太阳方位最强，两侧减弱；被涌浪与风区打散
  vec3 sv = normalize(vGWorld - cameraPosition);
  float az = max(dot(normalize(sv.xz + vec2(1e-5)), normalize(uSunDirW.xz)), 0.0);
  // ===== 光照（原版 MeshStandardMaterial roughness 0.1 → pot_LitColor） =====
  PotSurface s = pot_DefaultSurface(normalize(vec3(-gNxz.x, 1.0, gNxz.y)));
  s.albedo = diffuseColor * gOcc;
  s.roughness = gRough;
  s.metallic = 0.0;
  s.specular = gOcc * gSpark * mix(0.3, 1.0, az * az * az);
  s.specularMax = 40.0;
  vec3 outgoingLight = pot_LitColor(s, vWorldPos);
  // ===== LR：远处雾霭（朝太阳偏暖，背太阳偏冷） =====
  {
    float toSun = pow(max(dot(normalize(sv.xz + vec2(1e-5)), normalize(uSunDirW.xz)), 0.0), 3.0);
    vec3 hz = mix(uHazeA, uHazeB, toSun);
    outgoingLight = mix(outgoingLight, hz, smoothstep(220.0, 860.0, gSDist) * 0.8);
  }
  fragColor = vec4(pot_ApplyFog(outgoingLight, vWorldPos), 1.0);
}
