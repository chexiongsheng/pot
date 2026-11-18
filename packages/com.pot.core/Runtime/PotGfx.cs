using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using UnityEngine;
using UnityEngine.Experimental.Rendering;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.Scripting;

namespace Pot
{
    /// <summary>
    /// 运行时着色器：游戏提供 GLSL ES 源码，原生插件 pot_gfx 在运行时编译（glslang → SPIR-V → SPIRV-Cross → 原生 API），
    /// 在 URP 的不透明/透明阶段之后按对象绘制。Runner 不需要为新材质重建。
    /// 统一变量按反射信息（std140 偏移）打包；内置量见 BuiltinNames。
    /// </summary>
    [Preserve]
    public static class PotGfx
    {
        const string Dll = "pot_gfx";

        [DllImport(Dll)] static extern IntPtr PotGfx_Backend();
        [DllImport(Dll)] static extern int PotGfx_Create(byte[] vs, byte[] fs);
        [DllImport(Dll)] static extern IntPtr PotGfx_Info();
        [DllImport(Dll)] static extern IntPtr PotGfx_Translate(byte[] vs, byte[] fs);
        [DllImport(Dll)] static extern void PotGfx_Destroy(int id);
        [DllImport(Dll)] static extern int PotGfx_Submit(byte[] data, int len);
        [DllImport(Dll)] static extern IntPtr PotGfx_RenderEvent();

        // flags 位（与 native/pot_gfx/src/backend.h 一致）
        const int F_CullMask = 3;
        const int F_DepthWrite = 1 << 2;
        const int F_BlendShift = 3;
        const int F_FrontCCW = 1 << 5;
        const int F_ReversedZ = 1 << 6;
        const int F_NoDepthTest = 1 << 7;
        /// <summary>JS 传入的 flags 只占低 5 位（剔除、写深度、混合）和 bit7（关深度测试）</summary>
        const int F_UserMask = F_CullMask | F_DepthWrite | (3 << F_BlendShift) | F_NoDepthTest;

        static bool? available;
        static string backendName = "";

        static byte[] Utf8(string s)
        {
            var n = Encoding.UTF8.GetByteCount(s ?? "");
            var b = new byte[n + 1];
            Encoding.UTF8.GetBytes(s ?? "", 0, (s ?? "").Length, b, 0);
            return b;
        }

        static string Str(IntPtr p)
        {
            return p == IntPtr.Zero ? "" : (Marshal.PtrToStringUTF8(p) ?? "");
        }

        /// <summary>原生插件是否可用；不可用时返回原因</summary>
        static string Check()
        {
            if (available == null)
            {
                try
                {
                    backendName = Str(PotGfx_Backend());
                    available = true;
                }
                catch (Exception e)
                {
                    Debug.LogWarning("[pot] 加载 pot_gfx 失败：" + e.Message);
                    available = false;
                }
            }
            if (available == false) return "Runner 未包含 pot_gfx 原生插件";
            if (string.IsNullOrEmpty(backendName)) return "当前图形 API（" + SystemInfo.graphicsDeviceType + "）不支持运行时着色器，目前支持 D3D11";
            return null;
        }

        /// <summary>后端名（d3d11）；不可用时返回空串</summary>
        [Preserve]
        public static string Backend()
        {
            return Check() == null ? backendName : "";
        }

        // ---------------- 程序 ----------------

        [Serializable] class ReflMember { public string name; public int offset; public string @base; public int vec; public int cols; public int array; public int arrayStride; public int matrixStride; }
        [Serializable] class ReflTex { public string name; public int slot; }
        [Serializable] class ReflStage { public int size; public ReflMember[] members; public ReflTex[] textures; }
        [Serializable] class Refl { public ReflStage vs; public ReflStage fs; }

        class GpuProgram
        {
            public int id;
            public ReflStage vs, fs;
            public readonly Dictionary<string, int> textures = new Dictionary<string, int>();
        }

        static readonly Dictionary<string, GpuProgram> programs = new Dictionary<string, GpuProgram>();

        /// <summary>
        /// 编译并注册程序（同名替换）。成功返回空串；失败返回错误信息，旧程序保持不变（热重载出错时画面不丢）。
        /// </summary>
        [Preserve]
        public static string Program(string name, string vs, string fs)
        {
            var why = Check();
            if (why != null) return why;
            var id = PotGfx_Create(Utf8(vs), Utf8(fs));
            var info = Str(PotGfx_Info());
            if (id == 0) return string.IsNullOrEmpty(info) ? "着色器编译失败" : info;
            var refl = JsonUtility.FromJson<Refl>(info);
            var p = new GpuProgram { id = id, vs = refl.vs ?? new ReflStage(), fs = refl.fs ?? new ReflStage() };
            AddTextures(p, p.vs);
            AddTextures(p, p.fs);
            GpuProgram old;
            if (programs.TryGetValue(name, out old)) PotGfx_Destroy(old.id);
            programs[name] = p;
            return "";
        }

        static void AddTextures(GpuProgram p, ReflStage s)
        {
            if (s.textures == null) return;
            foreach (var t in s.textures) p.textures[t.name] = t.slot;
        }

