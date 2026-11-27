/**
 * 可移植契约（004 第 8 节、20.7）：游戏代码能用的全局对象清单，与在每个宿主上都屏蔽成 undefined 的名单。
 *
 * - PORTABLE_GLOBALS：Puerts、Node、Web 三个宿主都提供的全局对象。游戏与套件只应依赖这些。
 * - BLOCKED_GLOBALS：宿主专有的全局对象。Web 构建把游戏 bundle 包在以这些名字为形参的函数里（不传实参），
 *   游戏代码里它们都是 undefined，第三方库的特性检测会走非浏览器分支；pot check 对游戏源码里的自由引用报警告。
 * - 网络只经 ctx.net（M5），存储只经 state，计时用 ctx.clock / ctx.timer。
 */

/** 所有宿主都有的全局对象（JS 内置之外的部分另列在 PORTABLE_HOST_GLOBALS） */
export const PORTABLE_HOST_GLOBALS = [
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask',
  'performance', 'URL', 'TextEncoder', 'TextDecoder', 'console', 'globalThis',
] as const

/** 宿主专有、在游戏代码里一律视为 undefined 的名字。require、module 由模块包装另给，不在这里 */
export const BLOCKED_GLOBALS = [
  'window', 'self', 'document', 'navigator', 'location', 'history',
  'localStorage', 'sessionStorage', 'indexedDB', 'caches',
  'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'Worker', 'SharedWorker',
  'Image', 'Audio', 'AudioContext', 'HTMLElement', 'HTMLCanvasElement', 'OffscreenCanvas',
  'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback',
  'alert', 'confirm', 'prompt', 'open', 'close',
  'process', 'Buffer', 'global', 'CS', 'puer',
] as const

/**
 * 把 bundle 代码包成屏蔽了 BLOCKED_GLOBALS 的模块工厂源码：
 *   (function (window, document, ...) { return function (exports, require, module, __filename) { 代码 } })()
 * 代码与包装头在同一行，报错行号不变。
 */
export function shieldModuleSource(code: string): string {
  return `(function (${BLOCKED_GLOBALS.join(', ')}) { return function (exports, require, module, __filename) {${code}\n} })()`
}
