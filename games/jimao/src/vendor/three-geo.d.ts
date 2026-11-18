// three-geo.js 的类型声明：只声明用到的导出，类型从宽（几何对象按 any 使用）。
export const Vector2: any
export const Vector3: any
export const Matrix4: any
export const Quaternion: any
export const Euler: any
export const BufferGeometry: any
export const BufferAttribute: any
export const Float32BufferAttribute: any
export const BoxGeometry: any
export const CylinderGeometry: any
export const SphereGeometry: any
export const ExtrudeGeometry: any
export const LatheGeometry: any
export const TubeGeometry: any
export const Shape: any
export const Path: any
export const CatmullRomCurve3: any
export function mergeGeometries(geometries: any[], useGroups?: boolean): any
export function mergeVertices(geometry: any, tolerance?: number): any
