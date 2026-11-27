/**
 * WebGL2 场景渲染（004 第 20.3 节，web-1 档）。
 * 光照照 PotLit 前向通道：URP BRDF（主光 + 最多 8 盏附加光）+ 平坦或三色环境光 + 发光 + exp2 雾，线性空间计算后转 sRGB 输出。
 * 材质模式：lit / lit-twosided / lit-cutout / lit-fade / unlit / unlit-fade / additive。
 * 网格：图元（geometry.ts）与 mesh:/skin: 自定义网格（mesh.ts，按 WebMesh.version 重建缓冲）；顶点属性 0 位置、1 法线、2 UV、3 顶点色（线性）、4 切线。
 * 材质贴图照 PotLit 的 PotSample：_MainTex/_BumpMap/_MaskMap 占单元 0/1/2，_Tiling、_UVMode（网格 UV、世界或物体三平面）、_Rest、_BumpScale、_Occlusion（只作用于间接光）。
 */
import { M4, multiply, perspective, rotateVector, srgbToLinear, viewFromCamera } from './math'
import { primitiveMesh } from './geometry'
import type { MeshSkinData } from './mesh'
import type { WebTexture } from './texture'
import { WebObject, WebScene } from './scene'

const MAX_LIGHTS = 8
/** 材质贴图单元：0 _MainTex、1 _BumpMap、2 _MaskMap */
const UNIT_MAIN = 0
const UNIT_BUMP = 1
const UNIT_MASK = 2
/** 骨骼矩阵贴图占用的纹理单元（0 起留给材质贴图） */
const BONE_UNIT = 7

const VS = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUV;
layout(location = 3) in vec4 aColor;
layout(location = 4) in vec4 aTangent;
layout(location = 12) in uvec4 aBones;
layout(location = 13) in vec4 aWeights;
uniform mat4 uModel;
uniform mat3 uNormalMat;
uniform mat4 uViewProj;
uniform int uSkinned;
uniform highp sampler2D uBones;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vUV;
out vec4 vColor;
out vec4 vTangent;
out vec3 vPosOS;
out vec3 vNormOS;
out vec3 vRestT;
mat4 boneMatrix(uint i) {
  int y = int(i);
  return mat4(texelFetch(uBones, ivec2(0, y), 0), texelFetch(uBones, ivec2(1, y), 0), texelFetch(uBones, ivec2(2, y), 0), texelFetch(uBones, ivec2(3, y), 0));
}
void main() {
  vec4 w;
  if (uSkinned == 1) {
    // 骨骼矩阵 = 骨骼世界矩阵 × bindPose，蒙皮结果直接在世界空间（同 SkinnedMeshRenderer）
    mat4 s = boneMatrix(aBones.x) * aWeights.x + boneMatrix(aBones.y) * aWeights.y + boneMatrix(aBones.z) * aWeights.z + boneMatrix(aBones.w) * aWeights.w;
    w = s * vec4(aPos, 1.0);
    vNormal = mat3(s) * aNormal;
    vTangent = vec4(mat3(s) * aTangent.xyz, aTangent.w);
  } else {
    w = uModel * vec4(aPos, 1.0);
    vNormal = uNormalMat * aNormal;
    vTangent = vec4(mat3(uModel) * aTangent.xyz, aTangent.w);
  }
  vWorld = w.xyz;
  vUV = aUV;
  vColor = aColor;
  // 物体空间位置与法线：蒙皮网格的顶点数据本身就是静止姿态（PotLit 的 restPos、restN）
  vPosOS = aPos;
  vNormOS = aNormal;
  vRestT = aTangent.xyz;
  gl_Position = uViewProj * w;
}`

const FS = `#version 300 es
precision highp float;
in vec3 vWorld;
in vec3 vNormal;
in vec2 vUV;
in vec4 vColor;
in vec4 vTangent;
in vec3 vPosOS;
in vec3 vNormOS;
in vec3 vRestT;
uniform mat4 uModel;
uniform sampler2D uMainTex;
uniform sampler2D uBumpMap;
uniform sampler2D uMaskMap;
uniform vec4 uTiling;
uniform float uUVMode;
uniform float uHasBump;
uniform float uHasMask;
uniform float uBumpScale;
uniform float uOcclusion;
uniform float uRest;
uniform float uOddNeg;
uniform vec3 uObjScale;
uniform vec4 uColor;
uniform float uVColor;
uniform vec3 uEmission;
uniform float uMetallic;
uniform float uSmooth;
uniform int uLit;
uniform int uFogMode;
uniform float uCutoff;
uniform vec3 uCamPos;
uniform vec3 uMainDir;
uniform vec3 uMainColor;
uniform int uLightCount;
uniform vec4 uLightPos[${MAX_LIGHTS}];
uniform vec3 uLightColor[${MAX_LIGHTS}];
uniform vec4 uLightDir[${MAX_LIGHTS}];
uniform vec2 uLightSpot[${MAX_LIGHTS}];
uniform vec3 uAmbSky;
uniform vec3 uAmbEquator;
uniform vec3 uAmbGround;
uniform float uReflection;
uniform vec3 uFogColor;
uniform float uFogDensity;
out vec4 outColor;

