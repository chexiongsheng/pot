/** 合成音效：资产即代码。已注册的片段跳过（热重载不重复合成） */
import type { Context } from '@pot/core'
import { rng } from './math'

const RATE = 22050

type Gen = (t: number, i: number, n: number) => number

function synth(seconds: number, gen: Gen) {
  const n = Math.floor(seconds * RATE)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = gen(i / RATE, i, n)
  return out
}

/** 单极点低通 */
function lowpass(data: Float32Array, k: number) {
  let y = 0
  for (let i = 0; i < data.length; i++) {
    y += (data[i] - y) * k
    data[i] = y
  }
  return data
}

function normalize(data: Float32Array, peak = 0.9) {
  let m = 0
  for (const v of data) m = Math.max(m, Math.abs(v))
  if (m > 0) for (let i = 0; i < data.length; i++) data[i] *= peak / m
  return data
}

/** 首尾交叉淡化，循环无缝 */
function loopable(data: Float32Array, fade = 0.15) {
  const f = Math.floor(data.length * fade)
  const out = data.slice(0, data.length - f)
  for (let i = 0; i < f; i++) {
    const t = i / f
    out[i] = out[i] * t + data[data.length - f + i] * (1 - t)
  }
  return out
}

const env = (t: number, attack: number, decay: number) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay))