        /// <summary>只转译不创建，返回目标语言源码或错误（调试用）</summary>
        [Preserve]
        public static string Translate(string vs, string fs)
        {
            var why = Check();
            if (why != null) return why;
            return Str(PotGfx_Translate(Utf8(vs), Utf8(fs)));
        }

        [Preserve]
        public static void DestroyProgram(string name)
        {
            GpuProgram p;
            if (!programs.TryGetValue(name, out p)) return;
            programs.Remove(name);
            if (available == true) PotGfx_Destroy(p.id);
        }

        // ---------------- 对象绑定 ----------------

        class Binding
        {
            public int obj;
            public string program;
            public int flags;
            public int queue;
            public bool shadows;
            public readonly Dictionary<string, float[]> uniforms = new Dictionary<string, float[]>();
            public readonly Dictionary<string, int> textures = new Dictionary<string, int>();
        }

        static readonly Dictionary<int, Binding> bindings = new Dictionary<int, Binding>();
        static readonly HashSet<Mesh> uploaded = new HashSet<Mesh>();

        /// <summary>
        /// 让对象用运行时着色器绘制。program 为空串表示解除（恢复普通材质）。
        /// flags：bit0-1 剔除（0 背面 1 正面 2 不剔除）、bit2 写深度、bit3-4 混合（0 无 1 alpha 2 叠加 3 预乘）、bit7 关深度测试。
        /// queue：0 不透明之后，1 透明之后（由远到近）。shadows：1 仍用网格投射阴影。
        /// </summary>
        [Preserve]
        public static void Bind(int id, string program, int flags, int queue, int shadows)
        {
            var go = PotScene.GetObject(id);
            var r = go != null ? go.GetComponent<Renderer>() : null;
            if (string.IsNullOrEmpty(program))
            {
                if (bindings.Remove(id) && r != null)
                {
                    r.forceRenderingOff = false;
                    r.shadowCastingMode = ShadowCastingMode.On;
                }
                return;
            }
            Binding b;
            if (!bindings.TryGetValue(id, out b)) bindings[id] = b = new Binding { obj = id };
            b.program = program;
            b.flags = flags & F_UserMask;
            b.queue = queue;
            b.shadows = shadows != 0;
            if (r != null)
            {
                // 保留 Unity 渲染器只为投射阴影；正常绘制由 pot_gfx 完成
                if (b.shadows)
                {
                    r.forceRenderingOff = false;
                    r.shadowCastingMode = ShadowCastingMode.ShadowsOnly;
                }
                else r.forceRenderingOff = true;
            }
            var mf = go != null ? go.GetComponent<MeshFilter>() : null;
            if (mf != null && mf.sharedMesh != null && uploaded.Add(mf.sharedMesh)) mf.sharedMesh.UploadMeshData(false);
        }

        /// <summary>设置标量或向量统一变量（n 为分量数 1-4）</summary>
        [Preserve]
        public static void Uniform(int id, string name, int n, float x, float y, float z, float w)
        {
            var b = Find(id);
            if (b == null) return;
            float[] v;
            if (!b.uniforms.TryGetValue(name, out v) || v.Length != 4) b.uniforms[name] = v = new float[4];
            v[0] = x; v[1] = y; v[2] = z; v[3] = w;
        }

        /// <summary>设置矩阵或数组统一变量：Float32 数据，矩阵按列主序（与 GLSL、three.js 相同）</summary>
        [Preserve]
        public static void UniformArray(int id, string name, Puerts.ArrayBuffer data)
        {
            var b = Find(id);
            if (b == null || data == null || data.Bytes == null) return;
            var f = new float[data.Count / 4];
            Buffer.BlockCopy(data.Bytes, 0, f, 0, f.Length * 4);
            b.uniforms[name] = f;
        }

        /// <summary>绑定贴图（pot 贴图 id，0 表示解除）。采样方式取贴图自身的 wrap/filter/aniso</summary>
        [Preserve]
        public static void Texture(int id, string name, int tex)
        {
            var b = Find(id);
            if (b == null) return;
            if (tex == 0) b.textures.Remove(name);
            else b.textures[name] = tex;
        }

        /// <summary>冷重启：释放全部程序与绑定</summary>
        internal static void Clear()
        {
            if (available == true)
                foreach (var p in programs.Values) PotGfx_Destroy(p.id);
            programs.Clear();
            bindings.Clear();
            bakes.Clear();
            uploaded.Clear();
        }

        // ---------------- URP 接入 ----------------

        class GfxPass : ScriptableRenderPass
        {
            readonly int queue;

            public GfxPass(int queue, RenderPassEvent evt)
            {
                this.queue = queue;
                renderPassEvent = evt;
            }

            public override void OnCameraSetup(CommandBuffer cmd, ref RenderingData renderingData)
            {
                var r = renderingData.cameraData.renderer;
                ConfigureTarget(r.cameraColorTargetHandle, r.cameraDepthTargetHandle);
            }

