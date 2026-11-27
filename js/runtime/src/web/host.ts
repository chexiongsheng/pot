/**
 * Web 宿主（004 第 20.1 至 20.6 节）：Host 与 Engine 的浏览器实现。
 * 本文件不碰 DOM：场景、输入、界面、渲染与屏幕状态都由调用方（boot.ts 或测试）注入，Node 上可直接用（web-host 测试）。
 * 没实现的 Engine 方法第一次调用时 warn 一次并返回中性值（与 headless.js 的 wrapEngine 同一约定）。
 */
import type { Engine, Host, LogLevel } from '../host'
import { WebAudio } from './audio'
import { WebInput } from './input'
import { WebParticles } from './particles'
import { WebPhysics } from './physics'
import { CAMERA_ID, WebScene } from './scene'
import { Text2DLike, WebText } from './text'
import { WebUI } from './ui'

/** 与 DOM 相关的状态，由 boot.ts 提供；测试里给固定值 */
export interface WebPlatform {
  /** 画布尺寸（CSS 像素，界面坐标系） */
  screen(): [number, number]
  focused(): boolean
  cursor(locked: boolean): void
  cursorLocked(): boolean
}

/** localStorage 的最小接口 */
export interface WebStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface WebHostOptions {
  /** 游戏文件表：manifest.json、data/** 等（game.js 的 __potFiles） */
  files: Record<string, string>
  scene?: WebScene
  input?: WebInput
  /** 音频（boot.ts 传入带 AudioContext 工厂的实例；缺省为静默实例） */
  audio?: WebAudio
  /** 文字贴图用的 2D 上下文工厂（boot.ts 建离屏 canvas）；缺省时 textTexture 返回 0、canvasText 返回 null */
  text2d?: (() => Text2DLike | null) | null
  ui: WebUI
  platform: WebPlatform
  storage?: WebStorage | null
  log?: (level: LogLevel, text: string) => void
  loading?: (progress: number, text: string) => void
  now?: () => number
}

export interface WebHost extends Host {
  platform: 'web'
  scene: WebScene
  physics: WebPhysics
  /** 粒子迸发（boot.ts 每帧 update 并交给渲染器） */
  particles: WebParticles
  audio: WebAudio
  input: WebInput
  ui: WebUI
  /** 游戏 id（manifest.json），缓存键前缀用 */
  gameId: string
  /** 已告警过的未实现方法 */
  unsupported: Set<string>
}

/** 未实现方法的中性返回值；没列的返回 ''（多数宿主方法以空串表示成功） */
const NEUTRAL: Record<string, any> = {
  gfxBakeBegin: 0,
  gfxBake: '!Web 宿主暂不支持 gfxBake',
  gfxProgram: 'Web 宿主暂不支持运行时着色器',
  gfxPost: 'Web 宿主暂不支持后处理',
  gfxPostEnable: 'Web 宿主暂不支持后处理',
  gfxInstances: 'Web 宿主暂不支持实例缓冲',
}

const KEY_RE = /^[A-Za-z0-9_-]{1,64}$/

