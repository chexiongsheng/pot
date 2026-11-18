/**
 * Unity 宿主：基于 CS.Pot.* 静态方法实现 Host，并提供给 C# 调用的入口 pot.unity.*。
 * C# 侧见 com.pot.core/Runtime：PotHost / GameFS / PotScene / PotInput。
 * 只传数字和字符串，避免结构体跨语言封送；向量通过静态字段带回。
 */
import type { Host } from './host'
import { createRuntime, Runtime } from './runtime'

declare const CS: any

export function createUnityHost(): Host {
  const Pot = CS.Pot
  const H = Pot.PotHost
  const FS = Pot.GameFS
  const S = Pot.PotScene
  const I = Pot.PotInput
  const U = Pot.PotUI
  const A = Pot.PotAudio
  const R = Pot.PotRender
  const G = Pot.PotGfx
  return {
    platform: 'unity',
    log: (level, text) => H.Log(level, text),
    readText: (path) => {
      const text = FS.ReadText(path)
      return text === null || text === undefined ? null : text
    },
    gc: () => H.RequestGC(),
    send: (message) => H.Send(message),
    engine: {
      spawn: (shape, name, parent) => S.Spawn(shape, name, parent),
      destroy: (id) => S.Destroy(id),
      exists: (id) => S.Exists(id),
      setVec: (id, prop, x, y, z) => S.SetVec(id, prop, x, y, z),
      getVec: (id, prop) => {
        S.GetVec(id, prop)
        return [S.vx, S.vy, S.vz]
      },
      setColor: (id, r, g, b, a) => S.SetColor(id, r, g, b, a),
      setActive: (id, active) => S.SetActive(id, active),
      lookAt: (id, x, y, z) => S.LookAt(id, x, y, z),
      light: (id, type, intensity, r, g, b, range) => S.Light(id, type, intensity, r, g, b, range),
      cameraId: () => S.CameraId(),
      setBackground: (r, g, b) => S.SetBackground(r, g, b),
      axis: (name) => {
        I.Axis(name)
        return [I.ax, I.ay]
      },
      key: (name, mode) => I.Key(name, mode),
      count: () => S.Count(),
      material: (id, mode, castShadows) => S.SetMaterial(id, mode, castShadows),
      surface: (id, metallic, smoothness) => S.SetSurface(id, metallic, smoothness),
      emission: (id, r, g, b) => S.SetEmission(id, r, g, b),
      collider: (id, enabled) => S.SetCollider(id, enabled),
      layer: (id, layer) => S.SetLayer(id, layer),
      raycast: (ox, oy, oz, dx, dy, dz, maxDistance, mask) => {
        const id = S.Raycast(ox, oy, oz, dx, dy, dz, maxDistance, mask)
        if (!id) return null
        return { id, point: [S.vx, S.vy, S.vz], normal: [S.nx, S.ny, S.nz], distance: S.dist }
      },
      view: (fov, near, far) => S.SetCamera(fov, near, far),
      fog: (r, g, b, density) => S.SetFog(r, g, b, density),
      ambient: (r, g, b, reflection) => S.SetAmbient(r, g, b, reflection),
      lightOptions: (id, spotAngle, shadows) => S.LightOptions(id, spotAngle, shadows),
      lightIntensity: (id, intensity) => S.SetLightIntensity(id, intensity),
      cursor: (locked) => I.SetCursor(locked),
      cursorLocked: () => I.CursorLocked(),
      mouse: () => {
        I.Mouse()
        return [I.mx, I.my]
      },
      screen: () => {
        I.ScreenSize()
        return [I.sw, I.sh]
      },
      wheel: () => I.Wheel(),
      focused: () => I.Focused(),
      uiSubmit: (list) => U.Submit(list),
      uiMeasure: (text, size, bold) => {
        U.Measure(text, size, bold)
        return [U.tw, U.th]
      },
      audioClip: (name, rate, channels, data) => A.Clip(name, rate, channels, data),
      audioHas: (name) => A.HasClip(name),
      audioPlay: (name, volume, pitch, x, y, z, spatial) => A.Play(name, volume, pitch, x, y, z, spatial),
      audioLoop: (name, volume, pitch) => A.Loop(name, volume, pitch),
      audioSetLoop: (handle, volume, pitch, x, y, z, spatial) => A.SetLoop(handle, volume, pitch, x, y, z, spatial),
      audioStop: (handle) => A.StopLoop(handle),
      audioVolume: (volume) => A.Volume(volume),
      audioPause: (paused) => A.Pause(paused),
      texture: (data, width, height, linear, mipmaps, wrap, filter, aniso) => S.Texture(data, width, height, linear, mipmaps, wrap, filter, aniso),
      destroyTexture: (id) => S.DestroyTexture(id),
      textTexture: (json) => R.TextTexture(json),
      mesh: (name, positions, normals, uvs, colors, indices) => S.Mesh(name, positions, normals, uvs, colors, indices),
      matTexture: (id, slot, tex) => S.MatTexture(id, slot, tex),
      matFloat: (id, prop, value) => S.MatFloat(id, prop, value),
      matVector: (id, prop, x, y, z, w) => S.MatVector(id, prop, x, y, z, w),
      ambientTrilight: (sr, sg, sb, er, eg, eb, gr, gg, gb, reflection) => S.SetAmbientTrilight(sr, sg, sb, er, eg, eb, gr, gg, gb, reflection),
      render: (kind, json) => R.Configure(kind, json) ?? '',
      burst: (json) => R.Burst(json),
      gfxBackend: () => G.Backend() ?? '',
      gfxProgram: (name, vs, fs) => G.Program(name, vs, fs) ?? '',
      gfxDestroyProgram: (name) => G.DestroyProgram(name),
      gfxBind: (id, program, flags, queue, shadows) => G.Bind(id, program, flags, queue, shadows),
      gfxUniform: (id, name, n, x, y, z, w) => G.Uniform(id, name, n, x, y, z, w),
      gfxUniformArray: (id, name, data) => G.UniformArray(id, name, data),
      gfxTexture: (id, name, tex) => G.Texture(id, name, tex),
      gfxBakeBegin: () => G.BakeBegin(),
      gfxBake: (bind, program, width, height, targets, blend) => G.Bake(bind, program, width, height, targets, blend) ?? '!',
    },
  }
}

