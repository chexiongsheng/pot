/**
 * three 方言：让 three.js（r180）的 ShaderChunk / MeshStandardMaterial 着色器原文（含 onBeforeCompile 补丁）
 * 直接在 pot_gfx 上编译运行。
 *
 * - 前缀：GLSL3 宏（varying/attribute/texture2D/gl_FragColor）、矩阵与相机（映射到 pot_* 内置）、顶点属性
 * - #include <chunk>：先查本文件的覆盖表，再查 three 原版 chunk，最后查 pot 内置库
 * - 光照：三方 lights_pars 保持原样（灯数为 0），lights_fragment_begin/maps 改为读取 pot 的太阳、附加光、
 *   半球环境光与环境反射；量纲按 three 约定（直射光色 = pot 光色 × π，iblIrradiance = π × 环境光）
 * - 雾：USE_FOG 时用 pot_ApplyFog（场景雾），three 的 fogColor/fogNear 等 uniform 不再需要
 * - 输出：线性 HDR，不做色调映射（与 three 渲染到 HalfFloat 目标、NoToneMapping 时一致）
 * - 坐标：pot_View 已把 Unity 左手系转为右手视空间，与 three 的视空间一致，three 的视空间光照无需改动
 */
import { THREE_CHUNKS, THREE_PHYSICAL } from './three-chunks'
import { parseColor, Texture } from './scene'
import type { Color, ShaderBinding, UniformValue } from './scene'

export type Defines = Record<string, string | number | boolean>

/** three 原版 chunk（只读） */
export const threeChunks: Readonly<Record<string, string>> = THREE_CHUNKS

const LIGHT_NUMS = [
  'NUM_DIR_LIGHTS', 'NUM_SPOT_LIGHTS', 'NUM_SPOT_LIGHT_MAPS', 'NUM_SPOT_LIGHT_COORDS', 'NUM_RECT_AREA_LIGHTS',
  'NUM_POINT_LIGHTS', 'NUM_HEMI_LIGHTS', 'NUM_DIR_LIGHT_SHADOWS', 'NUM_SPOT_LIGHT_SHADOWS',
  'NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS', 'NUM_POINT_LIGHT_SHADOWS', 'NUM_CLIPPING_PLANES', 'UNION_CLIPPING_PLANES',
].map((n) => `#define ${n} 0`).join('\n')

const COMMON_PREFIX = `#define HIGH_PRECISION
${LIGHT_NUMS}
// glslang 的 Vulkan 宽松规则里 average 是保留名，three 的 common 定义了同名函数
#define average pot3_average
#define texture2D texture
#define cameraPosition (pot_CameraPos.xyz)
#define isOrthographic (pot_Proj[3][3] > 0.5)
#define viewMatrix pot_View
`

const VERTEX_PREFIX = `${COMMON_PREFIX}#define attribute in
#define varying out
#define modelMatrix pot_Model
#define projectionMatrix pot_Proj
#define modelViewMatrix (pot_View * pot_Model)
#define normalMatrix (mat3(pot_View) * pot_NormalMatrix)
layout(location = 0) in vec3 position;
layout(location = 1) in vec3 normal;
layout(location = 2) in vec2 uv;
#if defined(USE_COLOR_ALPHA)
layout(location = 3) in vec4 color;
#elif defined(USE_COLOR)
layout(location = 3) in vec3 color;
#endif
#ifdef USE_TANGENT
layout(location = 4) in vec4 tangent;
#endif
out vec3 pot3_vWorldPos;
vec3 pot3_SrgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
`