const CLIPS: Record<string, () => Float32Array> = {
  shot() {
    const r = rng(11)
    const d = synth(0.32, (t) => {
      const noise = r() * 2 - 1
      return noise * env(t, 0.002, 0.045) * 0.9 + Math.sin(2 * Math.PI * 70 * t * (1 - t)) * env(t, 0.001, 0.08) * 0.8
    })
    return normalize(lowpass(d, 0.55))
  },
  dry() {
    return normalize(synth(0.06, (t) => (Math.sin(2 * Math.PI * 1800 * t) + Math.sin(2 * Math.PI * 2600 * t)) * env(t, 0.001, 0.01)), 0.5)
  },
  reload() {
    const r = rng(5)
    const click = (t: number, at: number, f: number) => (t > at ? Math.sin(2 * Math.PI * f * (t - at)) * Math.exp(-(t - at) / 0.015) + (r() * 2 - 1) * Math.exp(-(t - at) / 0.008) * 0.6 : 0)
    return normalize(synth(1.1, (t) => click(t, 0.05, 900) + click(t, 0.62, 700) + click(t, 0.95, 1300)), 0.6)
  },
  bolt() {
    return normalize(synth(0.22, (t) => {
      const f = 1600 - t * 5000
      return Math.sin(2 * Math.PI * f * t) * env(t, 0.003, 0.06) * 0.6 + Math.sign(Math.sin(2 * Math.PI * f * 0.5 * t)) * env(t, 0.002, 0.03) * 0.25
    }), 0.6)
  },
  houndShot() {
    const r = rng(23)
    return normalize(lowpass(synth(0.2, (t) => (r() * 2 - 1) * env(t, 0.002, 0.035) + Math.sin(2 * Math.PI * 320 * t) * env(t, 0.001, 0.04) * 0.5), 0.4), 0.7)
  },
  telegraph() {
    return normalize(synth(0.45, (t) => Math.sin(2 * Math.PI * (500 + t * 1400) * t) * Math.min(1, t * 20) * (1 - t / 0.45)), 0.35)
  },
  explode() {
    const r = rng(31)
    const d = synth(1.2, (t) => (r() * 2 - 1) * env(t, 0.005, 0.25) + Math.sin(2 * Math.PI * 45 * t) * env(t, 0.003, 0.3) * 0.8)
    return normalize(lowpass(d, 0.18))
  },
  hit() {
    return normalize(synth(0.08, (t) => Math.sin(2 * Math.PI * 2400 * t) * env(t, 0.001, 0.02)), 0.4)
  },
  kill() {
    return normalize(synth(0.25, (t) => (Math.sin(2 * Math.PI * 1500 * t) + Math.sin(2 * Math.PI * (t < 0.07 ? 2000 : 2600) * t) * 0.6) * env(t, 0.002, 0.07)), 0.45)
  },
  impact() {
    const r = rng(41)
    return normalize(lowpass(synth(0.1, (t) => (r() * 2 - 1) * env(t, 0.001, 0.02)), 0.6), 0.4)
  },
  hurt() {
    const r = rng(43)
    return normalize(lowpass(synth(0.25, (t) => (r() * 2 - 1) * env(t, 0.002, 0.06) + Math.sin(2 * Math.PI * 90 * t) * env(t, 0.002, 0.1)), 0.25), 0.7)
  },
  cutTick() {
    return normalize(synth(0.05, (t) => Math.sin(2 * Math.PI * 1100 * t) * env(t, 0.001, 0.012)), 0.3)
  },
  cut() {
    const r = rng(53)
    return normalize(synth(0.9, (t) => (r() * 2 - 1) * env(t, 0.003, 0.05) * 0.7 + Math.sin(2 * Math.PI * (880 - t * 600) * t) * env(t, 0.01, 0.3) * 0.6), 0.7)
  },
  radio() {
    return normalize(synth(0.3, (t) => (t < 0.08 || (t > 0.13 && t < 0.21) ? Math.sin(2 * Math.PI * 1320 * t) * 0.5 : 0)), 0.35)
  },
  step() {
    const r = rng(61)
    return normalize(lowpass(synth(0.09, (t) => (r() * 2 - 1) * env(t, 0.002, 0.02)), 0.3), 0.5)
  },
  ui() {
    return normalize(synth(0.06, (t) => Math.sin(2 * Math.PI * 900 * t) * env(t, 0.001, 0.015)), 0.3)
  },
  rain() {
    const r = rng(71)
    let a = 0
    const d = synth(2.4, () => {
      const w = r() * 2 - 1
      a += (w - a) * 0.35
      return a + (r() < 0.002 ? (r() * 2 - 1) * 1.5 : 0)
    })
    return normalize(loopable(d), 0.5)
  },
  drone() {
    const d = synth(6, (t) => {
      const lfo = 0.6 + 0.4 * Math.sin(2 * Math.PI * t / 6)
      return (Math.sin(2 * Math.PI * 55 * t) * 0.5 + Math.sin(2 * Math.PI * 82.5 * t) * 0.3 * lfo + Math.sin(2 * Math.PI * 110.5 * t) * 0.15) * 0.8
    })
    return normalize(loopable(d, 0.2), 0.5)
  },
  thunder() {
    // 远雷：低通布朗噪声 + 几次缓慢起伏的滚动
    const r = rng(83)
    let a = 0
    const d = synth(5, (t) => {
      a += ((r() * 2 - 1) - a) * 0.08
      const roll = 0.55 + 0.45 * Math.sin(t * 5.1) * Math.sin(t * 2.3 + 1)
      return a * env(t, 0.25, 1.4) * roll
    })
    return normalize(lowpass(lowpass(d, 0.12), 0.2), 0.8)
  },
  thunderNear() {
    // 近雷：开头的炸裂 + 滚动
    const r = rng(89)
    let a = 0
    const d = synth(5, (t) => {
      a += ((r() * 2 - 1) - a) * 0.12
      const crack = (r() * 2 - 1) * env(t, 0.004, 0.12) * 1.4
      const roll = 0.6 + 0.4 * Math.sin(t * 6.7) * Math.sin(t * 1.9 + 2)
      return crack + a * env(t, 0.08, 1.6) * roll * 1.2
    })
    return normalize(lowpass(d, 0.22), 0.9)
  },
  tension() {
    const d = synth(4, (t) => {
      const pulse = Math.exp(-((t * 2) % 1) / 0.12)
      return Math.sin(2 * Math.PI * 49 * t) * pulse * 0.8 + Math.sin(2 * Math.PI * 147 * t) * 0.15 * (0.5 + 0.5 * Math.sin(2 * Math.PI * t / 4))
    })
    return normalize(d, 0.5)
  },
}

export function registerSfx(ctx: Context) {
  for (const name of Object.keys(CLIPS)) {
    const id = `jimao.${name}`
    if (!ctx.audio.has(id)) ctx.audio.clip(id, CLIPS[name](), RATE)
  }
}

export const sfx = (name: keyof typeof CLIPS) => `jimao.${name}`
