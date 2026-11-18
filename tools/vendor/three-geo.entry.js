// three.js 纯几何子集（不含渲染器、DOM、加载器）。供游戏包在运行时用 Three.js 的建模算法生成网格。
// 生成：node tools/vendor/build-three-geo.js <输出路径>
// 只从 three/src 下的具体文件导入：three 主入口会带上 LoadingManager 等模块级副作用（new AbortController），Puerts 里没有这些全局对象。
// examples 里对 'three' 的导入由构建脚本重定向到 three-core.js。
export * from './three-core.js'
export { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
