/**
 * Web 宿主的音频（004 第 20.10 节）：audioClip / audioHas / audioPlay / audioLoop / audioSetLoop / audioStop / audioVolume / audioPause，
 * 语义照 PotAudio.cs：片段为 base64 的 16 位小端 PCM（交错多声道）；一次性声音最多同时 24 个（满了停最早的）；
 * 空间声音线性衰减（2 米内满音量、70 米处为零），无多普勒；pitch ≤ 0 视为 1；主音量夹到 0 到 1。
 * AudioContext 由工厂延迟创建（第一次播放时），Node 上没有工厂时只记录片段与句柄，播放静默。
 * 浏览器要求用户手势后才能出声：boot.ts 在按键、点击时调 unlock()。
 * 坐标：Unity 左手系 (x, y, z) 对应 WebAudio 右手系 (x, y, -z)，监听者跟随相机（listen）。
 */

/** 本文件用到的 WebAudio 子集（便于测试替身） */
export interface AudioParamLike {
  value: number
}

export interface AudioNodeLike {
  connect(dest: any): any
  disconnect(): void
}

export interface AudioBufferLike {
  getChannelData(channel: number): Float32Array
}

export interface AudioSourceLike extends AudioNodeLike {
  buffer: AudioBufferLike | null
  loop: boolean
  playbackRate: AudioParamLike
  onended: (() => void) | null
  start(): void
  stop(): void
}

export interface GainLike extends AudioNodeLike {
  gain: AudioParamLike
}

export interface PannerLike extends AudioNodeLike {
  panningModel: string
  distanceModel: string
  refDistance: number
  maxDistance: number
  rolloffFactor: number
  positionX?: AudioParamLike
  positionY?: AudioParamLike
  positionZ?: AudioParamLike
  setPosition?(x: number, y: number, z: number): void
}

export interface ListenerLike {
  positionX?: AudioParamLike
  positionY?: AudioParamLike
  positionZ?: AudioParamLike
  forwardX?: AudioParamLike
  forwardY?: AudioParamLike
  forwardZ?: AudioParamLike
  upX?: AudioParamLike
  upY?: AudioParamLike
  upZ?: AudioParamLike
  setPosition?(x: number, y: number, z: number): void
  setOrientation?(fx: number, fy: number, fz: number, ux: number, uy: number, uz: number): void
}

export interface AudioContextLike {
  readonly state: string
  readonly destination: any
  readonly listener: ListenerLike
  createBuffer(channels: number, frames: number, rate: number): AudioBufferLike
  createBufferSource(): AudioSourceLike
  createGain(): GainLike
  createPanner(): PannerLike
  resume(): Promise<void>
  suspend(): Promise<void>
}

export const ONESHOT_LIMIT = 24
export const MIN_DISTANCE = 2
export const MAX_DISTANCE = 70

export interface WebClip {
  rate: number
  channels: number
  frames: number
  /** 每声道一段 */
  data: Float32Array[]
  /** 已上传到当前上下文的缓冲 */
  buffer?: AudioBufferLike
}

interface Voice {
  clip: string
  source: AudioSourceLike | null
  gain: GainLike | null
  panner: PannerLike | null
  spatial: boolean
  volume: number
  pitch: number
  pos: [number, number, number]
  ended: boolean
}

function decodeBase64(text: string): Uint8Array {
  const g = globalThis as any
  if (typeof g.atob === 'function') {
    const s: string = g.atob(text)
    const out = new Uint8Array(s.length)
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
    return out
  }
  return new Uint8Array(g.Buffer.from(text, 'base64'))
}

function setParam(p: AudioParamLike | undefined, v: number): boolean {
  if (!p) return false
  p.value = v
  return true
}

export class WebAudio {
  readonly clips = new Map<string, WebClip>()
  readonly loops = new Map<number, Voice>()
  readonly oneshots: Voice[] = []
  volume = 1
  paused = false
  /** 告警出口（宿主接到日志） */
  warn: (text: string) => void = () => {}
  private ctx: AudioContextLike | null = null
  private master: GainLike | null = null
  private nextLoop = 1