const FRAGMENT_PREFIX = `${COMMON_PREFIX}#define varying in
layout(location = 0) out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
#define gl_FragDepthEXT gl_FragDepth
#define textureCube texture
#define texture2DProj textureProj
#define texture2DLodEXT textureLod
#define texture2DProjLodEXT textureProjLod
#define textureCubeLodEXT textureLod
#define texture2DGradEXT textureGrad
#define texture2DProjGradEXT textureProjGrad
#define textureCubeGradEXT textureGrad
uniform float envMapIntensity;
in vec3 pot3_vWorldPos;
${THREE_CHUNKS.colorspace_pars_fragment}
vec4 linearToOutputTexel(vec4 value) { return value; }
float luminance(const in vec3 rgb) {
  const vec3 weights = vec3(0.2126729, 0.7151522, 0.0721750);
  return dot(weights, rgb);
}
#include <pot/lit>
`

/** 各阶段的方言前缀（在 pot 内置 uniform 之后、材质 defines 之后） */
export function threePrefix(stage: 'vertex' | 'fragment') {
  return stage === 'vertex' ? VERTEX_PREFIX : FRAGMENT_PREFIX
}

/** 覆盖 three 原版的 chunk（光照、雾、世界坐标、顶点色） */
export const THREE_OVERRIDES: Record<string, string> = {
  worldpos_vertex: `vec4 worldPosition = vec4( transformed, 1.0 );
worldPosition = modelMatrix * worldPosition;
pot3_vWorldPos = worldPosition.xyz;
`,
  // pot 的网格顶点色按 sRGB 存储，three 期望线性
  color_vertex: `#if defined( USE_COLOR_ALPHA )
	vColor = vec4( pot3_SrgbToLinear( color.rgb ), color.a );
#elif defined( USE_COLOR )
	vColor = pot3_SrgbToLinear( color.rgb );
#endif
`,
  fog_pars_vertex: '',
  fog_vertex: '',
  fog_pars_fragment: '',
  fog_fragment: `#ifdef USE_FOG
	gl_FragColor.rgb = pot_ApplyFog( gl_FragColor.rgb, pot3_vWorldPos );
#endif
`,
  lights_fragment_begin: `vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif

IncidentLight directLight;

#if defined( RE_Direct )
	// 太阳（pot_SunDir 为世界空间、指向光源；three 光色 = pot 光色 × π）
	directLight.direction = normalize( ( viewMatrix * vec4( pot_SunDir.xyz, 0.0 ) ).xyz );
	directLight.color = pot_SunColor.rgb * PI;
	#ifndef POT3_NO_SHADOW
	directLight.color *= pot_Shadow( pot3_vWorldPos );
	#endif
	directLight.visible = true;
	RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );

	// 附加光（点光、聚光，URP 衰减）
	int pot3LightCount = int( pot_LightCount.x + 0.5 );
	for ( int i = 0; i < 16; i ++ ) {
		if ( i >= pot3LightCount ) break;
		vec3 dl = pot_LightPos[ i ].xyz - pot3_vWorldPos;
		float d2 = max( dot( dl, dl ), 1e-4 );
		vec3 l = dl * inversesqrt( d2 );
		float f = d2 * pot_LightPos[ i ].w;
		float sm = clamp( 1.0 - f * f, 0.0, 1.0 );
		float sp = clamp( dot( pot_LightSpot[ i ].xyz, l ) * pot_LightAtten[ i ].x + pot_LightAtten[ i ].y, 0.0, 1.0 );
		float att = sm * sm / d2 * sp * sp;
		if ( att <= 0.0 ) continue;
		directLight.direction = normalize( ( viewMatrix * vec4( l, 0.0 ) ).xyz );
		directLight.color = pot_LightColor[ i ].rgb * ( PI * att );
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
#endif

#if defined( RE_IndirectDiffuse )
	// 环境光按 scene.environment 的方式进入 iblIrradiance（π × 环境辐亮度）
	vec3 iblIrradiance = PI * pot_Hemisphere( inverseTransformDirection( geometryNormal, viewMatrix ) );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
#endif

#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif
`,
  lights_fragment_maps: `#if defined( RE_IndirectSpecular )
	{
		vec3 pot3R = reflect( - geometryViewDir, geometryNormal );
		pot3R = normalize( mix( pot3R, geometryNormal, material.roughness * material.roughness ) );
		radiance += pot_EnvReflection( inverseTransformDirection( pot3R, viewMatrix ), material.roughness ) * envMapIntensity;
		#ifdef USE_CLEARCOAT
		vec3 pot3C = reflect( - geometryViewDir, geometryClearcoatNormal );
		clearcoatRadiance += pot_EnvReflection( inverseTransformDirection( pot3C, viewMatrix ), material.clearcoatRoughness ) * envMapIntensity;
		#endif
	}
#endif
`,
}

