/**
 * audio：资产即代码。游戏用 JS 合成采样（-1 到 1 的数组），clip() 注册后按名字播放。
 * 片段由宿主保留（跨热重载、冷重启），循环声音挂在调用方 fiber 上，单元卸载时自动停止。
 */
import { Context, Service } from 'cordis'
import type { Host, Vec3 } from './host'

declare module 'cordis' {
  interface Context {
    audio: AudioService
  }
}

export interface PlayOptions {
  volume?: number
  pitch?: number
  /** 传入则为 3D 声音 */
  position?: Vec3
}

export interface LoopHandle {
  readonly id: number
  set(options: PlayOptions): void
  stop(): void
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** 采样（-1..1）转 16 位小端 PCM 的 base64 */
export function encodePcm16(samples: ArrayLike<number>): string {
  const bytes = new Uint8Array(samples.length * 2)
  for (let i = 0; i < samples.length; i++) {
    let v = Math.round(Math.max(-1, Math.min(1, samples[i] || 0)) * 32767)
    if (v < 0) v += 65536
    bytes[i * 2] = v & 255
    bytes[i * 2 + 1] = v >> 8
  }
  const out: string[] = []
  let chunk = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2]
    const triple = (a << 16) | ((b ?? 0) << 8) | (c ?? 0)
    chunk += B64[(triple >> 18) & 63] + B64[(triple >> 12) & 63]
      + (i + 1 < bytes.length ? B64[(triple >> 6) & 63] : '=')
      + (i + 2 < bytes.length ? B64[triple & 63] : '=')
    if (chunk.length >= 4096) {
      out.push(chunk)
      chunk = ''
    }
  }
  out.push(chunk)
  return out.join('')
}

export class AudioService extends Service {
  constructor(ctx: Context, private _host: Host) {
    super(ctx, 'audio')
  }

  /** 注册（或替换）片段；rate 为采样率，默认 22050 */
  clip(name: string, samples: ArrayLike<number>, rate = 22050) {
    return this._host.engine.audioClip(name, rate, 1, encodePcm16(samples))
  }

  /** 片段是否已注册（热重载后可以跳过重新合成） */
  has(name: string) {
    return this._host.engine.audioHas(name)
  }

  play(name: string, options: PlayOptions = {}) {
    const p = options.position
    this._host.engine.audioPlay(name, options.volume ?? 1, options.pitch ?? 1, p?.[0] ?? 0, p?.[1] ?? 0, p?.[2] ?? 0, !!p)
  }

  /** 循环播放，随调用方单元卸载自动停止 */
  loop(name: string, options: PlayOptions = {}): LoopHandle {
    const engine = this._host.engine
    let id = 0
    const dispose = this.ctx.effect(() => {
      id = engine.audioLoop(name, options.volume ?? 1, options.pitch ?? 1)
      return () => {
        if (id) engine.audioStop(id)
        id = 0
      }
    }, `audio.loop(${name})`)
    const handle: LoopHandle = {
      get id() { return id },
      set(o: PlayOptions) {
        if (!id) return
        const p = o.position
        engine.audioSetLoop(id, o.volume ?? -1, o.pitch ?? 0, p?.[0] ?? 0, p?.[1] ?? 0, p?.[2] ?? 0, !!p)
      },
      stop() { dispose() },
    }
    if (options.position) handle.set({ position: options.position })
    return handle
  }

  /** 主音量 0 到 1 */
  volume(value: number) {
    this._host.engine.audioVolume(value)
  }

  /** 暂停/恢复全部声音 */
  pause(paused: boolean) {
    this._host.engine.audioPause(paused)
  }
}