            public override void Execute(ScriptableRenderContext context, ref RenderingData renderingData)
            {
                var len = Pack(queue, ref renderingData.cameraData, ref renderingData);
                if (len <= 0) return;
                var slot = PotGfx_Submit(frame.GetBuffer(), len);
                var cmd = CommandBufferPool.Get("PotGfx");
                cmd.IssuePluginEventAndData(PotGfx_RenderEvent(), 0, (IntPtr)slot);
                context.ExecuteCommandBuffer(cmd);
                CommandBufferPool.Release(cmd);
            }
        }

        static GfxPass opaquePass, transparentPass;

        internal static void BeginCamera(ScriptableRenderContext ctx, Camera cam)
        {
            if (bindings.Count == 0 || available != true || string.IsNullOrEmpty(backendName)) return;
            if (cam != PotScene.Camera) return;
            var data = cam.GetUniversalAdditionalCameraData();
            if (data == null || data.scriptableRenderer == null) return;
            if (opaquePass == null)
            {
                opaquePass = new GfxPass(0, RenderPassEvent.AfterRenderingOpaques);
                transparentPass = new GfxPass(1, RenderPassEvent.AfterRenderingTransparents);
            }
            data.scriptableRenderer.EnqueuePass(opaquePass);
            data.scriptableRenderer.EnqueuePass(transparentPass);
        }

        // ---------------- 每帧打包 ----------------

        /// <summary>内置统一变量（预置代码里声明，见 js/runtime/src/gfx.ts）</summary>
        static readonly Dictionary<string, float[]> builtins = new Dictionary<string, float[]>();
        static readonly MemoryStream frame = new MemoryStream(4096);
        static readonly BinaryWriter writer = new BinaryWriter(frame);
        static readonly List<Binding> drawList = new List<Binding>();
        static readonly List<float> drawDist = new List<float>();
        static readonly Plane[] planes = new Plane[6];
        static byte[] block = new byte[256];
        static readonly float[] tmp16 = new float[16];
        static readonly Vector3[] shDirs = { Vector3.up, Vector3.forward, Vector3.down };
        static readonly Color[] shOut = new Color[3];
        static readonly int sunDirId = Shader.PropertyToID("_PotSunDir");
        static readonly int sunColorId = Shader.PropertyToID("_PotSunColor");
        static readonly int fogColorId = Shader.PropertyToID("_PotFogColor");
        static readonly int fogDensityId = Shader.PropertyToID("_PotFogDensity");
        static readonly int fogHeightId = Shader.PropertyToID("_PotFogHeight");
        static readonly int fogBaseId = Shader.PropertyToID("_PotFogBase");
        static readonly int fogSunId = Shader.PropertyToID("_PotFogSun");

        static float[] Builtin(string name, int n)
        {
            float[] v;
            if (!builtins.TryGetValue(name, out v)) builtins[name] = v = new float[n];
            return v;
        }

        static void SetMat(string name, Matrix4x4 m)
        {
            var v = Builtin(name, 16);
            for (var i = 0; i < 16; i++) v[i] = m[i];
        }

        static void SetVec(string name, float x, float y, float z, float w)
        {
            var v = Builtin(name, 4);
            v[0] = x; v[1] = y; v[2] = z; v[3] = w;
        }

        static void SetVec(string name, Vector4 c)
        {
            SetVec(name, c.x, c.y, c.z, c.w);
        }

        static void FrameBuiltins(Camera cam, Matrix4x4 gpuProj)
        {
            var view = cam.worldToCameraMatrix;
            SetMat("pot_View", view);
            SetMat("pot_Proj", gpuProj);
            SetMat("pot_ViewProj", gpuProj * view);
            var cp = cam.transform.position;
            SetVec("pot_CameraPos", cp.x, cp.y, cp.z, 1);
            SetVec("pot_Time", Time.time, Time.deltaTime, Time.frameCount, Time.unscaledTime);
            float w = cam.pixelWidth, h = cam.pixelHeight;
            SetVec("pot_ScreenSize", w, h, 1f / Mathf.Max(1, w), 1f / Mathf.Max(1, h));
            SetVec("pot_SunDir", Shader.GetGlobalVector(sunDirId));
            SetVec("pot_SunColor", Shader.GetGlobalVector(sunColorId));
            RenderSettings.ambientProbe.Evaluate(shDirs, shOut);
            SetVec("pot_AmbientSky", shOut[0].r, shOut[0].g, shOut[0].b, 1);
            SetVec("pot_AmbientEquator", shOut[1].r, shOut[1].g, shOut[1].b, 1);
            SetVec("pot_AmbientGround", shOut[2].r, shOut[2].g, shOut[2].b, 1);
            // 雾与 PotCommon.hlsl 同源（_PotFog*，由 scene.fog 设置），不读 RenderSettings
            var fc = Shader.GetGlobalVector(fogColorId);
            SetVec("pot_Fog", fc.x, fc.y, fc.z, Shader.GetGlobalFloat(fogDensityId));
            SetVec("pot_FogParams", Shader.GetGlobalFloat(fogHeightId), Shader.GetGlobalFloat(fogBaseId), Shader.GetGlobalFloat(fogSunId), 0);
            SetVec("pot_Env", RenderSettings.reflectionIntensity, PotRender.EnvTexture != null ? 1 : 0, 0, 0);
            var pc = PotRender.PlanarCamera;
            var planarOn = pc != null && pc != cam && PotRender.PlanarTexture != null;
            SetVec("pot_Planar", planarOn ? 1 : 0, PotRender.PlanarHeight, 0, 0);
            // 非 GPU 投影：uv = ndc.xy*0.5+0.5（Unity 在 D3D 上翻转 RT 的渲染方向，与 gfx.bake 同约定）
            SetMat("pot_PlanarVP", planarOn ? pc.projectionMatrix * pc.worldToCameraMatrix : Matrix4x4.identity);
        }

