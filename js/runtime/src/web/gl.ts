/**
 * WebGL2 场景渲染（004 第 20.3 节，web-1 档）。
 * 光照照 PotLit 前向通道：URP BRDF（主光 + 最多 8 盏附加光）+ 平坦或三色环境光 + 发光 + exp2 雾，线性空间计算后转 sRGB 输出。
 * 材质模式：lit / lit-twosided / lit-cutout / lit-fade / unlit / unlit-fade / additive。
 * 网格：图元（geometry.ts）与 mesh:/skin: 自定义网格（mesh.ts，按 WebMesh.version 重建缓冲）；顶点属性 0 位置、1 法线、2 UV、3 顶点色（线性）、4 切线。
 */
import { M4, multiply, perspective, rotateVector, srgbToLinear, viewFromCamera } from './math'
import { primitiveMesh } from './geometry'
import { WebObject, WebScene } from './scene'

const MAX_LIGHTS = 8

const VS = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUV;
layout(location = 3) in vec4 aColor;
layout(location = 4) in vec4 aTangent;
uniform mat4 uModel;
uniform mat3 uNormalMat;
uniform mat4 uViewProj;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vUV;
out vec4 vColor;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vWorld = w.xyz;
  vNormal = uNormalMat * aNormal;
  vUV = aUV;
  vColor = aColor;
  gl_Position = uViewProj * w;
}`

const FS = `#version 300 es
precision highp float;
in vec3 vWorld;
in vec3 vNormal;
in vec2 vUV;
in vec4 vColor;
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

void main() {
  vec4 base = uColor;
  if (uVColor > 0.5) base *= vColor;
  if (uCutoff > 0.0 && base.a < uCutoff) discard;
  vec3 color;
  if (uLit == 1) {
    vec3 n = normalize(vNormal);
    if (!gl_FrontFacing) n = -n;
    vec3 v = normalize(uCamPos - vWorld);
    float oneMinusRefl = 0.96 * (1.0 - uMetallic);
    vec3 diffuse = base.rgb * oneMinusRefl;
    vec3 specular = mix(vec3(0.04), base.rgb, uMetallic);
    float pr = 1.0 - uSmooth;
    float roughness = max(pr * pr, 0.0078125);
    float r2 = max(roughness * roughness, 6.103515625e-5);
    float normTerm = roughness * 4.0 + 2.0;
    float grazing = clamp(uSmooth + (1.0 - oneMinusRefl), 0.0, 1.0);
    float NoV = clamp(dot(n, v), 0.0, 1.0);
    float x = 1.0 - NoV;
    float fres = x * x * x * x;
    vec3 refl = ambientFor(reflect(-v, n)) * uReflection;
    color = ambientFor(n) * diffuse + refl * (1.0 / (r2 + 1.0)) * mix(specular, vec3(grazing), fres);
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
    color = base.rgb;
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
      'uAmbSky', 'uAmbEquator', 'uAmbGround', 'uReflection', 'uFogColor', 'uFogDensity', 'uVColor',
    ]
    for (const n of names) this.loc[n] = gl.getUniformLocation(this.program, n)
    // 未启用的顶点属性取常量：没 UV 为 0，没顶点色为白，没切线为 +X
    gl.vertexAttrib2f(2, 0, 0)
    gl.vertexAttrib4f(3, 1, 1, 1, 1)
    gl.vertexAttrib4f(4, 1, 0, 0, 1)
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
        g = this.upload(data.positions, data.normals, data.uvs, data.colors, data.tangents, data.indices)
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
    tangents: Float32Array | null, indices: Uint32Array): GpuMesh {
    const gl = this.gl
    const vao = gl.createVertexArray()!
    const buffers: WebGLBuffer[] = []
    gl.bindVertexArray(vao)
    const attrib = (loc: number, arr: Float32Array, size: number) => {
      const buf = gl.createBuffer()!
      buffers.push(buf)
      gl.bindBuffer(gl.ARRAY_BUFFER, buf)
      gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0)
    }
    attrib(0, positions, 3)
    attrib(1, normals, 3)
    if (uvs) attrib(2, uvs, 2)
    if (colors) attrib(3, colors, 4)
    if (tangents) attrib(4, tangents, 4)
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
    const model = scene.worldMatrix(o)
    const det = normalMatrix(model, this.nmat)
    gl.uniformMatrix4fv(L.uModel, false, model)
    gl.uniformMatrix3fv(L.uNormalMat, false, this.nmat)

    const cull = o.mat.cull ?? mi.cull
    if (cull === 'none') gl.disable(gl.CULL_FACE)
    else {
      gl.enable(gl.CULL_FACE)
      gl.cullFace(cull === 'front' ? gl.FRONT : gl.BACK)
    }
    gl.frontFace(det < 0 ? gl.CCW : gl.CW)

    if (mi.blend === 'add') gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
    else if (mi.blend === 'alpha') gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    const c = lin3(o.color)
    gl.uniform4f(L.uColor, c[0], c[1], c[2], mi.blend === 'none' && mi.cutoff === 0 ? 1 : o.color[3])
    gl.uniform3fv(L.uEmission, linHdr(o.mat.emission))
    gl.uniform1f(L.uMetallic, o.mat.metallic)
    gl.uniform1f(L.uSmooth, o.mat.smoothness)
    gl.uniform1i(L.uLit, mi.lit ? 1 : 0)
    gl.uniform1i(L.uFogMode, mi.fog)
    gl.uniform1f(L.uCutoff, mi.cutoff)
    gl.uniform1f(L.uVColor, o.ext.floats?._VColor ?? 0)

    gl.bindVertexArray(m.vao)
    gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0)
  }

  dispose(): void {
    const gl = this.gl
    for (const m of this.prims.values()) if (m) this.free(m)
    for (const m of this.custom.values()) this.free(m)
    this.prims.clear()
    this.custom.clear()
    gl.deleteProgram(this.program)
  }
}