/** C# 调用入口（PotRuntime.cs） */
export const unity = {
  runtime: undefined as Runtime | undefined,
  /** 启动：异步完成后回调 PotHost.OnBooted(ok, error) */
  boot(stateJson?: string) {
    const host = createUnityHost()
    // Runner 带 devtools：直接从游戏源码加载；发布包没有 devtools，只读 bundle.cjs
    const loader = (globalThis as any).pot?.devtools?.createLoader?.(host)
    createRuntime(host, { state: stateJson || undefined, loader })
      .then((runtime) => {
        unity.runtime = runtime
        ;(globalThis as any).pot?.devtools?.attach?.(runtime)
        return runtime.start()
      })
      .then(() => CS.Pot.PotHost.OnBooted(true, ''), (error: any) => CS.Pot.PotHost.OnBooted(false, String(error?.stack ?? error)))
  },
  tick(dt: number) {
    unity.runtime?.tick(dt)
  },
  /** 冷重启前调用：导出 state JSON（失败返回空串） */
  exportState(): string {
    try {
      return unity.runtime?.exportState() ?? ''
    } catch (error: any) {
      CS.Pot.PotHost.Log('error', `导出 state 失败：${error?.stack ?? error}`)
      return ''
    }
  },
  stop() {
    const runtime = unity.runtime
    unity.runtime = undefined
    runtime?.stop().catch(() => {})
  },
  info(): string {
    return JSON.stringify(unity.runtime?.info() ?? { status: 'idle' })
  },
}
