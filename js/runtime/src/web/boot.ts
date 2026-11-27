/**
 * Web 启动入口（004 第 20.1、20.7 节）：pot web 生成的 index.html 调 pot.web.boot()。
 * 负责全部 DOM 接线：建画布、键鼠事件、指针锁、requestAnimationFrame 循环；Host 本身在 host.ts（不碰 DOM）。
 * 坐标约定：screen()、mouse() 与界面用 CSS 像素；界面画布按 devicePixelRatio 缩放，3D 画布用设备像素。
 */
import { blocksDefault } from './keys'
import { WebInput } from './input'
import { WebScene } from './scene'
import { WebUI } from './ui'
import { WebRenderer } from './gl'
import { createWebHost, WebHost, WebPlatform } from './host'

export interface WebBootOptions {
  /** 承载画布的元素，缺省 #pot，没有则用 body */
  container?: HTMLElement | null
  /** 游戏文件表，缺省 globalThis.__potFiles */
  files?: Record<string, string>
  /** 加载提示元素，缺省 #pot-loading */
  loadingElement?: HTMLElement | null
  /** 3D 画布的像素比上限，缺省 2 */
  maxPixelRatio?: number
}

export interface WebApp {
  host: WebHost
  runtime: any
  renderer: WebRenderer
  /** 停止循环并解除事件 */
  stop(): void
}

function makeCanvas(container: HTMLElement, z: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  const s = c.style
  s.position = 'absolute'
  s.left = '0'
  s.top = '0'
  s.width = '100%'
  s.height = '100%'
  s.display = 'block'
  s.zIndex = String(z)
  container.appendChild(c)
  return c
}

