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
            Binding b;
            if (!bindings.TryGetValue(id, out b)) return;
            float[] v;
            if (!b.uniforms.TryGetValue(name, out v) || v.Length != 4) b.uniforms[name] = v = new float[4];
            v[0] = x; v[1] = y; v[2] = z; v[3] = w;
        }

        /// <summary>设置矩阵或数组统一变量：Float32 数据，矩阵按列主序（与 GLSL、three.js 相同）</summary>
        [Preserve]
        public static void UniformArray(int id, string name, Puerts.ArrayBuffer data)
        {
            Binding b;
            if (!bindings.TryGetValue(id, out b) || data == null || data.Bytes == null) return;
            var f = new float[data.Count / 4];
            Buffer.BlockCopy(data.Bytes, 0, f, 0, f.Length * 4);
            b.uniforms[name] = f;
        }

        /// <summary>绑定贴图（pot 贴图 id，0 表示解除）。采样方式取贴图自身的 wrap/filter/aniso</summary>
        [Preserve]
        public static void Texture(int id, string name, int tex)
        {
            Binding b;
            if (!bindings.TryGetValue(id, out b)) return;
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
                var len = Pack(queue, ref renderingData.cameraData);
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
            var fc = RenderSettings.fogColor.linear;
            SetVec("pot_Fog", fc.r, fc.g, fc.b, RenderSettings.fog ? RenderSettings.fogDensity : 0);
            SetVec("pot_Env", RenderSettings.reflectionIntensity, PotRender.EnvTexture != null ? 1 : 0, 0, 0);
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

        static int Pack(int queue, ref CameraData cameraData)
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
                if (mesh.GetVertexAttributeStream(VertexAttribute.Position) != 0) continue;
                var vb = mesh.GetNativeVertexBufferPtr(0);
                var ib = mesh.GetNativeIndexBufferPtr();
                if (vb == IntPtr.Zero || ib == IntPtr.Zero) continue;
                var p = programs[b.program];
                ObjectBuiltins(go.transform);
                var sub = mesh.GetSubMesh(0);

                writer.Write(p.id);
                writer.Write(b.flags | frameFlags);
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
                    else if (b.textures.TryGetValue(t.Key, out texId)) tex = PotScene.GetTexture(texId);
                    if (tex == null) continue;
                    var ptr = tex.GetNativeTexturePtr();
                    if (ptr == IntPtr.Zero) continue;
                    writer.Write(t.Value);
                    writer.Write(t.Key == "pot_EnvMap" ? (1 | (2 << 1)) : SamplerBits(tex));
                    writer.Write(ptr.ToInt64());
                    nt++;
                }
                var endPos = frame.Position;
                frame.Position = texPos;
                writer.Write(nt);
                frame.Position = endPos;

                if (WriteBlock(p.vs, b) == 0) writer.Write(0);
                if (WriteBlock(p.fs, b) == 0) writer.Write(0);
                count++;
            }
            if (count == 0) return 0;
            var len = (int)frame.Position;
            frame.Position = 0;
            writer.Write(count);
            frame.Position = len;
            return len;
        }
    }
}
