/**
 * Web 原生宿主入口（004 第 20 节），构建为 dist/web.js，挂到 globalThis.pot.web。
 * 浏览器里先加载 core.cjs（globalThis.pot），再加载本文件。
 */
export * from './math'
export * from './scene'