        static void ObjectBuiltins(Transform t)
        {
            var m = t.localToWorldMatrix;
            var inv = m.inverse;
            SetMat("pot_Model", m);
            SetMat("pot_ModelInv", inv);
            // 法线矩阵 = (M^-1)^T 的左上 3x3，列主序
            var n = Builtin("pot_NormalMatrix", 9);
            for (var c = 0; c < 3; c++)
                for (var r = 0; r < 3; r++) n[c * 3 + r] = inv[c, r];
        }

        static readonly int shadowMapId = Shader.PropertyToID("_MainLightShadowmapTexture");
        static readonly float[] shadowMats = new float[64];
        static readonly float[] shadowSpheres = new float[16];
        static int shadowFrame = -1;
        static Camera shadowCam;
        static Texture shadowTex;

        /// <summary>
        /// 主光阴影：按 URP MainLightShadowCasterPass.Setup 的同一算法复算级联矩阵（全局变量要到 Submit 才生效，
        /// 读 _MainLightShadowmapWorldToShadow 只能拿到上一帧）。贴图取 URP 的 shadowmap（RTHandle 跨帧稳定）。
        /// </summary>
        static Texture ShadowBuiltins(ref RenderingData rd)
        {
            var cam = rd.cameraData.camera;
            if (shadowFrame == Time.frameCount && shadowCam == cam) return shadowTex;
            shadowFrame = Time.frameCount;
            shadowCam = cam;
            shadowTex = null;
            SetVec("pot_ShadowParams", 0, 0, 0, 0);
            ref var sd = ref rd.shadowData;
            var li = rd.lightData.mainLightIndex;
            if (!sd.supportsMainLightShadows || li < 0) return null;
            var vl = rd.lightData.visibleLights[li];
            var light = vl.light;
            if (light == null || light.shadows == LightShadows.None || vl.lightType != LightType.Directional) return null;
            if (!rd.cullResults.GetShadowCasterBounds(li, out _)) return null;
            var tex = Shader.GetGlobalTexture(shadowMapId);
            if (tex == null) return null;
            var n = Mathf.Clamp(sd.mainLightShadowCascadesCount, 1, 4);
            var res = ShadowUtils.GetMaxTileResolutionInAtlas(sd.mainLightShadowmapWidth, sd.mainLightShadowmapHeight, n);
            var w = sd.mainLightShadowmapWidth;
            var h = n == 2 ? sd.mainLightShadowmapHeight >> 1 : sd.mainLightShadowmapHeight;
            Array.Clear(shadowSpheres, 0, 16);
            for (var c = 0; c < n; c++)
            {
                if (!ShadowUtils.ExtractDirectionalLightMatrix(ref rd.cullResults, ref sd, li, c, w, h, res, light.shadowNearPlane,
                        out var sphere, out var slice)) return null;
                var m = slice.shadowTransform;
                for (var i = 0; i < 16; i++) shadowMats[c * 16 + i] = m[i];
                shadowSpheres[c * 4] = sphere.x; shadowSpheres[c * 4 + 1] = sphere.y;
                shadowSpheres[c * 4 + 2] = sphere.z; shadowSpheres[c * 4 + 3] = sphere.w;
            }
            builtins["pot_ShadowMatrix"] = shadowMats;
            builtins["pot_ShadowSpheres"] = shadowSpheres;
            SetVec("pot_ShadowParams", light.shadowStrength, n, rd.cameraData.maxShadowDistance, SystemInfo.usesReversedZBuffer ? 1 : 0);
            shadowTex = tex;
            return tex;
        }

        // ---------------- 附加光源（点光 / 聚光） ----------------

        const int MaxLights = 16;
        struct GfxLight { public Vector3 pos; public float range; public Vector4 color, spot, atten; public float lum; }
        static readonly List<GfxLight> frameLights = new List<GfxLight>();
        static int lightFrame = -1;
        static Camera lightCam;
        static readonly float[] lightPos = new float[MaxLights * 4];
        static readonly float[] lightColor = new float[MaxLights * 4];
        static readonly float[] lightSpot = new float[MaxLights * 4];
        static readonly float[] lightAtten = new float[MaxLights * 4];
        static readonly int[] pick = new int[MaxLights];
        static readonly float[] pickScore = new float[MaxLights];