vec3 toSRGB(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

vec3 ambientFor(vec3 n) {
  float y = clamp(n.y, -1.0, 1.0);
  return y >= 0.0 ? mix(uAmbEquator, uAmbSky, y) : mix(uAmbEquator, uAmbGround, -y);
}

vec3 directBRDF(vec3 diffuse, vec3 specular, float r2, float normTerm, vec3 n, vec3 v, vec3 L, vec3 radiance) {
  vec3 h = L + v;
  h *= inversesqrt(max(dot(h, h), 1e-12));
  float NoH = clamp(dot(n, h), 0.0, 1.0);
  float LoH = clamp(dot(L, h), 0.0, 1.0);
  float d = NoH * NoH * (r2 - 1.0) + 1.00001;
  float specTerm = r2 / ((d * d) * max(0.1, LoH * LoH) * normTerm);
  return (diffuse + specular * specTerm) * radiance;
}

float fogTransmittance() {
  if (uFogDensity <= 0.0) return 1.0;
  float od = uFogDensity * length(vWorld - uCamPos);
  return exp(-od * od);
}

vec3 potUnpack(vec4 t) {
  vec3 n = t.xyz * 2.0 - 1.0;
  n.xy *= uBumpScale;
  n.z = sqrt(clamp(1.0 - dot(n.xy, n.xy), 0.0, 1.0));
  return n;
}

// 照 PotLit.shader 的 PotSample：基础色、遮罩、世界空间法线
void potSample(vec3 geomN, out vec4 base, out vec4 mask, out vec3 nWS) {
  mask = vec4(1.0);
  nWS = geomN;
  if (uUVMode < 0.5) {
    vec2 uv = vUV * uTiling.xy + uTiling.zw;
    base = texture(uMainTex, uv);
    if (uHasMask > 0.5) mask = texture(uMaskMap, uv);
    if (uHasBump > 0.5) {
      vec3 tn = potUnpack(texture(uBumpMap, uv));
      vec3 T = normalize(vTangent.xyz - geomN * dot(vTangent.xyz, geomN));
      vec3 B = cross(geomN, T) * (vTangent.w > 0.0 ? 1.0 : -1.0) * uOddNeg;
      nWS = normalize(tn.x * T + tn.y * B + tn.z * geomN);
    }
    return;
  }
  vec3 p;
  vec3 n;
  vec3 s = vec3(1.0);
  if (uUVMode < 1.5) {
    p = vWorld;
    n = geomN;
  } else {
    if (uRest < 0.5) s = uObjScale;
    p = vPosOS * s;
    n = normalize(vNormOS / s);
  }
  vec3 bw = pow(abs(n), vec3(6.0));
  bw /= (bw.x + bw.y + bw.z);
  vec3 sg = vec3(n.x >= 0.0 ? 1.0 : -1.0, n.y >= 0.0 ? 1.0 : -1.0, n.z >= 0.0 ? 1.0 : -1.0);
  vec2 uvX = p.zy; uvX.x *= sg.x;
  vec2 uvY = p.xz; uvY.x *= sg.y;
  vec2 uvZ = p.xy; uvZ.x *= -sg.z;
  uvX = uvX * uTiling.xy + uTiling.zw;
  uvY = uvY * uTiling.xy + uTiling.zw;
  uvZ = uvZ * uTiling.xy + uTiling.zw;
  base = texture(uMainTex, uvX) * bw.x + texture(uMainTex, uvY) * bw.y + texture(uMainTex, uvZ) * bw.z;
  if (uHasMask > 0.5) mask = texture(uMaskMap, uvX) * bw.x + texture(uMaskMap, uvY) * bw.y + texture(uMaskMap, uvZ) * bw.z;
  if (uHasBump > 0.5) {
    vec3 tx = potUnpack(texture(uBumpMap, uvX));
    vec3 ty = potUnpack(texture(uBumpMap, uvY));
    vec3 tz = potUnpack(texture(uBumpMap, uvZ));
    tx.x *= sg.x; ty.x *= sg.y; tz.x *= -sg.z;
    tx = vec3(tx.xy + n.zy, abs(tx.z) * n.x);
    ty = vec3(ty.xy + n.xz, abs(ty.z) * n.y);
    tz = vec3(tz.xy + n.xy, abs(tz.z) * n.z);
    vec3 nb = normalize(tx.zyx * bw.x + ty.xzy * bw.y + tz.xyz * bw.z);
    if (uUVMode < 1.5) nWS = nb;
    else if (uRest > 0.5) {
      // 静止标架（rT、rB、n）到蒙皮后的世界标架（T、B、geomN）
      vec3 rT = normalize(vRestT - n * dot(vRestT, n));
      vec3 rB = cross(n, rT);
      vec3 T = normalize(vTangent.xyz - geomN * dot(vTangent.xyz, geomN));
      vec3 B = cross(geomN, T);
      nWS = normalize(dot(nb, rT) * T + dot(nb, rB) * B + dot(nb, n) * geomN);
    } else nWS = normalize(mat3(uModel) * (nb / s));
  }
}

void main() {
  vec4 base;
  vec3 color;
  if (uLit == 1) {
    vec3 geomN = normalize(vNormal);
    if (!gl_FrontFacing) geomN = -geomN;
    vec4 mask;
    vec3 n;
    potSample(geomN, base, mask, n);
    base *= uColor;
    if (uVColor > 0.5) base *= vColor;
    if (uCutoff > 0.0 && base.a < uCutoff) discard;
    float metallic = uMetallic;
    float smoothness = uSmooth;
    float occ = 1.0;
    if (uHasMask > 0.5) {
      metallic *= mask.r;
      occ = mix(1.0, mask.g, uOcclusion);
      smoothness *= mask.a;
    }
    vec3 v = normalize(uCamPos - vWorld);
    float oneMinusRefl = 0.96 * (1.0 - metallic);
    vec3 diffuse = base.rgb * oneMinusRefl;
    vec3 specular = mix(vec3(0.04), base.rgb, metallic);
    float pr = 1.0 - smoothness;
    float roughness = max(pr * pr, 0.0078125);
    float r2 = max(roughness * roughness, 6.103515625e-5);
    float normTerm = roughness * 4.0 + 2.0;
    float grazing = clamp(smoothness + (1.0 - oneMinusRefl), 0.0, 1.0);
    float NoV = clamp(dot(n, v), 0.0, 1.0);
    float x = 1.0 - NoV;
    float fres = x * x * x * x;
    vec3 refl = ambientFor(reflect(-v, n)) * uReflection;
    // 遮罩 AO 只作用于间接光（URP indirectAmbientOcclusion）
    color = (ambientFor(n) * diffuse + refl * (1.0 / (r2 + 1.0)) * mix(specular, vec3(grazing), fres)) * occ;
    color += directBRDF(diffuse, specular, r2, normTerm, n, v, uMainDir, uMainColor * clamp(dot(n, uMainDir), 0.0, 1.0));
    for (int i = 0; i < ${MAX_LIGHTS}; i++) {
      if (i >= uLightCount) break;
      vec4 lp = uLightPos[i];
      vec3 L;
      float atten = 1.0;
      if (lp.w < 0.5) {
        L = uLightDir[i].xyz;
      } else {
        vec3 d = lp.xyz - vWorld;
        float dist2 = max(dot(d, d), 1e-4);
        L = d * inversesqrt(dist2);
        float f = dist2 * uLightDir[i].w;
        float s = clamp(1.0 - f * f, 0.0, 1.0);
        atten = s * s / dist2;
        if (lp.w > 1.5) {
          float sa = clamp(dot(-L, uLightDir[i].xyz) * uLightSpot[i].x + uLightSpot[i].y, 0.0, 1.0);
          atten *= sa * sa;
        }
      }
      color += directBRDF(diffuse, specular, r2, normTerm, n, v, L, uLightColor[i] * (atten * clamp(dot(n, L), 0.0, 1.0)));
    }
    color += uEmission;
  } else {
    base = texture(uMainTex, vUV * uTiling.xy + uTiling.zw) * uColor;
    if (uVColor > 0.5) base *= vColor;
    if (uCutoff > 0.0 && base.a < uCutoff) discard;
    color = base.rgb + uEmission;
  }
  float t = fogTransmittance();
  if (uFogMode == 2) color *= t;
  else if (uFogMode == 1) color = mix(uFogColor, color, t);
  outColor = vec4(toSRGB(color), base.a);
}`

interface GpuMesh {
  vao: WebGLVertexArrayObject
  count: number
  buffers: WebGLBuffer[]
  /** 自定义网格的数据版本（WebMesh.version） */
  version: number
}

interface ModeInfo {
  lit: boolean
  blend: 'none' | 'alpha' | 'add'
  cull: 'none' | 'front' | 'back'
  cutoff: number
  fog: number
}

function modeInfo(mode: string): ModeInfo {
  switch (mode) {
    case 'lit-fade': return { lit: true, blend: 'alpha', cull: 'back', cutoff: 0, fog: 1 }
    case 'lit-cutout': return { lit: true, blend: 'none', cull: 'back', cutoff: 0.5, fog: 1 }
    case 'lit-twosided': return { lit: true, blend: 'none', cull: 'none', cutoff: 0, fog: 1 }
    case 'unlit': return { lit: false, blend: 'none', cull: 'back', cutoff: 0, fog: 1 }
    case 'unlit-fade': return { lit: false, blend: 'alpha', cull: 'back', cutoff: 0, fog: 1 }
    case 'additive': return { lit: false, blend: 'add', cull: 'back', cutoff: 0, fog: 2 }
    default: return { lit: true, blend: 'none', cull: 'back', cutoff: 0, fog: 1 }
  }
}

function lin3(c: ArrayLike<number>, k = 1): [number, number, number] {
  return [srgbToLinear(c[0]) * k, srgbToLinear(c[1]) * k, srgbToLinear(c[2]) * k]
}

/** HDR 颜色（可大于 1）转线性：Unity Color.linear 对每个分量做 sRGB 解码 */
function linHdr(c: ArrayLike<number>): [number, number, number] {
  const f = (x: number) => (x <= 0 ? 0 : x <= 1 ? srgbToLinear(x) : Math.pow(x, 2.2))
  return [f(c[0]), f(c[1]), f(c[2])]
}

/** 模型矩阵左上 3×3 的逆转置，返回行列式（负值表示镜像缩放，需翻转正面绕序） */
function normalMatrix(m: ArrayLike<number>, out: Float32Array): number {
  const a00 = m[0], a01 = m[1], a02 = m[2]
  const a10 = m[4], a11 = m[5], a12 = m[6]
  const a20 = m[8], a21 = m[9], a22 = m[10]
  const b01 = a22 * a11 - a12 * a21
  const b11 = -a22 * a10 + a12 * a20
  const b21 = a21 * a10 - a11 * a20
  const det = a00 * b01 + a01 * b11 + a02 * b21
  const id = Math.abs(det) < 1e-20 ? 0 : 1 / det
  // 逆矩阵的转置（列主序）
  out[0] = b01 * id
  out[3] = (-a22 * a01 + a02 * a21) * id
  out[6] = (a12 * a01 - a02 * a11) * id
  out[1] = b11 * id
  out[4] = (a22 * a00 - a02 * a20) * id
  out[7] = (-a12 * a00 + a02 * a10) * id
  out[2] = b21 * id
  out[5] = (-a21 * a00 + a01 * a20) * id
  out[8] = (a11 * a00 - a01 * a10) * id
  return det
}

export class WebRenderer {
  readonly gl: WebGL2RenderingContext
  private program: WebGLProgram
  private loc: Record<string, WebGLUniformLocation | null> = {}
  private prims = new Map<string, GpuMesh | null>()
  private custom = new Map<string, GpuMesh>()
  private view: M4 = new Float32Array(16)
  private proj: M4 = new Float32Array(16)
  private viewProj: M4 = new Float32Array(16)
  private nmat = new Float32Array(9)
  private boneTex: WebGLTexture
  private boneRows = 1
  private boneData = new Float32Array(16)
  private tmp: M4 = new Float32Array(16)
  /** 贴图缓存：按 WebTexture 对象身份失效（id 不复用，destroy 或 clear 后对象不再存在） */
  private texs = new Map<number, { src: WebTexture; tex: WebGLTexture }>()
  private white: WebGLTexture
  private flatBump: WebGLTexture
  private bound: (WebGLTexture | null)[] = [null, null, null]
  private anisoExt: any
  private maxAniso = 1
  private static readonly IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
  private static readonly IDENTITY3 = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1])
  private static readonly TILING = [1, 1, 0, 0]
  /** 最近一帧的视投影矩阵与视口尺寸（worldToScreen / 拾取用） */
  lastViewProj: M4 = new Float32Array(16)
  lastWidth = 1
  lastHeight = 1

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
    this.program = this.link(VS, FS)
    const names = [
      'uModel', 'uNormalMat', 'uViewProj', 'uColor', 'uEmission', 'uMetallic', 'uSmooth', 'uLit', 'uFogMode', 'uCutoff', 'uCamPos',
      'uMainDir', 'uMainColor', 'uLightCount', 'uLightPos', 'uLightColor', 'uLightDir', 'uLightSpot',
      'uAmbSky', 'uAmbEquator', 'uAmbGround', 'uReflection', 'uFogColor', 'uFogDensity', 'uVColor', 'uSkinned', 'uBones',
      'uMainTex', 'uBumpMap', 'uMaskMap', 'uTiling', 'uUVMode', 'uHasBump', 'uHasMask', 'uBumpScale', 'uOcclusion', 'uRest',
      'uOddNeg', 'uObjScale',
    ]
    for (const n of names) this.loc[n] = gl.getUniformLocation(this.program, n)
    // 未启用的顶点属性取常量：没 UV 为 0，没顶点色为白，没切线为 +X，没蒙皮为骨骼 0 权重 1
    gl.vertexAttrib2f(2, 0, 0)
    gl.vertexAttrib4f(3, 1, 1, 1, 1)
    gl.vertexAttrib4f(4, 1, 0, 0, 1)
    gl.vertexAttribI4ui(12, 0, 0, 0, 0)
    gl.vertexAttrib4f(13, 1, 0, 0, 0)
    gl.useProgram(this.program)
    gl.uniform1i(this.loc.uBones, BONE_UNIT)
    this.boneTex = gl.createTexture()!
    gl.activeTexture(gl.TEXTURE0 + BONE_UNIT)
    gl.bindTexture(gl.TEXTURE_2D, this.boneTex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 4, 1, 0, gl.RGBA, gl.FLOAT, new Float32Array(16))
    gl.activeTexture(gl.TEXTURE0)
    gl.uniform1i(this.loc.uMainTex, UNIT_MAIN)
    gl.uniform1i(this.loc.uBumpMap, UNIT_BUMP)
    gl.uniform1i(this.loc.uMaskMap, UNIT_MASK)
    this.white = this.solid(255, 255, 255, 255)
    this.flatBump = this.solid(128, 128, 255, 255)
    this.anisoExt = gl.getExtension('EXT_texture_filter_anisotropic')
    if (this.anisoExt) this.maxAniso = gl.getParameter(this.anisoExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 1
  }

  /** 1×1 纯色贴图（缺省 _MainTex 为白，缺省 _BumpMap 为平坦法线） */
  private solid(r: number, g: number, b: number, a: number): WebGLTexture {
    const gl = this.gl
    const t = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([r, g, b, a]))
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.bindTexture(gl.TEXTURE_2D, null)
    return t
  }

  /** WebTexture → GPU 贴图（首次使用时上传）；颜色贴图用 SRGB8_ALPHA8，采样即得线性值 */
  private gpuTexture(t: WebTexture): WebGLTexture {
    const hit = this.texs.get(t.id)
    if (hit && hit.src === t) return hit.tex
    const gl = this.gl
    if (hit) gl.deleteTexture(hit.tex)
    const tex = gl.createTexture()!
    gl.activeTexture(gl.TEXTURE0 + UNIT_MAIN)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    this.bound[UNIT_MAIN] = tex
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    gl.texImage2D(gl.TEXTURE_2D, 0, t.linear ? gl.RGBA8 : gl.SRGB8_ALPHA8, t.width, t.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, t.data)
    if (t.mipmaps) gl.generateMipmap(gl.TEXTURE_2D)
    const wrap = t.wrap === 1 ? gl.CLAMP_TO_EDGE : gl.REPEAT
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap)
    const mag = t.filter === 0 ? gl.NEAREST : gl.LINEAR
    const min = !t.mipmaps ? mag : t.filter === 0 ? gl.NEAREST_MIPMAP_NEAREST : t.filter === 1 ? gl.LINEAR_MIPMAP_NEAREST : gl.LINEAR_MIPMAP_LINEAR
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, mag)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, min)
    if (this.anisoExt && t.aniso > 1 && t.filter > 0) {
      gl.texParameterf(gl.TEXTURE_2D, this.anisoExt.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(t.aniso, this.maxAniso))
    }
    this.texs.set(t.id, { src: t, tex })
    return tex
  }

  /** 释放已销毁贴图的 GPU 资源 */
  private sweepTextures(scene: WebScene): void {
    for (const [id, e] of this.texs) {
      if (scene.textures.get(id) !== e.src) {
        this.gl.deleteTexture(e.tex)
        this.texs.delete(id)
        for (let u = 0; u < this.bound.length; u++) if (this.bound[u] === e.tex) this.bound[u] = null
      }
    }
  }

  private bindUnit(unit: number, tex: WebGLTexture): void {
    if (this.bound[unit] === tex) return
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    this.bound[unit] = tex
  }

  /** 对象的材质贴图槽（o.ext.textures）→ 绑定到单元；不存在的贴图回到缺省 */
  private bindMaterialTextures(scene: WebScene, o: WebObject): void {
    const slots: Record<string, number> | undefined = o.ext.textures
    const pick = (slot: string, fallback: WebGLTexture) => {
      const t = slots && slots[slot] ? scene.textures.get(slots[slot]) : undefined
      return t ? this.gpuTexture(t) : fallback
    }
    const main = pick('map', this.white)
    const bump = pick('normal', this.flatBump)
    const mask = pick('mask', this.white)
    this.bindUnit(UNIT_MAIN, main)
    this.bindUnit(UNIT_BUMP, bump)
    this.bindUnit(UNIT_MASK, mask)
  }

  /** 蒙皮对象：把骨骼矩阵（骨骼世界矩阵 × bindPose）写进骨骼贴图；不是蒙皮或还没绑骨骼返回 false */
  private uploadBones(scene: WebScene, o: WebObject): boolean {
    const bones: number[] | undefined = o.ext.bones
    if (!bones || !o.shape.startsWith('skin:')) return false
    const skin = scene.meshes.get(o.shape.slice(5))?.skin
    if (!skin) return false
    const n = skin.bindPoses.length / 16
    if (this.boneData.length < n * 16) this.boneData = new Float32Array(n * 16)
    const bd = this.boneData
    for (let i = 0; i < n; i++) {
      const b = scene.get(bones[i])
      if (b) multiply(scene.worldMatrix(b), skin.bindPoses.subarray(i * 16, i * 16 + 16), this.tmp)
      else this.tmp.set(skin.bindPoses.subarray(i * 16, i * 16 + 16))
      bd.set(this.tmp, i * 16)
    }
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE0 + BONE_UNIT)
    gl.bindTexture(gl.TEXTURE_2D, this.boneTex)
    if (this.boneRows !== n) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 4, n, 0, gl.RGBA, gl.FLOAT, bd, 0)
      this.boneRows = n
    } else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 4, n, gl.RGBA, gl.FLOAT, bd, 0)
    gl.activeTexture(gl.TEXTURE0)
    return true
  }

  private link(vs: string, fs: string): WebGLProgram {
    const gl = this.gl
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('pot web: 着色器编译失败\n' + gl.getShaderInfoLog(s))
      return s
    }
    const p = gl.createProgram()!
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs))
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs))
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('pot web: 着色器链接失败\n' + gl.getProgramInfoLog(p))
    return p
  }

  private mesh(scene: WebScene, shape: string): GpuMesh | null {
    if (shape.startsWith('mesh:') || shape.startsWith('skin:')) {
      const name = shape.slice(5)
      const data = scene.meshes.get(name)
      let g = this.custom.get(name)
      if (g && (!data || g.version !== data.version)) {
        this.free(g)
        this.custom.delete(name)
        g = undefined
      }
      if (!data || data.vertexCount === 0 || data.indices.length === 0) return null
      if (!g) {
        g = this.upload(data.positions, data.normals, data.uvs, data.colors, data.tangents, data.indices, data.skin)
        g.version = data.version
        this.custom.set(name, g)
      }
      return g
    }
    if (this.prims.has(shape)) return this.prims.get(shape)!
    const data = primitiveMesh(shape)
    const m = data ? this.upload(data.positions, data.normals, data.uvs, null, null, data.indices) : null
    this.prims.set(shape, m)
    return m
  }

  private upload(positions: Float32Array, normals: Float32Array, uvs: Float32Array | null, colors: Float32Array | null,
    tangents: Float32Array | null, indices: Uint32Array, skin: MeshSkinData | null = null): GpuMesh {
    const gl = this.gl
    const vao = gl.createVertexArray()!
    const buffers: WebGLBuffer[] = []
    gl.bindVertexArray(vao)
    const attrib = (loc: number, arr: Float32Array | Uint32Array, size: number) => {
      const buf = gl.createBuffer()!
      buffers.push(buf)
      gl.bindBuffer(gl.ARRAY_BUFFER, buf)
      gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(loc)
      if (arr instanceof Uint32Array) gl.vertexAttribIPointer(loc, size, gl.UNSIGNED_INT, 0, 0)
      else gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0)
    }
    attrib(0, positions, 3)
    attrib(1, normals, 3)
    if (uvs) attrib(2, uvs, 2)
    if (colors) attrib(3, colors, 4)
    if (tangents) attrib(4, tangents, 4)
    if (skin) {
      attrib(12, skin.bones, 4)
      attrib(13, skin.weights, 4)
    }
    const ib = gl.createBuffer()!
    buffers.push(ib)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW)
    gl.bindVertexArray(null)
    return { vao, count: indices.length, buffers, version: 0 }
  }

  private free(m: GpuMesh): void {
    const gl = this.gl
    gl.deleteVertexArray(m.vao)
    for (const b of m.buffers) gl.deleteBuffer(b)
  }

  /** 画一帧到当前绑定的默认帧缓冲；width、height 为绘图缓冲像素尺寸 */
  render(scene: WebScene, width: number, height: number): void {
    const gl = this.gl
    const env = scene.env
    width = Math.max(1, width | 0)
    height = Math.max(1, height | 0)
    gl.viewport(0, 0, width, height)
    gl.clearColor(env.background[0], env.background[1], env.background[2], 1)
    gl.depthMask(true)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    const cam = scene.camera
    const camWorld = scene.worldMatrix(cam)
    viewFromCamera(camWorld, this.view)
    perspective(env.fov, width / height, env.near, env.far, this.proj)
    multiply(this.proj, this.view, this.viewProj)
    this.lastViewProj.set(this.viewProj)
    this.lastWidth = width
    this.lastHeight = height
    const camPos = [camWorld[12], camWorld[13], camWorld[14]]

    gl.useProgram(this.program)
    if (this.texs.size) this.sweepTextures(scene)
    const L = this.loc
    gl.uniformMatrix4fv(L.uViewProj, false, this.viewProj)
    gl.uniform3f(L.uCamPos, camPos[0], camPos[1], camPos[2])
    this.uploadEnvironment(scene)

    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)

    const opaque: WebObject[] = []
    const transparent: { o: WebObject; d: number }[] = []
    for (const o of scene.renderables()) {
      const mi = modeInfo(o.mat.mode)
      if (mi.blend === 'none') opaque.push(o)
      else {
        const w = scene.worldMatrix(o)
        const dx = w[12] - camPos[0], dy = w[13] - camPos[1], dz = w[14] - camPos[2]
        transparent.push({ o, d: dx * dx + dy * dy + dz * dz })
      }
    }
    transparent.sort((a, b) => b.d - a.d)

    gl.disable(gl.BLEND)
    gl.depthMask(true)
    for (const o of opaque) this.draw(scene, o)
    gl.enable(gl.BLEND)
    gl.depthMask(false)
    for (const t of transparent) this.draw(scene, t.o)
    gl.depthMask(true)
    gl.disable(gl.BLEND)
    gl.bindVertexArray(null)
  }

  private uploadEnvironment(scene: WebScene): void {
    const gl = this.gl
    const L = this.loc
    const env = scene.env
    const a = env.ambient
    if (a.mode === 'trilight') {
      gl.uniform3fv(L.uAmbSky, lin3(a.sky))
      gl.uniform3fv(L.uAmbEquator, lin3(a.equator))
      gl.uniform3fv(L.uAmbGround, lin3(a.ground))
    } else {
      const c = lin3(a.color)
      gl.uniform3fv(L.uAmbSky, c)
      gl.uniform3fv(L.uAmbEquator, c)
      gl.uniform3fv(L.uAmbGround, c)
    }
    gl.uniform1f(L.uReflection, a.reflection)
    gl.uniform3fv(L.uFogColor, lin3(env.fog.color))
    gl.uniform1f(L.uFogDensity, env.fog.density)

    const main = scene.mainLight()
    if (main?.light) {
      const f = rotateVector(scene.worldRotation(main), [0, 0, 1])
      gl.uniform3f(L.uMainDir, -f[0], -f[1], -f[2])
      gl.uniform3fv(L.uMainColor, lin3(main.light.color, main.light.intensity))
    } else {
      gl.uniform3f(L.uMainDir, 0, 1, 0)
      gl.uniform3f(L.uMainColor, 0, 0, 0)
    }

    const pos = new Float32Array(MAX_LIGHTS * 4)
    const col = new Float32Array(MAX_LIGHTS * 3)
    const dir = new Float32Array(MAX_LIGHTS * 4)
    const spot = new Float32Array(MAX_LIGHTS * 2)
    let n = 0
    for (const o of scene.lights()) {
      if (o === main || !o.light || n >= MAX_LIGHTS) continue
      const l = o.light
      const w = scene.worldMatrix(o)
      const f = rotateVector(scene.worldRotation(o), [0, 0, 1])
      const type = l.type === 'directional' ? 0 : l.type === 'point' ? 1 : 2
      pos.set([w[12], w[13], w[14], type], n * 4)
      col.set(lin3(l.color, l.intensity), n * 3)
      const invR2 = 1 / Math.max(1e-4, l.range * l.range)
      if (type === 0) dir.set([-f[0], -f[1], -f[2], invR2], n * 4)
      else dir.set([f[0], f[1], f[2], invR2], n * 4)
      if (type === 2) {
        // URP：外角为 spotAngle，内角缺省 2·atan(tan(外半角)·46/64)
        const half = (l.spotAngle * Math.PI) / 360
        const cosOuter = Math.cos(half)
        const cosInner = Math.cos(Math.atan(Math.tan(half) * (46 / 64)))
        const k = 1 / Math.max(0.001, cosInner - cosOuter)
        spot.set([k, -cosOuter * k], n * 2)
      }
      n++
    }
    gl.uniform1i(L.uLightCount, n)
    gl.uniform4fv(L.uLightPos, pos)
    gl.uniform3fv(L.uLightColor, col)
    gl.uniform4fv(L.uLightDir, dir)
    gl.uniform2fv(L.uLightSpot, spot)
  }

  private draw(scene: WebScene, o: WebObject): void {
    const m = this.mesh(scene, o.shape)
    if (!m) return
    const gl = this.gl
    const L = this.loc
    const mi = modeInfo(o.mat.mode)
    const skinned = this.uploadBones(scene, o)
    let det = 1
    let sx = 1, sy = 1, sz = 1
    if (skinned) {
      gl.uniformMatrix4fv(L.uModel, false, WebRenderer.IDENTITY)
      gl.uniformMatrix3fv(L.uNormalMat, false, WebRenderer.IDENTITY3)
    } else {
      const model = scene.worldMatrix(o)
      det = normalMatrix(model, this.nmat)
      gl.uniformMatrix4fv(L.uModel, false, model)
      gl.uniformMatrix3fv(L.uNormalMat, false, this.nmat)
      sx = Math.hypot(model[0], model[1], model[2])
      sy = Math.hypot(model[4], model[5], model[6])
      sz = Math.hypot(model[8], model[9], model[10])
    }
    gl.uniform1i(L.uSkinned, skinned ? 1 : 0)
    gl.uniform1f(L.uOddNeg, det < 0 ? -1 : 1)
    gl.uniform3f(L.uObjScale, sx, sy, sz)

    const cull = o.mat.cull ?? mi.cull
    if (cull === 'none') gl.disable(gl.CULL_FACE)
    else {
      gl.enable(gl.CULL_FACE)
      gl.cullFace(cull === 'front' ? gl.FRONT : gl.BACK)
    }
    gl.frontFace(det < 0 ? gl.CCW : gl.CW)

    if (mi.blend === 'add') gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
    else if (mi.blend === 'alpha') gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    const floats: Record<string, number> = o.ext.floats ?? {}
    const cutoff = floats._Cutoff ?? mi.cutoff
    const c = lin3(o.color)
    gl.uniform4f(L.uColor, c[0], c[1], c[2], mi.blend === 'none' && cutoff <= 0 ? 1 : o.color[3])
    gl.uniform3fv(L.uEmission, linHdr(o.mat.emission))
    gl.uniform1f(L.uMetallic, o.mat.metallic)
    gl.uniform1f(L.uSmooth, o.mat.smoothness)
    gl.uniform1i(L.uLit, mi.lit ? 1 : 0)
    gl.uniform1i(L.uFogMode, mi.lit ? mi.fog : Math.round(floats._FogMode ?? mi.fog))
    gl.uniform1f(L.uCutoff, cutoff)
    gl.uniform1f(L.uVColor, floats._VColor ?? 0)
    const tiling: number[] = o.ext.vectors?._Tiling ?? WebRenderer.TILING
    gl.uniform4f(L.uTiling, tiling[0], tiling[1], tiling[2], tiling[3])
    gl.uniform1f(L.uUVMode, floats._UVMode ?? 0)
    gl.uniform1f(L.uHasBump, floats._HasBump ?? 0)
    gl.uniform1f(L.uHasMask, floats._HasMask ?? 0)
    gl.uniform1f(L.uBumpScale, floats._BumpScale ?? 1)
    gl.uniform1f(L.uOcclusion, floats._Occlusion ?? 1)
    gl.uniform1f(L.uRest, floats._Rest ?? 0)
    this.bindMaterialTextures(scene, o)

    gl.bindVertexArray(m.vao)
    gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0)
  }

  dispose(): void {
    const gl = this.gl
    for (const m of this.prims.values()) if (m) this.free(m)
    for (const m of this.custom.values()) this.free(m)
    this.prims.clear()
    this.custom.clear()
    gl.deleteTexture(this.boneTex)
    for (const e of this.texs.values()) gl.deleteTexture(e.tex)
    this.texs.clear()
    gl.deleteTexture(this.white)
    gl.deleteTexture(this.flatBump)
    gl.deleteProgram(this.program)
  }
}