export function createWebHost(options: WebHostOptions): WebHost {
  const files = options.files
  const scene = options.scene ?? new WebScene()
  const input = options.input ?? new WebInput()
  const ui = options.ui
  const platform = options.platform
  const storage = options.storage ?? null
  const log = options.log ?? ((level: LogLevel, text: string) => (console[level] ?? console.log).call(console, text))
  let gameId = 'game'
  try {
    gameId = JSON.parse(files['manifest.json'] ?? '{}').id || 'game'
  } catch {}
  const unsupported = new Set<string>()
  const physics = new WebPhysics(scene)
  // 火花碰撞所有层（ParticleSystem.collision.collidesWith 缺省 Everything）
  const particles = new WebParticles((ox, oy, oz, dx, dy, dz, max) => physics.raycast(ox, oy, oz, dx, dy, dz, max, -1))
  const audio = options.audio ?? new WebAudio(null)
  audio.warn = (text) => log('warn', text)
  const text = new WebText(scene.textures, options.text2d ?? null)
  const impl: Partial<Engine> = {
    spawn: (shape, name, parent) => scene.spawn(shape, name, parent),
    destroy: (id) => scene.destroy(id),
    exists: (id) => scene.exists(id),
    setVec: (id, prop, x, y, z) => scene.setVec(id, prop, x, y, z),
    setTransforms: (ids, data, count, flags) => scene.setTransforms(ids, data, count, flags),
    visible: (id, v) => scene.visible(id, v),
    getVec: (id, prop) => scene.getVec(id, prop),
    setColor: (id, r, g, b, a) => scene.setColor(id, r, g, b, a),
    setActive: (id, active) => scene.setActive(id, active),
    lookAt: (id, x, y, z) => scene.lookAt(id, x, y, z),
    light: (id, type, intensity, r, g, b, range) => scene.light(id, type, intensity, r, g, b, range),
    cameraId: () => CAMERA_ID,
    setBackground: (r, g, b) => scene.setBackground(r, g, b),
    axis: (name) => input.axis(name),
    key: (name, mode) => input.key(name, mode),
    count: () => scene.count(),
    material: (id, mode, castShadows, cull) => scene.material(id, mode, castShadows, cull),
    surface: (id, metallic, smoothness) => scene.surface(id, metallic, smoothness),
    emission: (id, r, g, b) => scene.emission(id, r, g, b),
    view: (fov, near, far) => scene.view(fov, near, far),
    fog: (r, g, b, density) => scene.fog(r, g, b, density),
    ambient: (r, g, b, reflection) => scene.ambient(r, g, b, reflection),
    ambientTrilight: (sr, sg, sb, er, eg, eb, gr, gg, gb, reflection) => scene.ambientTrilight(sr, sg, sb, er, eg, eb, gr, gg, gb, reflection),
    lightOptions: (id, spotAngle, shadows) => scene.lightOptions(id, spotAngle, shadows),
    lightIntensity: (id, intensity) => scene.lightIntensity(id, intensity),
    cursor: (locked) => platform.cursor(locked),
    cursorLocked: () => platform.cursorLocked(),
    mouse: () => [input.mouseX, input.mouseY],
    screen: () => platform.screen(),
    wheel: () => input.wheel(),
    focused: () => platform.focused(),
    textInput: () => input.textInput(),
    uiSubmit: (list) => ui.submit(list),
    uiMeasure: (text, size, flags) => ui.measure(text, size, flags),
    gfxBackend: () => '',
    gfxUnsupported: () => 'Web 宿主暂不支持运行时着色器（004 第 20.2 节 web-3）',
    mesh: (name, positions, normals, uvs, colors, indices, key) => scene.meshes.register(name, positions, normals, uvs, colors, indices, key),
    meshCached: (name, key) => scene.meshes.cached(name, key),
    meshTangents: (name, tangents) => scene.meshes.tangents(name, tangents),
    meshColors: (name, colors, linear) => scene.meshes.colors(name, colors, linear),
    meshAttribute: (name, channel, attr, size, data) => scene.meshes.attribute(name, channel, attr, size, data),
    meshSkin: (name, boneIndices, weights, bindPoses) => scene.meshes.skin(name, boneIndices, weights, bindPoses),
    skin: (id, bones) => scene.skin(id, bones),
    texture: (data, width, height, linear, mipmaps, wrap, filter, aniso) => scene.textures.create(data, width, height, linear, mipmaps, wrap, filter, aniso),
    destroyTexture: (id) => scene.textures.destroy(id),
    textTexture: (json) => text.texture(json),
    canvasText: (s, family, size, style) => text.canvasText(s, family, size, style),
    matTexture: (id, slot, tex) => scene.matTexture(id, slot, tex),
    matFloat: (id, prop, value) => scene.matFloat(id, prop, value),
    matVector: (id, prop, x, y, z, w) => scene.matVector(id, prop, x, y, z, w),
    collider: (id, enabled) => physics.collider(id, enabled),
    colliderShape: (id, kind, dynamic) => physics.colliderShape(id, kind, dynamic),
    layer: (id, layer) => physics.layer(id, layer),
    raycast: (ox, oy, oz, dx, dy, dz, maxDistance, mask) => physics.raycast(ox, oy, oz, dx, dy, dz, maxDistance, mask),
    sphereCast: (ox, oy, oz, dx, dy, dz, radius, maxDistance, mask) => physics.sphereCast(ox, oy, oz, dx, dy, dz, radius, maxDistance, mask),
    audioClip: (name, rate, channels, pcm) => audio.clip(name, rate, channels, pcm),
    audioHas: (name) => audio.has(name),
    audioPlay: (name, volume, pitch, x, y, z, spatial) => audio.play(name, volume, pitch, x, y, z, spatial),
    audioLoop: (name, volume, pitch) => audio.loop(name, volume, pitch),
    audioSetLoop: (handle, volume, pitch, x, y, z, spatial) => audio.setLoop(handle, volume, pitch, x, y, z, spatial),
    audioStop: (handle) => audio.stop(handle),
    audioVolume: (volume) => audio.setVolume(volume),
    audioPause: (paused) => audio.pause(paused),
    burst: (json) => particles.burst(json),
    render: (kind, json) => scene.render.configure(kind, json),
  }
  scene.warn = (text) => log('warn', text)
  scene.textures.error = (text) => log('error', text)

  const engine = new Proxy(impl as Engine, {
    get(target, key) {
      if (typeof key === 'symbol' || key === 'then') return (target as any)[key]
      if (key in target) return (target as any)[key]
      return () => {
        if (!unsupported.has(key)) {
          unsupported.add(key)
          log('warn', `Web 宿主不支持 ${key}`)
        }
        return Object.prototype.hasOwnProperty.call(NEUTRAL, key) ? NEUTRAL[key] : ''
      }
    },
  })

  const prefix = `pot:${gameId}:`
  return {
    platform: 'web',
    scene,
    physics,
    particles,
    audio,
    input,
    ui,
    gameId,
    unsupported,
    engine,
    frames: true,
    log,
    readText: (p) => (Object.prototype.hasOwnProperty.call(files, p) ? files[p] : null),
    cacheRead: (bucket, key) => {
      if (!storage || !KEY_RE.test(bucket) || !KEY_RE.test(key)) return null
      try {
        return storage.getItem(`${prefix}${bucket}/${key}`)
      } catch {
        return null
      }
    },
    cacheWrite: (bucket, key, text) => {
      if (!storage || !KEY_RE.test(bucket) || !KEY_RE.test(key)) return
      try {
        storage.setItem(`${prefix}${bucket}/${key}`, text)
      } catch {}
    },
    loading: options.loading,
    now: options.now,
  }
}