        /// <summary>本帧可见的附加光源（URP 剔除结果，除主光外的点光、聚光），参数与 URP 的 InitializeLightConstants 一致</summary>
        static void LightBuiltins(ref RenderingData rd)
        {
            var cam = rd.cameraData.camera;
            if (lightFrame == Time.frameCount && lightCam == cam) return;
            lightFrame = Time.frameCount;
            lightCam = cam;
            frameLights.Clear();
            builtins["pot_LightPos"] = lightPos;
            builtins["pot_LightColor"] = lightColor;
            builtins["pot_LightSpot"] = lightSpot;
            builtins["pot_LightAtten"] = lightAtten;
            var vls = rd.lightData.visibleLights;
            for (var i = 0; i < vls.Length; i++)
            {
                if (i == rd.lightData.mainLightIndex) continue;
                var vl = vls[i];
                if (vl.lightType != LightType.Point && vl.lightType != LightType.Spot) continue;
                var c = vl.finalColor;
                var lum = c.r * 0.2126f + c.g * 0.7152f + c.b * 0.0722f;
                if (lum <= 0) continue;
                var m = vl.localToWorldMatrix;
                var gl = new GfxLight { pos = m.GetColumn(3), range = Mathf.Max(vl.range, 1e-3f), color = new Vector4(c.r, c.g, c.b, 0), lum = lum };
                if (vl.lightType == LightType.Spot)
                {
                    var fw = (Vector3)m.GetColumn(2);
                    var cosOuter = Mathf.Cos(Mathf.Deg2Rad * vl.spotAngle * 0.5f);
                    var inner = vl.light != null ? vl.light.innerSpotAngle : vl.spotAngle * 0.8f;
                    var cosInner = Mathf.Cos(Mathf.Deg2Rad * inner * 0.5f);
                    var inv = 1f / Mathf.Max(0.001f, cosInner - cosOuter);
                    gl.spot = new Vector4(-fw.x, -fw.y, -fw.z, 0);
                    gl.atten = new Vector4(inv, -cosOuter * inv, 0, 0);
                }
                else
                {
                    gl.spot = new Vector4(0, 0, 1, 0);
                    gl.atten = new Vector4(0, 1, 0, 0);
                }
                frameLights.Add(gl);
            }
        }

        /// <summary>按物体包围盒挑最多 16 个影响它的附加光（包围盒与光照范围相交，按 亮度/距离² 取前 16）</summary>
        static void ObjectLights(Renderer r, Vector3 fallback)
        {
            var n = 0;
            var bounds = r != null ? r.bounds : new Bounds(fallback, Vector3.zero);
            for (var i = 0; i < frameLights.Count; i++)
            {
                var l = frameLights[i];
                var d2 = bounds.SqrDistance(l.pos);
                if (d2 >= l.range * l.range) continue;
                var score = l.lum / (d2 + 1f);
                if (n < MaxLights) { pick[n] = i; pickScore[n] = score; n++; continue; }
                var worst = 0;
                for (var k = 1; k < MaxLights; k++) if (pickScore[k] < pickScore[worst]) worst = k;
                if (score > pickScore[worst]) { pick[worst] = i; pickScore[worst] = score; }
            }
            for (var k = 0; k < n; k++)
            {
                var l = frameLights[pick[k]];
                var o = k * 4;
                lightPos[o] = l.pos.x; lightPos[o + 1] = l.pos.y; lightPos[o + 2] = l.pos.z; lightPos[o + 3] = 1f / (l.range * l.range);
                lightColor[o] = l.color.x; lightColor[o + 1] = l.color.y; lightColor[o + 2] = l.color.z; lightColor[o + 3] = 0;
                lightSpot[o] = l.spot.x; lightSpot[o + 1] = l.spot.y; lightSpot[o + 2] = l.spot.z; lightSpot[o + 3] = 0;
                lightAtten[o] = l.atten.x; lightAtten[o + 1] = l.atten.y; lightAtten[o + 2] = 0; lightAtten[o + 3] = 0;
            }
            SetVec("pot_LightCount", n, 0, 0, 0);
        }

        static int AttrFormat(VertexAttributeFormat f, int dim)
        {
            if (f == VertexAttributeFormat.Float32) return dim == 2 ? 1 : dim == 3 ? 2 : dim == 4 ? 3 : 0;
            if (f == VertexAttributeFormat.UNorm8 && dim == 4) return 4;
            if (f == VertexAttributeFormat.Float16) return dim == 2 ? 5 : dim == 4 ? 6 : 0;
            return 0;
        }

        static readonly VertexAttribute[] attrs = { VertexAttribute.Position, VertexAttribute.Normal, VertexAttribute.TexCoord0, VertexAttribute.Color, VertexAttribute.Tangent };

        static int SamplerBits(Texture t)
        {
            var bits = 0;
            if (t.wrapMode == TextureWrapMode.Clamp) bits |= 1;
            bits |= (t.filterMode == FilterMode.Point ? 0 : t.filterMode == FilterMode.Bilinear ? 1 : 2) << 1;
            if (t.anisoLevel > 1) bits |= 8;
            if (GraphicsFormatUtility.IsSRGBFormat(t.graphicsFormat)) bits |= 16;
            return bits;
        }