/** 三方言下 #include <name> 的解析：覆盖表 → three chunk；未找到返回 undefined（再由调用方查 pot 内置库） */
export function threeInclude(name: string): string | undefined {
  return THREE_OVERRIDES[name] ?? THREE_CHUNKS[name]
}

/** three 的 { value } 形式 uniform */
export interface ThreeUniform { value: any }

/** onBeforeCompile 收到的对象（与 three 的 WebGLProgramParametersWithUniforms 同名字段） */
export interface ThreeShaderObject {
  vertexShader: string
  fragmentShader: string
  uniforms: Record<string, ThreeUniform>
  defines: Defines
}

type Rgb = Color | number

export interface StandardMaterialOptions {
  /** 程序名前缀（相当于 material.name / customProgramCacheKey），便于日志定位 */
  name?: string
  /** 基础色：'#rrggbb' 或 0xrrggbb（sRGB），[r, g, b]（线性，同 three 的 new Color(r, g, b)） */
  color?: Rgb
  roughness?: number
  metalness?: number
  emissive?: Rgb
  emissiveIntensity?: number
  map?: Texture
  normalMap?: Texture
  normalScale?: number | [number, number]
  roughnessMap?: Texture
  metalnessMap?: Texture
  aoMap?: Texture
  aoMapIntensity?: number
  emissiveMap?: Texture
  alphaMap?: Texture
  /** 所有贴图的 UV 变换（同 texture.repeat / offset） */
  repeat?: [number, number]
  offset?: [number, number]
  /** 顶点色；'alpha' 同时使用 alpha 通道 */
  vertexColors?: boolean | 'alpha'
  transparent?: boolean
  opacity?: number
  alphaTest?: number
  side?: 'front' | 'back' | 'double'
  /** 场景雾，默认 true */
  fog?: boolean
  flatShading?: boolean
  depthWrite?: boolean
  depthTest?: boolean
  /** 环境反射强度，默认 1 */
  envMapIntensity?: number
  /** 投射阴影（castShadow），默认 true */
  castShadow?: boolean
  /** 接收太阳阴影（receiveShadow），默认 true */
  receiveShadow?: boolean
  defines?: Defines
  /** 额外 uniform（普通值或 three 的 { value }） */
  uniforms?: Record<string, UniformValue | ThreeUniform>
  /** 与 three 相同：编译前修改 vertexShader / fragmentShader / uniforms / defines */
  onBeforeCompile?: (shader: ThreeShaderObject) => void
}

function linearRgb(c: Rgb): [number, number, number] {
  const s2l = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
  if (typeof c === 'number') return [s2l((c >> 16 & 255) / 255), s2l((c >> 8 & 255) / 255), s2l((c & 255) / 255)]
  if (typeof c === 'string') {
    const [r, g, b] = parseColor(c)
    return [s2l(r), s2l(g), s2l(b)]
  }
  return [c[0], c[1], c[2]]
}

const MAPS = [
  ['map', 'MAP'], ['normalMap', 'NORMALMAP'], ['roughnessMap', 'ROUGHNESSMAP'], ['metalnessMap', 'METALNESSMAP'],
  ['aoMap', 'AOMAP'], ['emissiveMap', 'EMISSIVEMAP'], ['alphaMap', 'ALPHAMAP'],
] as const

