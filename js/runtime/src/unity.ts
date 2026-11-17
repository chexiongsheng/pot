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