        /// <summary>按反射把统一变量写进 std140 块</summary>
        static int WriteBlock(ReflStage s, Binding b)
        {
            var size = (s.size + 15) & ~15;
            if (size <= 0 || s.members == null) return 0;
            if (block.Length < size) block = new byte[Mathf.NextPowerOfTwo(size)];
            Array.Clear(block, 0, size);
            foreach (var m in s.members)
            {
                float[] src;
                if (!b.uniforms.TryGetValue(m.name, out src) && !builtins.TryGetValue(m.name, out src)) continue;
                var cols = Mathf.Max(1, m.cols);
                var vec = Mathf.Max(1, m.vec);
                var count = Mathf.Max(1, m.array);
                var elem = cols * vec;
                var isInt = m.@base != "f";
                for (var e = 0; e < count; e++)
                {
                    var eoff = m.offset + e * m.arrayStride;
                    for (var c = 0; c < cols; c++)
                    {
                        var coff = eoff + c * m.matrixStride;
                        for (var k = 0; k < vec; k++)
                        {
                            var si = e * elem + c * vec + k;
                            if (si >= src.Length) goto next;
                            var at = coff + k * 4;
                            if (at + 4 > size) continue;
                            if (isInt)
                            {
                                var iv = (int)src[si];
                                block[at] = (byte)iv; block[at + 1] = (byte)(iv >> 8); block[at + 2] = (byte)(iv >> 16); block[at + 3] = (byte)(iv >> 24);
                            }
                            else
                            {
                                tmp16[0] = src[si];
                                Buffer.BlockCopy(tmp16, 0, block, at, 4);
                            }
                        }
                    }
                }
                next:;
            }
            writer.Write(size);
            writer.Write(block, 0, size);
            return size;
        }

        static int Pack(int queue, ref CameraData cameraData, ref RenderingData renderingData)
        {
            var cam = cameraData.camera;
            drawList.Clear();
            drawDist.Clear();
            GeometryUtility.CalculateFrustumPlanes(cam, planes);
            var camPos = cam.transform.position;
            List<int> dead = null;
            foreach (var kv in bindings)
            {
                var b = kv.Value;
                if (b.queue != queue) continue;
                var go = PotScene.GetObject(b.obj);
                if (go == null) { (dead ??= new List<int>()).Add(kv.Key); continue; }
                if (!go.activeInHierarchy || !programs.ContainsKey(b.program)) continue;
                var r = go.GetComponent<Renderer>();
                if (r != null && !GeometryUtility.TestPlanesAABB(planes, r.bounds)) continue;
                drawList.Add(b);
                drawDist.Add(queue == 1 ? (go.transform.position - camPos).sqrMagnitude : 0);
            }
            if (dead != null) foreach (var id in dead) bindings.Remove(id);
            if (drawList.Count == 0) return 0;
            if (queue == 1)
            {
                // 透明：由远到近
                var idx = new int[drawList.Count];
                for (var i = 0; i < idx.Length; i++) idx[i] = i;
                Array.Sort(idx, (a, c) => drawDist[c].CompareTo(drawDist[a]));
                var sorted = new Binding[idx.Length];
                for (var i = 0; i < idx.Length; i++) sorted[i] = drawList[idx[i]];
                drawList.Clear();
                drawList.AddRange(sorted);
            }

            var flipped = cameraData.IsCameraProjectionMatrixFlipped();
            FrameBuiltins(cam, GL.GetGPUProjectionMatrix(cam.projectionMatrix, flipped));
            var shadowMap = ShadowBuiltins(ref renderingData);
            LightBuiltins(ref renderingData);
            var frameFlags = (flipped ? F_FrontCCW : 0) | (SystemInfo.usesReversedZBuffer ? F_ReversedZ : 0);
            var env = PotRender.EnvTexture;

            frame.SetLength(0);
            writer.Write(0);
            var count = 0;
            foreach (var b in drawList)
            {
                var go = PotScene.GetObject(b.obj);
                var mf = go.GetComponent<MeshFilter>();
                var mesh = mf != null ? mf.sharedMesh : null;
                if (mesh == null || mesh.vertexCount == 0) continue;
                ObjectBuiltins(go.transform);
                ObjectLights(go.GetComponent<Renderer>(), go.transform.position);
                if (WriteDraw(b, programs[b.program], mesh, b.flags | frameFlags, env, shadowMap)) count++;
            }
            return Finish(count);
        }

        static int Finish(int count)
        {
            if (count == 0) return 0;
            var len = (int)frame.Position;
            frame.Position = 0;
            writer.Write(count);
            frame.Position = len;
            return len;
        }