export function boot(options: WebBootOptions = {}): WebApp | null {
  const g = globalThis as any
  const container = options.container ?? document.getElementById('pot') ?? document.body
  const loadingEl = options.loadingElement ?? document.getElementById('pot-loading')
  const maxRatio = options.maxPixelRatio ?? 2
  const files: Record<string, string> = options.files ?? g.__potFiles ?? {}

  const showMessage = (text: string, error = false) => {
    if (!loadingEl) {
      if (error) console.error(text)
      return
    }
    loadingEl.style.display = ''
    loadingEl.textContent = text
    if (error) loadingEl.classList.add('pot-error')
  }
  const hideMessage = () => {
    if (loadingEl) loadingEl.style.display = 'none'
  }

  if (getComputedStyle(container).position === 'static') container.style.position = 'relative'
  if (container.tabIndex < 0) container.tabIndex = 0
  container.style.outline = 'none'

  const glCanvas = makeCanvas(container, 0)
  const uiCanvas = makeCanvas(container, 1)
  uiCanvas.style.pointerEvents = 'none'
  const gl = glCanvas.getContext('webgl2', { antialias: true, alpha: false })
  const ctx = uiCanvas.getContext('2d')
  if (!gl || !ctx) {
    showMessage('浏览器不支持 WebGL2，无法运行', true)
    return null
  }

  const scene = new WebScene()
  const input = new WebInput()
  const ui = new WebUI(ctx as any)
  const renderer = new WebRenderer(gl)

  // ---- 指针锁 ----
  let wantLock = false
  let retryLock = false
  const isLocked = () => document.pointerLockElement === glCanvas
  const requestLock = () => {
    retryLock = false
    try {
      const r: any = (glCanvas as any).requestPointerLock()
      if (r && typeof r.catch === 'function') r.catch(() => (retryLock = wantLock))
    } catch {
      retryLock = true
    }
  }

  const platform: WebPlatform = {
    screen: () => [container.clientWidth, container.clientHeight],
    focused: () => document.hasFocus() && document.visibilityState === 'visible',
    cursor: (locked) => {
      wantLock = !!locked
      if (wantLock && !isLocked()) requestLock()
      else if (!wantLock && isLocked()) document.exitPointerLock()
    },
    cursorLocked: () => isLocked(),
  }

  let storage: Storage | null = null
  try {
    storage = g.localStorage ?? null
  } catch {}

  const host = createWebHost({
    files,
    scene,
    input,
    ui,
    platform,
    storage,
    loading: (progress, text) => showMessage(`${text || '加载中'} ${Math.round((progress || 0) * 100)}%`),
    now: () => performance.now(),
  })

  // ---- 事件 ----
  const listeners: [EventTarget, string, any, any?][] = []
  const on = (target: EventTarget, type: string, fn: any, opts?: any) => {
    target.addEventListener(type, fn, opts)
    listeners.push([target, type, fn, opts])
  }

  on(window, 'keydown', (e: KeyboardEvent) => {
    if (!e.repeat) input.keyEvent(e.code, true)
    if (blocksDefault(e.code)) e.preventDefault()
    if (e.isComposing) return
    if (e.key === 'Backspace') input.textEvent('\b')
    else if (e.key === 'Enter') input.textEvent('\n')
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) input.textEvent(e.key)
  })
  on(window, 'keyup', (e: KeyboardEvent) => {
    input.keyEvent(e.code, false)
    if (blocksDefault(e.code)) e.preventDefault()
  })
  on(window, 'compositionend', (e: CompositionEvent) => {
    if (e.data) input.textEvent(e.data)
  })
  const position = (e: MouseEvent): [number, number] => {
    const r = glCanvas.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }
  on(glCanvas, 'mousedown', (e: MouseEvent) => {
    container.focus()
    if (retryLock && wantLock) requestLock()
    input.buttonEvent(e.button, true)
    e.preventDefault()
  })
  on(window, 'mouseup', (e: MouseEvent) => input.buttonEvent(e.button, false))
  on(window, 'mousemove', (e: MouseEvent) => {
    const [x, y] = position(e)
    input.moveEvent(x, y, e.movementX || 0, e.movementY || 0)
  })
  on(glCanvas, 'wheel', (e: WheelEvent) => {
    input.wheelEvent(e.deltaY, e.deltaMode)
    e.preventDefault()
  }, { passive: false })
  on(glCanvas, 'contextmenu', (e: Event) => e.preventDefault())
  on(window, 'blur', () => input.blur())
  on(document, 'visibilitychange', () => {
    if (document.visibilityState !== 'visible') input.blur()
  })
  on(document, 'pointerlockchange', () => {
    // 浏览器用 Esc 解除指针锁时页面收不到 Esc 的 keydown：补一次 escape 边沿，游戏的暂停逻辑照常触发
    if (wantLock && !isLocked()) {
      input.press('escape', true)
      input.press('escape', false)
      wantLock = false
    }
  })

  // ---- 运行时 ----
  let runtime: any
  let failed = false
  const fail = (error: any) => {
    failed = true
    showMessage(`启动失败：${error?.stack ?? error}`, true)
  }
  showMessage('加载中…')
  try {
    Promise.resolve(g.pot.createRuntime(host))
      .then((r: any) => {
        runtime = r
        return r.start()
      })
      .then(() => {
        const failures = runtime?.failures ?? []
        if (runtime?.status === 'failed' || failures.length) {
          fail(failures.map((f: any) => `${f.id ?? f.name ?? ''} ${f.error ?? f.message ?? ''}`).join('\n') || runtime?.status)
        } else hideMessage()
      }, fail)
  } catch (error) {
    fail(error)
  }

  // ---- 逐帧 ----
  let cssW = 0, cssH = 0, ratio = 0
  let last = performance.now()
  let frame = 0
  let stopped = false
  const resize = () => {
    const w = Math.max(1, container.clientWidth)
    const h = Math.max(1, container.clientHeight)
    const dpr = Math.min(maxRatio, g.devicePixelRatio || 1)
    if (w === cssW && h === cssH && dpr === ratio) return
    cssW = w
    cssH = h
    ratio = dpr
    glCanvas.width = Math.round(w * dpr)
    glCanvas.height = Math.round(h * dpr)
    uiCanvas.width = Math.round(w * dpr)
    uiCanvas.height = Math.round(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ui.invalidate()
  }
  const loop = (t: number) => {
    if (stopped) return
    frame = requestAnimationFrame(loop)
    const dt = Math.min(0.1, Math.max(0, (t - last) / 1000))
    last = t
    resize()
    try {
      const status = runtime?.status
      if (status === 'starting') runtime.root.loading.pump()
      else if (status === 'running') runtime.tick(dt)
    } catch (error) {
      if (!failed) fail(error)
    }
    renderer.render(scene, glCanvas.width, glCanvas.height)
    ui.render(cssW, cssH)
    input.endFrame()
  }
  frame = requestAnimationFrame(loop)
  container.focus()

  const app: WebApp = {
    host,
    get runtime() {
      return runtime
    },
    renderer,
    stop() {
      stopped = true
      cancelAnimationFrame(frame)
      for (const [target, type, fn, opts] of listeners) target.removeEventListener(type, fn, opts)
      runtime?.stop?.().catch?.(() => {})
    },
  }
  g.__potApp = app
  return app
}
