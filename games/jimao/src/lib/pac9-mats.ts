/**
 * 枪模 PAC-9 材质：原版 three MeshStandardMaterial + Bf 细节补丁（onBeforeCompile 原文，pretty.js AC / RC / CC）。
 * 由 gfx.standard（three 方言）直接编译，不做任何改写；uRain 对应原版 Wv（setWetness）。
 */
import type { Context, StandardMaterial, ThreeShaderObject, ThreeUniform } from '@pot/core'

const AC = `
varying vec3 vObjP; varying vec3 vWNrm; varying vec3 vONrm; uniform float uKind; uniform float uRain;
float dh3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float dn3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dh3(i), dh3(i + vec3(1,0,0)), f.x), mix(dh3(i + vec3(0,1,0)), dh3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(dh3(i + vec3(0,0,1)), dh3(i + vec3(1,0,1)), f.x), mix(dh3(i + vec3(0,1,1)), dh3(i + vec3(1,1,1)), f.x), f.y), f.z); }
vec2 dh2(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
vec2 dDrops(vec2 uv, float cell, float seed){ vec2 g = uv / cell, i = floor(g), f = fract(g); float best = 0.0;
  for (int a = -1; a <= 1; a++) for (int b = -1; b <= 1; b++) { vec2 o = vec2(float(a), float(b)); vec2 r = dh2(i + o + seed);
    float keep = step(0.70, fract(r.x * 7.31 + r.y * 3.17)); vec2 c = o + 0.2 + 0.6 * r; float rad = (0.16 + 0.22 * fract(r.x * 13.7)) * keep;
    float d = length(f - c); best = max(best, sqrt(max(rad * rad - d * d, 0.0))); }
  return vec2(best * cell, step(1e-6, best)); }
vec3 dBump(vec3 N, float h){ vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition); float dhx = dFdx(h), dhy = dFdy(h);
  vec3 r1 = cross(dpdy, N), r2 = cross(N, dpdx); float det = dot(dpdx, r1); vec3 g = sign(det) * (dhx * r1 + dhy * r2);
  return normalize(abs(det) * N - g); }
`

const RC = `
vec3 dP = vObjP; vec3 dAn = abs(vONrm);
vec2 dUV = (dAn.y > dAn.x && dAn.y > dAn.z) ? dP.xz : (dAn.x > dAn.z ? dP.zy : dP.xy);
float dSm = dn3(dP * 36.0), dSm2 = dn3(dP * 150.0 + 7.0), dFine = dn3(dP * 2400.0);
float dHt = 0.0, dR = 0.0;
if (uKind < 0.5) {
  float scuff = smoothstep(0.70, 0.9, dn3(dP * vec3(420.0, 420.0, 26.0) + 3.0));
  float smudge = smoothstep(0.55, 0.8, dn3(dP * 55.0 + 11.0));
  dR = (dSm - 0.5) * 0.20 + (dSm2 - 0.5) * 0.10 + (dFine - 0.5) * 0.08 + scuff * 0.18 - smudge * 0.12;
  dHt = dFine * 0.000010 - scuff * 0.000015;
} else if (uKind < 1.5) {
  float ring = sin(dP.z * 5200.0) * 0.5 + 0.5, streak = dn3(vec3(dP.z * 950.0, 1.0, 2.0));
  dR = (streak - 0.5) * 0.26 + (dSm - 0.5) * 0.14 + (dFine - 0.5) * 0.10;
  dHt = ring * 0.000014 + dFine * 0.000010;
} else {
  float st = dn3(dP * 1500.0) * 0.6 + dn3(dP * 3100.0 + 5.0) * 0.4;
  dR = (dSm - 0.5) * 0.18 + (st - 0.5) * 0.14 - smoothstep(0.6, 0.85, dSm2) * 0.10;
  dHt = st * 0.000075;
}
float dUp = smoothstep(0.30, 0.75, vWNrm.y) * uRain;
vec2 dD1 = dDrops(dUV, 0.0046, 3.0), dD2 = dDrops(dUV + 0.31, 0.0023, 9.0);
float dDrop = max(dD1.y, dD2.y) * dUp, dDropH = max(dD1.x, dD2.x) * dUp;
float dWet = dUp * (0.5 + 0.5 * smoothstep(0.3, 0.7, dSm));
roughnessFactor = clamp(roughnessFactor + dR, 0.10, 1.0);
roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.5, dWet);
roughnessFactor = mix(roughnessFactor, 0.10, dDrop);
diffuseColor.rgb *= 1.0 - 0.18 * dWet;
`

const CC = `
normal = dBump(normal, dHt + dDropH * 0.32);
`

/** 原版 Wv：所有 Bf 材质共享的湿度 */
export const wetness: ThreeUniform = { value: 1 }

/** 原版 Bf(material, kind) 的 onBeforeCompile */
export const bf = (kind: number) => (t: ThreeShaderObject) => {
  t.uniforms.uKind = { value: kind }, t.uniforms.uRain = wetness, t.vertexShader = t.vertexShader.replace('#include <common>', `#include <common>
varying vec3 vObjP; varying vec3 vWNrm; varying vec3 vONrm;`).replace('#include <begin_vertex>', `#include <begin_vertex>
vObjP = position; vONrm = normal; vWNrm = normalize(mat3(modelMatrix) * normal);`), t.fragmentShader = t.fragmentShader.replace('#include <common>', `#include <common>
` + AC).replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
` + RC).replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
` + CC)
}

export interface Pac9Materials {
  anodised: StandardMaterial
  phosphate: StandardMaterial
  polymer: StandardMaterial
  matte: StandardMaterial
  tan: StandardMaterial
}

/** 原版 dm 里的五种枪身材质（castShadow = false，receiveShadow = true） */
export function createPac9Materials(ctx: Context): Pac9Materials | undefined {
  const g = ctx.gfx
  const common = { vertexColors: true, castShadow: false } as const
  const m = {
    anodised: g.standard({ ...common, name: 'pac9_anodised', color: [0.0085, 0.009, 0.0105], roughness: 0.4, metalness: 0.45, onBeforeCompile: bf(0) }),
    matte: g.standard({ ...common, name: 'pac9_matte', color: 0xffffff, roughness: 0.92, metalness: 0 }),
    phosphate: g.standard({ ...common, name: 'pac9_phosphate', color: [0.016, 0.016, 0.0165], roughness: 0.5, metalness: 0.7, onBeforeCompile: bf(1) }),
    polymer: g.standard({ ...common, name: 'pac9_polymer', color: [0.0125, 0.0128, 0.0135], roughness: 0.62, metalness: 0, onBeforeCompile: bf(2) }),
    tan: g.standard({ ...common, name: 'pac9_polymer_tan', color: [0.105, 0.08, 0.05], roughness: 0.62, metalness: 0, onBeforeCompile: bf(2) }),
  }
  if (Object.values(m).some((x) => !x.ok)) return undefined
  return m
}