        /// <summary>写出一个 draw（网格须已 UploadMeshData，位置在流 0）；内置量须已设置好</summary>
        static bool WriteDraw(Binding b, GpuProgram p, Mesh mesh, int flags, Texture env, Texture shadowMap = null)
        {
            if (mesh.GetVertexAttributeStream(VertexAttribute.Position) != 0) return false;
            var vb = mesh.GetNativeVertexBufferPtr(0);
            var ib = mesh.GetNativeIndexBufferPtr();
            if (vb == IntPtr.Zero || ib == IntPtr.Zero) return false;
            var sub = mesh.GetSubMesh(0);

            writer.Write(p.id);
            writer.Write(flags);
            writer.Write(vb.ToInt64());
            writer.Write(ib.ToInt64());
            writer.Write(mesh.GetVertexBufferStride(0));
            writer.Write(mesh.indexFormat == IndexFormat.UInt32 ? 1 : 0);
            writer.Write(sub.indexStart);
            writer.Write(sub.indexCount);
            writer.Write(sub.baseVertex);
            foreach (var a in attrs)
                writer.Write(mesh.HasVertexAttribute(a) && mesh.GetVertexAttributeStream(a) == 0 ? mesh.GetVertexAttributeOffset(a) : 0);
            foreach (var a in attrs)
                writer.Write(mesh.HasVertexAttribute(a) && mesh.GetVertexAttributeStream(a) == 0 ? AttrFormat(mesh.GetVertexAttributeFormat(a), mesh.GetVertexAttributeDimension(a)) : 0);

            // 贴图
            var texPos = frame.Position;
            writer.Write(0);
            var nt = 0;
            foreach (var t in p.textures)
            {
                Texture tex = null;
                int texId;
                if (t.Key == "pot_EnvMap") tex = env;
                else if (t.Key == "pot_ShadowMap") tex = shadowMap != null ? shadowMap : Texture2D.whiteTexture;
                else if (t.Key == "pot_PlanarMap") tex = PotRender.PlanarTexture != null ? PotRender.PlanarTexture : Texture2D.blackTexture;
                else if (b.textures.TryGetValue(t.Key, out texId)) tex = PotScene.GetTexture(texId);
                if (tex == null) continue;
                var ptr = tex.GetNativeTexturePtr();
                if (ptr == IntPtr.Zero) continue;
                writer.Write(t.Value);
                writer.Write(t.Key == "pot_EnvMap" || t.Key == "pot_PlanarMap" ? (1 | (2 << 1)) : t.Key == "pot_ShadowMap" ? 1 : SamplerBits(tex));
                writer.Write(ptr.ToInt64());
                nt++;
            }
            var endPos = frame.Position;
            frame.Position = texPos;
            writer.Write(nt);
            frame.Position = endPos;

            if (WriteBlock(p.vs, b) == 0) writer.Write(0);
            if (WriteBlock(p.fs, b) == 0) writer.Write(0);
            return true;
        }

        // ---------------- 烘焙到贴图 ----------------

        /// <summary>烘焙用的临时绑定（负 id，与对象绑定分开存放）</summary>
        static readonly Dictionary<int, Binding> bakes = new Dictionary<int, Binding>();
        static int nextBake = -1;
        static Mesh bakeQuad;

        static Binding Find(int id)
        {
            Binding b;
            if (id < 0) bakes.TryGetValue(id, out b);
            else bindings.TryGetValue(id, out b);
            return b;
        }

        /// <summary>开始一次烘焙：返回临时绑定 id（负数），之后用 Uniform/UniformArray/Texture 设参数，再调用 Bake</summary>
        [Preserve]
        public static int BakeBegin()
        {
            var id = nextBake;
            nextBake = nextBake <= -0x3fffffff ? -1 : nextBake - 1;
            bakes[id] = new Binding { obj = id };
            return id;
        }

        static Mesh BakeQuad()
        {
            if (bakeQuad != null) return bakeQuad;
            // 位置即裁剪坐标（xy 在 [-1,1]），UV 0..1。D3D 等 UV 原点在上的平台，v=0 对应显存第 0 行即裁剪 y=+1
            var top = SystemInfo.graphicsUVStartsAtTop;
            Func<float, float> y = v => top ? 1 - 2 * v : 2 * v - 1;
            bakeQuad = new Mesh { name = "pot_bake_quad" };
            bakeQuad.vertices = new[] { new Vector3(-1, y(0), 0), new Vector3(1, y(0), 0), new Vector3(1, y(1), 0), new Vector3(-1, y(1), 0) };
            bakeQuad.uv = new[] { new Vector2(0, 0), new Vector2(1, 0), new Vector2(1, 1), new Vector2(0, 1) };
            bakeQuad.normals = new[] { Vector3.back, Vector3.back, Vector3.back, Vector3.back };
            bakeQuad.triangles = new[] { 0, 1, 2, 0, 2, 3 };
            bakeQuad.UploadMeshData(false);
            return bakeQuad;
        }

        static GraphicsFormat BakeFormat(string f)
        {
            switch (f)
            {
                case "srgb": return GraphicsFormat.R8G8B8A8_SRGB;
                case "rgba16f": return GraphicsFormat.R16G16B16A16_SFloat;
                case "rgba32f": return GraphicsFormat.R32G32B32A32_SFloat;
                case "r8": return GraphicsFormat.R8_UNorm;
                case "rg8": return GraphicsFormat.R8G8_UNorm;
                default: return GraphicsFormat.R8G8B8A8_UNorm;
            }
        }

