/**
 * pot 开发工具（JS 侧）。构建为 com.pot.devtools/Runtime/Resources/pot/devtools.cjs，
 * 加载后挂到 globalThis.pot.devtools。发布构建不引用 com.pot.devtools 即不包含。
 */
export { attach, handle, toPlain } from './agent'
export { reload, checkLeaks } from './hmr'
export type { ReloadOptions, ReloadResult } from './hmr'