  constructor(private readonly factory: (() => AudioContextLike | null) | null = null) {}

  /** 当前上下文（第一次需要出声时创建） */
  get context(): AudioContextLike | null {
    if (!this.ctx && this.factory) {
      try {
        this.ctx = this.factory()
      } catch (e: any) {
        this.warn(`[pot] 无法创建音频上下文：${e?.message ?? e}`)
      }
      if (this.ctx) {
        this.master = this.ctx.createGain()
        this.master.gain.value = this.volume
        this.master.connect(this.ctx.destination)
        if (this.paused) this.ctx.suspend().catch(() => {})
      }
    }
    return this.ctx
  }

  /** 注册（或替换）片段；数据为空或解码失败返回 false */
  clip(name: string, rate: number, channels: number, pcm16Base64: string): boolean {
    let bytes: Uint8Array
    try {
      bytes = decodeBase64(pcm16Base64 ?? '')
    } catch (e: any) {
      this.warn(`[pot] 注册音频 ${name} 失败：${e?.message ?? e}`)
      return false
    }
    const ch = Math.max(1, Math.trunc(channels) || 1)
    const frames = Math.floor(Math.floor(bytes.length / 2) / ch)
    if (frames <= 0) return false
    const data: Float32Array[] = []
    for (let c = 0; c < ch; c++) data.push(new Float32Array(frames))
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    for (let f = 0; f < frames; f++) {
      for (let c = 0; c < ch; c++) data[c][f] = dv.getInt16((f * ch + c) * 2, true) / 32768
    }
    this.clips.set(name, { rate: Math.max(8000, Math.min(96000, Math.trunc(rate) || 44100)), channels: ch, frames, data })
    return true
  }

  has(name: string): boolean {
    return this.clips.has(name)
  }

  private bufferOf(ctx: AudioContextLike, clip: WebClip): AudioBufferLike {
    if (!clip.buffer) {
      const b = ctx.createBuffer(clip.channels, clip.frames, clip.rate)
      for (let c = 0; c < clip.channels; c++) b.getChannelData(c).set(clip.data[c])
      clip.buffer = b
    }
    return clip.buffer
  }

  /** 建声音节点：source → gain →（panner →）master */
  private start(name: string, volume: number, pitch: number, loop: boolean): Voice | null {
    const clip = this.clips.get(name)
    if (!clip) return null
    const v: Voice = { clip: name, source: null, gain: null, panner: null, spatial: false, volume: Math.max(0, volume), pitch: pitch > 0 ? pitch : 1, pos: [0, 0, 0], ended: false }
    const ctx = this.context
    if (ctx && this.master) {
      const src = ctx.createBufferSource()
      src.buffer = this.bufferOf(ctx, clip)
      src.loop = loop
      src.playbackRate.value = v.pitch
      const gain = ctx.createGain()
      gain.gain.value = v.volume
      src.connect(gain)
      gain.connect(this.master)
      v.source = src
      v.gain = gain
      src.onended = () => {
        v.ended = true
        if (!loop) {
          const i = this.oneshots.indexOf(v)
          if (i >= 0) this.oneshots.splice(i, 1)
        }
      }
      src.start()
    }
    return v
  }

  private place(v: Voice, x: number, y: number, z: number, spatial: boolean): void {
    v.pos = [x, y, z]
    if (!v.gain || !this.ctx || !this.master) {
      v.spatial = spatial
      return
    }
    if (spatial && !v.panner) {
      const p = this.ctx.createPanner()
      p.panningModel = 'equalpower'
      p.distanceModel = 'linear'
      p.refDistance = MIN_DISTANCE
      p.maxDistance = MAX_DISTANCE
      p.rolloffFactor = 1
      v.panner = p
    }
    if (spatial !== v.spatial) {
      v.gain.disconnect()
      if (spatial) {
        v.gain.connect(v.panner!)
        v.panner!.connect(this.master)
      } else {
        v.panner?.disconnect()
        v.gain.connect(this.master)
      }
      v.spatial = spatial
    }
    if (spatial && v.panner) {
      const p = v.panner
      if (!(setParam(p.positionX, x) && setParam(p.positionY, y) && setParam(p.positionZ, -z))) p.setPosition?.(x, y, -z)
    }
  }