/** MeshStandardMaterial 的源码、defines、uniform 与绘制状态（已执行 onBeforeCompile） */
export function buildStandard(o: StandardMaterialOptions) {
  const defines: Defines = {}
  const uniforms: Record<string, ThreeUniform> = {
    diffuse: { value: linearRgb(o.color ?? 0xffffff) },
    opacity: { value: o.opacity ?? 1 },
    roughness: { value: o.roughness ?? 1 },
    metalness: { value: o.metalness ?? 0 },
    emissive: { value: linearRgb(o.emissive ?? 0).map((v) => v * (o.emissiveIntensity ?? 1)) },
    envMapIntensity: { value: o.envMapIntensity ?? 1 },
  }
  const [rx, ry] = o.repeat ?? [1, 1]
  const [ox, oy] = o.offset ?? [0, 0]
  const transform = [rx, 0, 0, 0, ry, 0, ox, oy, 1]
  for (const [key, macro] of MAPS) {
    const tex = o[key]
    if (!tex) continue
    defines[`USE_${macro}`] = true
    defines[`${macro}_UV`] = 'uv'
    uniforms[key] = { value: tex }
    uniforms[`${key}Transform`] = { value: transform }
  }
  if (o.normalMap) {
    defines.USE_NORMALMAP_TANGENTSPACE = true
    const s = o.normalScale ?? 1
    uniforms.normalScale = { value: typeof s === 'number' ? [s, s] : s }
  }
  if (o.aoMap) uniforms.aoMapIntensity = { value: o.aoMapIntensity ?? 1 }
  if (o.vertexColors) defines[o.vertexColors === 'alpha' ? 'USE_COLOR_ALPHA' : 'USE_COLOR'] = true
  if (o.alphaTest) {
    defines.USE_ALPHATEST = true
    uniforms.alphaTest = { value: o.alphaTest }
  }
  if (!o.transparent) defines.OPAQUE = true
  if (o.fog !== false) defines.USE_FOG = true
  if (o.flatShading) defines.FLAT_SHADED = true
  if (o.side === 'double') defines.DOUBLE_SIDED = true
  if (o.side === 'back') defines.FLIP_SIDED = true
  if (o.receiveShadow === false) defines.POT3_NO_SHADOW = true
  Object.assign(defines, o.defines)
  for (const [k, v] of Object.entries(o.uniforms ?? {})) {
    uniforms[k] = v !== null && typeof v === 'object' && 'value' in (v as any) && !(v instanceof Texture) ? v as ThreeUniform : { value: v }
  }

  const shader: ThreeShaderObject = { vertexShader: THREE_PHYSICAL.vertex, fragmentShader: THREE_PHYSICAL.fragment, uniforms, defines }
  o.onBeforeCompile?.(shader)

  const state: ShaderBinding = {
    cull: o.side === 'double' ? 'none' : o.side === 'back' ? 'front' : 'back',
    blend: o.transparent ? 'alpha' : 'none',
    queue: o.transparent ? 'transparent' : 'opaque',
    depthWrite: o.depthWrite ?? true,
    depthTest: o.depthTest ?? true,
    shadows: o.castShadow ?? true,
  }
  return { shader, state }
}

/** 把 { value } 形式的 uniform 取当前值，转成 ShaderBinding.uniforms */
export function resolveUniforms(uniforms: Record<string, ThreeUniform>): Record<string, UniformValue> {
  const out: Record<string, UniformValue> = {}
  for (const [k, u] of Object.entries(uniforms)) {
    const v = u?.value
    if (v === undefined) continue
    if (v !== null && typeof v === 'object' && !(v instanceof Texture) && !ArrayLikeCheck(v)) {
      // three 的 Color / Vector：{ r, g, b } 或 { x, y, z, w }
      if ('r' in v) out[k] = [v.r, v.g, v.b]
      else if ('x' in v) out[k] = 'w' in v ? [v.x, v.y, v.z, v.w] : 'z' in v ? [v.x, v.y, v.z] : [v.x, v.y]
      else if ('elements' in v) out[k] = v.elements
      continue
    }
    out[k] = v
  }
  return out
}

function ArrayLikeCheck(v: any) {
  return Array.isArray(v) || ArrayBuffer.isView(v)
}