        /// <summary>
        /// 用程序画一个全屏四边形到新建的贴图（可多目标 MRT，片元着色器按 layout(location=i) 输出）。
        /// targets："格式,mip,wrap,filter,aniso" 以分号分隔；格式 rgba8/srgb/rgba16f/rgba32f/r8/rg8，wrap 0 重复 1 夹取，filter 0 点 1 双线性 2 三线性。
        /// blend 为 flags 的混合位（0 无）。返回贴图 id 列表（逗号分隔），出错返回 "!原因"。临时绑定随之释放。
        /// </summary>
        [Preserve]
        public static string Bake(int bindId, string program, int width, int height, string targets, int blend)
        {
            Binding b;
            if (!bakes.TryGetValue(bindId, out b)) return "!无效的烘焙句柄";
            bakes.Remove(bindId);
            var why = Check();
            if (why != null) return "!" + why;
            GpuProgram p;
            if (!programs.TryGetValue(program ?? "", out p)) return "!程序不存在：" + program;
            if (width <= 0 || height <= 0 || width > 8192 || height > 8192) return "!尺寸无效：" + width + "x" + height;
            var specs = (targets ?? "").Split(new[] { ';' }, StringSplitOptions.RemoveEmptyEntries);
            if (specs.Length == 0 || specs.Length > 8) return "!目标数应为 1 到 8";

            var rts = new RenderTexture[specs.Length];
            var ids = new RenderTargetIdentifier[specs.Length];
            var mips = new bool[specs.Length];
            for (var i = 0; i < specs.Length; i++)
            {
                var s = specs[i].Split(',');
                var fmt = BakeFormat(s[0].Trim());
                var mip = s.Length > 1 && s[1] == "1";
                var desc = new RenderTextureDescriptor(width, height, fmt, 0, mip ? -1 : 1)
                {
                    useMipMap = mip,
                    autoGenerateMips = false,
                    msaaSamples = 1,
                };
                var rt = new RenderTexture(desc) { name = "pot_bake" };
                rt.wrapMode = s.Length > 2 && s[2] == "1" ? TextureWrapMode.Clamp : TextureWrapMode.Repeat;
                var filter = s.Length > 3 ? s[3] : "2";
                rt.filterMode = filter == "0" ? FilterMode.Point : filter == "1" || !mip ? FilterMode.Bilinear : FilterMode.Trilinear;
                int aniso;
                rt.anisoLevel = s.Length > 4 && int.TryParse(s[4], out aniso) ? aniso : 1;
                rt.Create();
                rts[i] = rt;
                ids[i] = rt;
                mips[i] = mip;
            }

            // 内置量：单位模型矩阵；视图/投影保持上一帧的值（烘焙着色器一般用不到）
            SetMat("pot_Model", Matrix4x4.identity);
            SetMat("pot_ModelInv", Matrix4x4.identity);
            var n = Builtin("pot_NormalMatrix", 9);
            for (var i = 0; i < 9; i++) n[i] = i % 4 == 0 ? 1 : 0;
            SetVec("pot_ScreenSize", width, height, 1f / width, 1f / height);
            SetVec("pot_Time", Time.time, Time.deltaTime, Time.frameCount, Time.unscaledTime);

            frame.SetLength(0);
            writer.Write(0);
            // 不剔除、不写深度、关深度测试
            var flags = 2 | ((blend & 3) << F_BlendShift) | F_NoDepthTest;
            var sp = Builtin("pot_ShadowParams", 4);
            var savedStrength = sp[0];
            sp[0] = 0; // 烘焙不接收阴影
            var lc = Builtin("pot_LightCount", 4);
            var savedLights = lc[0];
            lc[0] = 0; // 也不受附加光、平面反射影响
            var pl = Builtin("pot_Planar", 4);
            var savedPlanar = pl[0];
            pl[0] = 0;
            var ok = WriteDraw(b, p, BakeQuad(), flags, PotRender.EnvTexture);
            sp[0] = savedStrength;
            lc[0] = savedLights;
            pl[0] = savedPlanar;
            var len = Finish(ok ? 1 : 0);
            if (len <= 0)
            {
                foreach (var rt in rts) UnityEngine.Object.Destroy(rt);
                return "!无法提交烘焙";
            }
            var slot = PotGfx_Submit(frame.GetBuffer(), len);
            var cmd = new CommandBuffer { name = "PotGfx.Bake" };
            if (ids.Length == 1) cmd.SetRenderTarget(ids[0]);
            else cmd.SetRenderTarget(ids, ids[0]);
            cmd.ClearRenderTarget(false, true, Color.clear);
            cmd.IssuePluginEventAndData(PotGfx_RenderEvent(), 0, (IntPtr)slot);
            for (var i = 0; i < rts.Length; i++) if (mips[i]) cmd.GenerateMips(rts[i]);
            Graphics.ExecuteCommandBuffer(cmd);
            cmd.Release();

            var sb = new StringBuilder();
            for (var i = 0; i < rts.Length; i++)
            {
                if (i > 0) sb.Append(',');
                sb.Append(PotScene.RegisterTexture(rts[i]));
            }
            return sb.ToString();
        }
    }
}