  private stopVoice(v: Voice): void {
    if (v.source) {
      v.source.onended = null
      try {
        v.source.stop()
      } catch {}
      v.source.disconnect()
    }
    v.gain?.disconnect()
    v.panner?.disconnect()
    v.ended = true
  }

  /** 一次性播放；spatial 为 false 时忽略位置 */
  play(name: string, volume: number, pitch: number, x: number, y: number, z: number, spatial: boolean): void {
    if (!this.clips.has(name)) return
    while (this.oneshots.length >= ONESHOT_LIMIT) this.stopVoice(this.oneshots.shift()!)
    const v = this.start(name, volume, pitch, false)
    if (!v) return
    this.place(v, x, y, z, spatial)
    // 没有上下文时（Node）不会结束，不进池，避免无谓占位
    if (v.source) this.oneshots.push(v)
  }

  /** 开始循环播放，返回句柄（0 表示片段不存在） */
  loop(name: string, volume: number, pitch: number): number {
    const v = this.start(name, volume, pitch, true)
    if (!v) return 0
    const id = this.nextLoop++
    this.loops.set(id, v)
    return id
  }

  /** 调整循环声音：volume < 0、pitch ≤ 0 表示不变；spatial 时使用位置 */
  setLoop(handle: number, volume: number, pitch: number, x: number, y: number, z: number, spatial: boolean): void {
    const v = this.loops.get(handle)
    if (!v) return
    if (volume >= 0) {
      v.volume = volume
      if (v.gain) v.gain.gain.value = volume
    }
    if (pitch > 0) {
      v.pitch = pitch
      if (v.source) v.source.playbackRate.value = pitch
    }
    this.place(v, x, y, z, spatial)
  }

  stop(handle: number): void {
    const v = this.loops.get(handle)
    if (!v) return
    this.loops.delete(handle)
    this.stopVoice(v)
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 1))
    if (this.master) this.master.gain.value = this.volume
  }

  pause(paused: boolean): void {
    this.paused = !!paused
    const ctx = this.ctx
    if (!ctx) return
    if (this.paused) ctx.suspend().catch(() => {})
    else ctx.resume().catch(() => {})
  }

  /** 用户手势：恢复被浏览器挂起的上下文（游戏暂停中不恢复） */
  unlock(): void {
    const ctx = this.context
    if (ctx && !this.paused && ctx.state !== 'running') ctx.resume().catch(() => {})
  }

  /** 监听者跟随相机：位置与前、上方向（Unity 坐标） */
  listen(pos: ArrayLike<number>, forward: ArrayLike<number>, up: ArrayLike<number>): void {
    const l = this.ctx?.listener
    if (!l) return
    if (!(setParam(l.positionX, pos[0]) && setParam(l.positionY, pos[1]) && setParam(l.positionZ, -pos[2]))) l.setPosition?.(pos[0], pos[1], -pos[2])
    const ok = setParam(l.forwardX, forward[0]) && setParam(l.forwardY, forward[1]) && setParam(l.forwardZ, -forward[2])
      && setParam(l.upX, up[0]) && setParam(l.upY, up[1]) && setParam(l.upZ, -up[2])
    if (!ok) l.setOrientation?.(forward[0], forward[1], -forward[2], up[0], up[1], -up[2])
  }

  /** 冷重启：停止所有声音（片段保留），音量与暂停复位 */
  clear(): void {
    for (const v of this.loops.values()) this.stopVoice(v)
    this.loops.clear()
    for (const v of this.oneshots) this.stopVoice(v)
    this.oneshots.length = 0
    this.setVolume(1)
    this.pause(false)
  }
}
