using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Scripting;
using Object = UnityEngine.Object;

namespace Pot
{
    /// <summary>
    /// 引擎桥：JS 只拿到整数 id，不直接接触 GameObject。
    /// 向量通过静态字段 vx/vy/vz 带回，避免结构体封送。
    /// 颜色约定：JS 传 sRGB；项目为 Linear 色彩空间，SetColor 会自动转线性，HDR 值（自发光）用 HdrToLinear 手动转换。
    /// </summary>
    [Preserve]
    public static class PotScene
    {
        public const int CameraIdValue = 1;

        static readonly Dictionary<int, GameObject> objects = new Dictionary<int, GameObject>();
        static int nextId = CameraIdValue + 1;
        static Transform root;
        static Camera camera;

        [Preserve] public static float vx, vy, vz;

        static Material defaultMaterial;

        /// <summary>所有图元共用的基础材质；着色器来自 core 包 Resources/pot/PotLit.shader，构建一定包含</summary>
        public static Material DefaultMaterial
        {
            get
            {
                if (defaultMaterial == null)
                {
                    defaultMaterial = new Material(LoadShader("pot/PotLit", "Universal Render Pipeline/Lit")) { name = "PotDefault" };
                }
                return defaultMaterial;
            }
        }

        static Transform Root
        {
            get
            {
                if (root == null)
                {
                    var go = new GameObject("PotWorld");
                    Object.DontDestroyOnLoad(go);
                    root = go.transform;
                }
                return root;
            }
        }

        public static Camera Camera
        {
            get
            {
                if (camera == null)
                {
                    camera = Camera.main;
                    if (camera == null)
                    {
                        var go = new GameObject("PotCamera");
                        go.tag = "MainCamera";
                        camera = go.AddComponent<Camera>();
                        go.AddComponent<AudioListener>();
                        Object.DontDestroyOnLoad(go);
                    }
                }
                return camera;
            }
        }

        static GameObject Get(int id)
        {
            if (id == CameraIdValue) return Camera.gameObject;
            GameObject go;
            if (objects.TryGetValue(id, out go) && go != null) return go;
            return null;
        }

        internal static GameObject GetObject(int id)
        {
            return Get(id);
        }

        /// <summary>
        /// 创建对象。shape：cube/sphere/capsule/cylinder/plane/quad/empty，或 mesh:名字（先用 Mesh 注册）
        /// </summary>
        [Preserve]
        public static int Spawn(string shape, string name, int parent)
        {
            GameObject go;
            string spawnMesh = null;
            switch (shape)
            {
                case "cube": go = GameObject.CreatePrimitive(PrimitiveType.Cube); break;
                case "sphere": go = GameObject.CreatePrimitive(PrimitiveType.Sphere); break;
                case "capsule": go = GameObject.CreatePrimitive(PrimitiveType.Capsule); break;
                case "cylinder": go = GameObject.CreatePrimitive(PrimitiveType.Cylinder); break;
                case "plane": go = GameObject.CreatePrimitive(PrimitiveType.Plane); break;
                case "quad": go = GameObject.CreatePrimitive(PrimitiveType.Quad); break;
                default:
                    go = new GameObject();
                    if (shape != null && shape.StartsWith("mesh:", StringComparison.Ordinal))
                    {
                        var meshName = shape.Substring(5);
                        Mesh mesh;
                        if (meshes.TryGetValue(meshName, out mesh) && mesh != null)
                        {
                            go.AddComponent<MeshFilter>().sharedMesh = mesh;
                            go.AddComponent<MeshRenderer>();
                            spawnMesh = meshName;
                        }
                        else Debug.LogWarning("[pot] 未注册的网格：" + meshName);
                    }
                    else if (shape != null && shape.StartsWith("skin:", StringComparison.Ordinal))
                    {
                        // 蒙皮网格：顶点由骨骼摆放，不建碰撞体（命中体另用 visible:false 的图元挂在骨骼上）
                        var meshName = shape.Substring(5);
                        Mesh mesh;
                        if (meshes.TryGetValue(meshName, out mesh) && mesh != null)
                        {
                            var smr = go.AddComponent<SkinnedMeshRenderer>();
                            smr.sharedMesh = mesh;
                            smr.updateWhenOffscreen = true;
                            smr.skinnedMotionVectors = false;
                        }
                        else Debug.LogWarning("[pot] 未注册的网格：" + meshName);
                    }
                    break;
            }
            var id = nextId++;
            go.name = string.IsNullOrEmpty(name) ? shape + "#" + id : name;
            var meshRenderer = go.GetComponent<Renderer>();
            if (meshRenderer != null) meshRenderer.sharedMaterial = DefaultMaterial;
            var parentGo = parent != 0 ? Get(parent) : null;
            go.transform.SetParent(parentGo != null ? parentGo.transform : Root, false);
            objects[id] = go;
            ids[go] = id;
            if (spawnMesh != null)
            {
                HashSet<int> users;
                if (!meshUsers.TryGetValue(spawnMesh, out users)) meshUsers[spawnMesh] = users = new HashSet<int>();
                users.Add(id);
                meshOfObject[id] = spawnMesh;
                colliderKinds[id] = "mesh";
                RebuildCollider(id, go, false);
            }
            return id;
        }

        [Preserve]
        public static void Destroy(int id)
        {
            GameObject go;
            ForgetCollider(id);
            if (!objects.TryGetValue(id, out go)) return;
            objects.Remove(id);
            if (go != null)
            {
                ids.Remove(go);
                Object.Destroy(go);
            }
        }

        [Preserve]
        public static bool Exists(int id)
        {
            return Get(id) != null;
        }

        static readonly int RestId = Shader.PropertyToID("_Rest");

        /// <summary>
        /// 给 Spawn("skin:名字") 建出的对象绑定骨骼。boneIds 为 Int32 对象 id，顺序对应网格的骨骼下标。
        /// 成功返回空串。蒙皮结果在该对象自身的局部空间里，通常让它留在父节点原点不动。
        /// </summary>
        [Preserve]
        public static string Skin(int id, Puerts.ArrayBuffer boneIds)
        {
            var go = Get(id);
            var smr = go != null ? go.GetComponent<SkinnedMeshRenderer>() : null;
            if (smr == null || smr.sharedMesh == null) return "对象不是蒙皮网格";
            var b = Ints(boneIds);
            var need = smr.sharedMesh.bindposes.Length;
            if (need == 0) return "网格没有骨骼数据（注册网格时需要 boneIndices）";
            if (b == null || b.Length < need) return "骨骼数量不足：网格需要 " + need + " 根，只给了 " + (b == null ? 0 : b.Length) + " 根";
            var ts = new Transform[b.Length];
            for (var i = 0; i < b.Length; i++)
            {
                var bone = Get(b[i]);
                if (bone == null) return "第 " + i + " 根骨骼不存在";
                ts[i] = bone.transform;
            }
            smr.bones = ts;
            // 物体空间三平面改用静止姿态采样，贴图才不会随肢体游动（见 PotLit 的 _Rest）
            SetProp(smr, RestId, 1f);
            return "";
        }

        static int[] xfIds = new int[64];
        static float[] xfData = new float[640];

        /// <summary>
        /// 批量设置变换。ids 为 Int32 对象 id；data 每个对象 10 个 Float32：位置 xyz、四元数 xyzw、缩放 xyz。
        /// flags：bit0 写位置、bit1 写旋转、bit2 写缩放（始终是 localScale）、bit3 位置与旋转按局部空间。
        /// 世界空间下父节点要排在子节点之前。返回实际写入的对象数。
        /// </summary>
        [Preserve]
        public static int SetTransforms(Puerts.ArrayBuffer ids, Puerts.ArrayBuffer data, int count, int flags)
        {
            if (ids == null || data == null || ids.Bytes == null || data.Bytes == null || count <= 0) return 0;
            count = Mathf.Min(count, Mathf.Min(ids.Count / 4, data.Count / 40));
            if (count <= 0) return 0;
            if (xfIds.Length < count) { xfIds = new int[Mathf.NextPowerOfTwo(count)]; xfData = new float[xfIds.Length * 10]; }
            Buffer.BlockCopy(ids.Bytes, 0, xfIds, 0, count * 4);
            Buffer.BlockCopy(data.Bytes, 0, xfData, 0, count * 40);
            bool pos = (flags & 1) != 0, rot = (flags & 2) != 0, scale = (flags & 4) != 0, local = (flags & 8) != 0;
            var done = 0;
            for (var i = 0; i < count; i++)
            {
                var go = Get(xfIds[i]);
                if (go == null) continue;
                var t = go.transform;
                var o = i * 10;
                if (pos && rot)
                {
                    var p = new Vector3(xfData[o], xfData[o + 1], xfData[o + 2]);
                    var q = new Quaternion(xfData[o + 3], xfData[o + 4], xfData[o + 5], xfData[o + 6]);
                    if (local) t.SetLocalPositionAndRotation(p, q);
                    else t.SetPositionAndRotation(p, q);
                }
                else if (pos)
                {
                    var p = new Vector3(xfData[o], xfData[o + 1], xfData[o + 2]);
                    if (local) t.localPosition = p; else t.position = p;
                }
                else if (rot)
                {
                    var q = new Quaternion(xfData[o + 3], xfData[o + 4], xfData[o + 5], xfData[o + 6]);
                    if (local) t.localRotation = q; else t.rotation = q;
                }
                if (scale) t.localScale = new Vector3(xfData[o + 7], xfData[o + 8], xfData[o + 9]);
                done++;
            }
            return done;
        }

        /// <summary>开关渲染（碰撞体、子节点、灯光不受影响）：只碰撞不渲染的命中体用它</summary>
        [Preserve]
        public static void SetVisible(int id, bool visible)
        {
            var go = Get(id);
            if (go == null) return;
            foreach (var r in go.GetComponents<Renderer>()) r.enabled = visible;
        }

        [Preserve]
        public static void SetVec(int id, string prop, float x, float y, float z)
        {
            var go = Get(id);
            if (go == null) return;
            var t = go.transform;
            var v = new Vector3(x, y, z);
            switch (prop)
            {
                case "position": t.position = v; break;
                case "rotation": t.eulerAngles = v; break;
                case "scale": t.localScale = v; break;
                case "localPosition": t.localPosition = v; break;
                case "localRotation": t.localEulerAngles = v; break;
            }
        }

        [Preserve]
        public static void GetVec(int id, string prop)
        {
            var go = Get(id);
            var v = Vector3.zero;
            if (go != null)
            {
                var t = go.transform;
                switch (prop)
                {
                    case "position": v = t.position; break;
                    case "rotation": v = t.eulerAngles; break;
                    case "scale": v = t.localScale; break;
                    case "localPosition": v = t.localPosition; break;
                    case "localRotation": v = t.localEulerAngles; break;
                }
            }
            vx = v.x; vy = v.y; vz = v.z;
        }

        [Preserve]
        public static void SetColor(int id, float r, float g, float b, float a)
        {
            var go = Get(id);
            if (go == null) return;
            var renderer = go.GetComponent<Renderer>();
            if (renderer != null) SetProp(renderer, ColorId, new Color(r, g, b, a));
            var light = go.GetComponent<Light>();
            if (light != null) light.color = new Color(r, g, b, a);
        }

        // ---------------- 材质（通用：模式 + PBR 参数 + 贴图 + 任意着色器参数，均为逐对象属性，不复制材质） ----------------

        static readonly int ColorId = Shader.PropertyToID("_Color");
        static readonly int EmissionId = Shader.PropertyToID("_EmissionColor");
        static readonly int MetallicId = Shader.PropertyToID("_Metallic");
        static readonly int SmoothnessId = Shader.PropertyToID("_Glossiness");
        static MaterialPropertyBlock block;
        static readonly Dictionary<string, Material> modeMaterials = new Dictionary<string, Material>();

        static MaterialPropertyBlock Block(Renderer renderer)
        {
            if (block == null) block = new MaterialPropertyBlock();
            renderer.GetPropertyBlock(block);
            return block;
        }

        static void SetProp(Renderer renderer, int prop, Color value)
        {
            var b = Block(renderer);
            b.SetColor(prop, value);
            renderer.SetPropertyBlock(b);
        }

        static void SetProp(Renderer renderer, int prop, float value)
        {
            var b = Block(renderer);
            b.SetFloat(prop, value);
            renderer.SetPropertyBlock(b);
        }

        /// <summary>sRGB → 线性（标准分段公式，不截断）：顶点色大于 1 时作亮度倍数，Color.linear 会把它截到 1</summary>
        public static float SrgbToLinear(float v) => v <= 0.04045f ? v / 12.92f : Mathf.Pow((v + 0.055f) / 1.055f, 2.4f);

        /// <summary>sRGB 的 HDR 颜色（分量可大于 1）转线性：按最大分量归一化后转换再乘回，避免对 &gt;1 的值做幂运算</summary>
        public static Vector4 HdrToLinear(float r, float g, float b, float a = 1)
        {
            var m = Mathf.Max(r, Mathf.Max(g, b));
            if (m <= 1f || QualitySettings.activeColorSpace != ColorSpace.Linear)
            {
                var c = QualitySettings.activeColorSpace == ColorSpace.Linear ? new Color(r, g, b, a).linear : new Color(r, g, b, a);
                return new Vector4(c.r, c.g, c.b, a);
            }
            var n = new Color(r / m, g / m, b / m, a).linear;
            return new Vector4(n.r * m, n.g * m, n.b * m, a);
        }

        internal static Shader LoadShader(string name, string fallback)
        {
            var shader = Resources.Load<Shader>(name);
            if (shader == null || !shader.isSupported)
            {
                Debug.LogWarning("[pot] 着色器 " + name + " 不可用，回退到 " + fallback);
                shader = Shader.Find(fallback);
            }
            return shader;
        }

        static void Blend(Material mat, UnityEngine.Rendering.BlendMode src, UnityEngine.Rendering.BlendMode dst, bool zwrite, int queue)
        {
            mat.SetFloat("_SrcBlend", (float)src);
            mat.SetFloat("_DstBlend", (float)dst);
            mat.SetFloat("_ZWrite", zwrite ? 1f : 0f);
            mat.renderQueue = queue;
        }

        /// <summary>
        /// 材质模式（共享材质，按模式各一份）：
        /// lit 不透明受光（默认）、lit-cutout 镂空受光、lit-twosided 双面受光、lit-fade 半透明受光、
        /// unlit 不透明不受光、unlit-fade 半透明不受光、additive 叠加发光（按雾透射率淡出）
        /// </summary>
        public static Material ModeMaterial(string mode) => ModeMaterial(mode, -1);

        /// <summary>模式默认的剔除：lit-twosided 不剔除，其余剔除背面</summary>
        static int DefaultCull(string mode) => mode == "lit-twosided" ? 0 : 2;

        /// <summary>
        /// 模式 + 剔除的共享材质变体（cull：-1 模式默认、0 不剔除、1 剔除正面、2 剔除背面）。
        /// Cull 是渲染状态，不能走 MaterialPropertyBlock，所以按 (mode, cull) 各缓存一份材质
        /// </summary>
        public static Material ModeMaterial(string mode, int cull)
        {
            if (string.IsNullOrEmpty(mode)) mode = "lit";
            if (cull < 0 || cull > 2) cull = DefaultCull(mode);
            if (cull != DefaultCull(mode))
            {
                var key = mode + "|" + cull;
                Material v;
                if (modeMaterials.TryGetValue(key, out v) && v != null) return v;
                var b = ModeMaterial(mode, -1);
                if (b == DefaultMaterial && mode != "lit") return b;
                v = new Material(b);
                v.SetFloat("_Cull", cull);
                v.name = b.name + "_cull" + cull;
                modeMaterials[key] = v;
                materialModes[v] = new KeyValuePair<string, int>(mode, cull);
                return v;
            }
            if (mode == "lit") return DefaultMaterial;
            Material mat;
            if (modeMaterials.TryGetValue(mode, out mat) && mat != null) return mat;
            var One = UnityEngine.Rendering.BlendMode.One;
            var Zero = UnityEngine.Rendering.BlendMode.Zero;
            var SrcAlpha = UnityEngine.Rendering.BlendMode.SrcAlpha;
            var InvSrcAlpha = UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha;
            switch (mode)
            {
                case "lit-fade":
                    mat = new Material(DefaultMaterial.shader);
                    Blend(mat, SrcAlpha, InvSrcAlpha, false, 3000);
                    break;
                case "lit-cutout":
                    mat = new Material(DefaultMaterial.shader);
                    mat.SetFloat("_Cutoff", 0.5f);
                    Blend(mat, One, Zero, true, 2450);
                    break;
                case "lit-twosided":
                    mat = new Material(DefaultMaterial.shader);
                    mat.SetFloat("_Cull", 0f);
                    Blend(mat, One, Zero, true, 2000);
                    break;
                case "unlit":
                case "unlit-fade":
                case "additive":
                    mat = new Material(LoadShader("pot/PotUnlit", "Universal Render Pipeline/Unlit"));
                    if (mode == "unlit") Blend(mat, One, Zero, true, 2000);
                    else if (mode == "additive") Blend(mat, SrcAlpha, One, false, 3000);
                    else Blend(mat, SrcAlpha, InvSrcAlpha, false, 3000);
                    mat.SetFloat("_FogMode", mode == "additive" ? 2f : 1f);
                    break;
                default:
                    return DefaultMaterial;
            }
            mat.name = "Pot_" + mode;
            modeMaterials[mode] = mat;
            materialModes[mat] = new KeyValuePair<string, int>(mode, -1);
            return mat;
        }

        /// <summary>材质变体反查 (mode, 显式 cull)：只改其中一项时沿用另一项</summary>
        static readonly Dictionary<Material, KeyValuePair<string, int>> materialModes = new Dictionary<Material, KeyValuePair<string, int>>();

        /// <summary>切换材质模式与剔除；mode 空串表示不变，cull：-1 不变（换模式时沿用已显式设置的值），0 不剔除、1 正面、2 背面，3 恢复模式默认；castShadows：-1 不变，0 关，1 开</summary>
        [Preserve]
        public static void SetMaterial(int id, string mode, int castShadows, int cull)
        {
            var go = Get(id);
            if (go == null) return;
            var renderer = go.GetComponent<Renderer>();
            if (renderer == null) return;
            if (!string.IsNullOrEmpty(mode) || cull >= 0)
            {
                var cur = renderer.sharedMaterial;
                KeyValuePair<string, int> info;
                string curMode = "lit";
                int curCull = -1;
                if (cur != null && materialModes.TryGetValue(cur, out info)) { curMode = info.Key; curCull = info.Value; }
                else if (cur != null && cur != DefaultMaterial && string.IsNullOrEmpty(mode))
                {
                    Debug.LogWarning("[pot] material.cull 只对内置材质模式生效（" + go.name + " 用的是自定义材质）");
                    curMode = null;
                }
                if (curMode != null || !string.IsNullOrEmpty(mode))
                {
                    var m = string.IsNullOrEmpty(mode) ? curMode : mode;
                    var c = cull == 3 ? -1 : cull >= 0 ? cull : curCull;
                    renderer.sharedMaterial = ModeMaterial(m, c);
                }
            }
            if (castShadows >= 0) renderer.shadowCastingMode = castShadows > 0 ? UnityEngine.Rendering.ShadowCastingMode.On : UnityEngine.Rendering.ShadowCastingMode.Off;
        }

        /// <summary>PBR 参数：metallic、smoothness（0 到 1），传负数表示不变</summary>
        [Preserve]
        public static void SetSurface(int id, float metallic, float smoothness)
        {
            var go = Get(id);
            if (go == null) return;
            var renderer = go.GetComponent<Renderer>();
            if (renderer == null) return;
            if (metallic >= 0) SetProp(renderer, MetallicId, metallic);
            if (smoothness >= 0) SetProp(renderer, SmoothnessId, smoothness);
        }

        /// <summary>自发光（sRGB，HDR 可大于 1）</summary>
        [Preserve]
        public static void SetEmission(int id, float r, float g, float b)
        {
            var go = Get(id);
            if (go == null) return;
            var renderer = go.GetComponent<Renderer>();
            if (renderer == null) return;
            var bl = Block(renderer);
            bl.SetVector(EmissionId, HdrToLinear(r, g, b));
            renderer.SetPropertyBlock(bl);
        }

        /// <summary>
        /// 绑定贴图。slot：map（基础色）、normal（法线）、mask（R 金属 G AO B 高度 A 光滑）或任意着色器属性名（以 _ 开头）。
        /// tex 为 Texture 返回的 id，0 表示解除。
        /// </summary>
        [Preserve]
        public static void MatTexture(int id, string slot, int tex)
        {
            var go = Get(id);
            if (go == null) return;
            var renderer = go.GetComponent<Renderer>();
            if (renderer == null) return;
            Texture t = null;
            if (tex != 0) textures.TryGetValue(tex, out t);
            var bl = Block(renderer);
            switch (slot)
            {
                case "map":
                    bl.SetTexture("_MainTex", t != null ? t : Texture2D.whiteTexture);
                    break;
                case "normal":
                    if (t != null) bl.SetTexture("_BumpMap", t);
                    bl.SetFloat("_HasBump", t != null ? 1f : 0f);
                    break;
                case "mask":
                    if (t != null) bl.SetTexture("_MaskMap", t);
                    bl.SetFloat("_HasMask", t != null ? 1f : 0f);
                    break;
                default:
                    if (t != null) bl.SetTexture(slot, t);
                    break;
            }
            renderer.SetPropertyBlock(bl);
        }

        /// <summary>设置任意着色器浮点属性（例如 _UVMode、_BumpScale、_Occlusion、_Wet、_Planar、_Cutoff、_VColor）</summary>
        [Preserve]
        public static void MatFloat(int id, string prop, float value)
        {
            var go = Get(id);
            if (go == null) return;
            var renderer = go.GetComponent<Renderer>();
            if (renderer != null) SetProp(renderer, Shader.PropertyToID(prop), value);
        }

        /// <summary>设置任意着色器向量属性（例如 _Tiling：xy 缩放、zw 偏移）</summary>
        [Preserve]
        public static void MatVector(int id, string prop, float x, float y, float z, float w)
        {
            var go = Get(id);
            if (go == null) return;
            var renderer = go.GetComponent<Renderer>();
            if (renderer == null) return;
            var bl = Block(renderer);
            bl.SetVector(prop, new Vector4(x, y, z, w));
            renderer.SetPropertyBlock(bl);
        }

        // ---------------- 贴图与网格（由 JS 生成数据） ----------------

        static readonly Dictionary<int, Texture> textures = new Dictionary<int, Texture>();
        static int nextTexture = 1;
        static readonly Dictionary<string, Mesh> meshes = new Dictionary<string, Mesh>();

        internal static int RegisterTexture(Texture t)
        {
            var id = nextTexture++;
            textures[id] = t;
            return id;
        }

        internal static Texture GetTexture(int id)
        {
            Texture t;
            return textures.TryGetValue(id, out t) ? t : null;
        }

        /// <summary>
        /// 从 RGBA8 像素创建贴图（行从下到上）。linear：数据是否为线性（法线、遮罩为 true，颜色为 false）。
        /// wrap：0 重复 1 截断；filter：0 点 1 双线性 2 三线性；aniso：各向异性等级。返回贴图 id。
        /// </summary>
        [Preserve]
        public static int Texture(Puerts.ArrayBuffer data, int width, int height, bool linear, bool mipmaps, int wrap, int filter, int aniso)
        {
            if (data == null || data.Bytes == null || width <= 0 || height <= 0) return 0;
            var need = width * height * 4;
            if (data.Count < need)
            {
                Debug.LogError("[pot] Texture 数据长度不足：" + data.Count + " < " + need);
                return 0;
            }
            var t = new Texture2D(width, height, TextureFormat.RGBA32, mipmaps, linear);
            if (data.Bytes.Length == need) t.SetPixelData(data.Bytes, 0);
            else
            {
                var copy = new byte[need];
                Buffer.BlockCopy(data.Bytes, 0, copy, 0, need);
                t.SetPixelData(copy, 0);
            }
            t.wrapMode = wrap == 1 ? TextureWrapMode.Clamp : TextureWrapMode.Repeat;
            t.filterMode = filter == 0 ? FilterMode.Point : filter == 1 ? FilterMode.Bilinear : FilterMode.Trilinear;
            t.anisoLevel = Mathf.Clamp(aniso, 0, 16);
            t.Apply(mipmaps, true);
            return RegisterTexture(t);
        }

        [Preserve]
        public static void DestroyTexture(int id)
        {
            Texture t;
            if (!textures.TryGetValue(id, out t)) return;
            textures.Remove(id);
            if (t != null) Object.Destroy(t);
        }

        static float[] Floats(Puerts.ArrayBuffer b)
        {
            if (b == null || b.Bytes == null || b.Count < 4) return null;
            var f = new float[b.Count / 4];
            Buffer.BlockCopy(b.Bytes, 0, f, 0, f.Length * 4);
            return f;
        }

        static int[] Ints(Puerts.ArrayBuffer b)
        {
            if (b == null || b.Bytes == null || b.Count < 4) return null;
            var f = new int[b.Count / 4];
            Buffer.BlockCopy(b.Bytes, 0, f, 0, f.Length * 4);
            return f;
        }

        static readonly Dictionary<string, string> meshKeys = new Dictionary<string, string>();

        /// <summary>
        /// 同名网格是否已按这个 key 注册过。命中返回顶点数，否则返回 -1。
        /// 网格只在冷重启时清空，热重载时内容没变的大网格可以据此跳过生成与上传。
        /// </summary>
        [Preserve]
        public static int MeshCached(string name, string key)
        {
            if (string.IsNullOrEmpty(key)) return -1;
            Mesh mesh;
            string old;
            if (!meshes.TryGetValue(name, out mesh) || mesh == null) return -1;
            if (!meshKeys.TryGetValue(name, out old) || !string.Equals(old, key, StringComparison.Ordinal)) return -1;
            return mesh.vertexCount;
        }

        /// <summary>
        /// 注册网格（之后可用 Spawn("mesh:name")）。positions/normals 为 Float32 xyz，uvs 为 Float32 uv，
        /// colors 为 Float32 rgba（sRGB），indices 为 Uint32 三角形。normals/uvs/colors 可为 null。同名覆盖。
        /// key 非空时登记为该网格的内容标识，供 MeshCached 查询。
        /// </summary>
        [Preserve]
        public static int Mesh(string name, Puerts.ArrayBuffer positions, Puerts.ArrayBuffer normals, Puerts.ArrayBuffer uvs, Puerts.ArrayBuffer colors, Puerts.ArrayBuffer indices, string key)
        {
            meshKeys.Remove(name);
            var p = Floats(positions);
            if (p == null || indices == null || indices.Bytes == null) return 0;
            var vcount = p.Length / 3;
            var verts = new Vector3[vcount];
            for (var i = 0; i < vcount; i++) verts[i] = new Vector3(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
            var idx = new int[indices.Count / 4];
            Buffer.BlockCopy(indices.Bytes, 0, idx, 0, idx.Length * 4);

            Mesh mesh;
            if (!meshes.TryGetValue(name, out mesh) || mesh == null) mesh = new Mesh { name = name };
            else mesh.Clear();
            meshAttrs.Remove(mesh);
            mesh.indexFormat = vcount > 65000 ? UnityEngine.Rendering.IndexFormat.UInt32 : UnityEngine.Rendering.IndexFormat.UInt16;
            mesh.vertices = verts;
            var uv = Floats(uvs);
            if (uv != null && uv.Length >= vcount * 2)
            {
                var u = new Vector2[vcount];
                for (var i = 0; i < vcount; i++) u[i] = new Vector2(uv[i * 2], uv[i * 2 + 1]);
                mesh.uv = u;
            }
            var c = Floats(colors);
            if (c != null && c.Length >= vcount * 4)
            {
                var linear = QualitySettings.activeColorSpace == ColorSpace.Linear;
                var cs = new Color[vcount];
                for (var i = 0; i < vcount; i++)
                {
                    float r = c[i * 4], g = c[i * 4 + 1], b = c[i * 4 + 2];
                    cs[i] = linear ? new Color(SrgbToLinear(r), SrgbToLinear(g), SrgbToLinear(b), c[i * 4 + 3]) : new Color(r, g, b, c[i * 4 + 3]);
                }
                mesh.colors = cs;
            }
            mesh.triangles = idx;
            var n = Floats(normals);
            if (n != null && n.Length >= vcount * 3)
            {
                var ns = new Vector3[vcount];
                for (var i = 0; i < vcount; i++) ns[i] = new Vector3(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]);
                mesh.normals = ns;
            }
            else mesh.RecalculateNormals();
            if (uv != null) mesh.RecalculateTangents();
            mesh.RecalculateBounds();
            meshes[name] = mesh;
            if (!string.IsNullOrEmpty(key)) meshKeys[name] = key;
            RefreshMeshUsers(name);
            return vcount;
        }

        /// <summary>
        /// 用给定切线替换网格的切线（紧跟在 Mesh 之后调用）。tangents 为 Float32 xyzw，每顶点 4 个；
        /// w 为副切线方向（±1，非零值按符号取）。自定义着色器的 pot_Tangent 读到的就是它。成功返回空串。
        /// </summary>
        [Preserve]
        public static string MeshTangents(string name, Puerts.ArrayBuffer tangents)
        {
            Mesh mesh;
            if (!meshes.TryGetValue(name, out mesh) || mesh == null) return "未注册的网格：" + name;
            var t = Floats(tangents);
            var vcount = mesh.vertexCount;
            if (t == null || t.Length != vcount * 4)
            {
                meshKeys.Remove(name);
                return "tangents 须为每顶点 4 个数（xyzw），共 " + (vcount * 4) + " 个";
            }
            var ts = new Vector4[vcount];
            for (var i = 0; i < vcount; i++)
            {
                var w = t[i * 4 + 3];
                ts[i] = new Vector4(t[i * 4], t[i * 4 + 1], t[i * 4 + 2], w < 0f ? -1f : 1f);
            }
            mesh.tangents = ts;
            return "";
        }

        static float LinearToSrgb(float v) => v <= 0.0031308f ? v * 12.92f : 1.055f * Mathf.Pow(v, 1f / 2.4f) - 0.055f;

        /// <summary>
        /// 替换网格顶点色（紧跟在 Mesh 之后调用）。colors 为 Float32 rgba，每顶点 4 个，以 Float32 存储不截断（HDR 值保留）。
        /// linear 为 true 表示输入已是线性值：线性色彩空间项目原样写入，Gamma 项目转回 sRGB；为 false 时与 Mesh 相同按 sRGB 处理。成功返回空串。
        /// </summary>
        [Preserve]
        public static string MeshColors(string name, Puerts.ArrayBuffer colors, bool linear)
        {
            Mesh mesh;
            if (!meshes.TryGetValue(name, out mesh) || mesh == null) return "未注册的网格：" + name;
            var c = Floats(colors);
            var vcount = mesh.vertexCount;
            if (c == null || c.Length != vcount * 4)
            {
                meshKeys.Remove(name);
                return "colors 须为每顶点 4 个数（rgba），共 " + (vcount * 4) + " 个";
            }
            var projectLinear = QualitySettings.activeColorSpace == ColorSpace.Linear;
            var cs = new Color[vcount];
            for (var i = 0; i < vcount; i++)
            {
                float r = c[i * 4], g = c[i * 4 + 1], b = c[i * 4 + 2], a = c[i * 4 + 3];
                if (linear && !projectLinear) { r = LinearToSrgb(r); g = LinearToSrgb(g); b = LinearToSrgb(b); }
                else if (!linear && projectLinear) { r = SrgbToLinear(r); g = SrgbToLinear(g); b = SrgbToLinear(b); }
                cs[i] = new Color(r, g, b, a);
            }
            mesh.colors = cs;
            return "";
        }

        // 网格 → 自定义顶点属性名 → UV 通道（1-7）
        static readonly Dictionary<Mesh, Dictionary<string, int>> meshAttrs = new Dictionary<Mesh, Dictionary<string, int>>();

        /// <summary>自定义属性在网格里的 UV 通道；没有返回 -1（PotGfx 按名字找着色器输入对应的通道）</summary>
        internal static int MeshAttributeChannel(Mesh mesh, string attr)
        {
            Dictionary<string, int> m;
            int ch;
            return mesh != null && meshAttrs.TryGetValue(mesh, out m) && m.TryGetValue(attr, out ch) ? ch : -1;
        }

        /// <summary>
        /// 给已注册的网格写一个自定义顶点属性（紧跟在 Mesh 之后调用）：存进 UV 通道 channel（1-7），
        /// 运行时着色器里同名的 attributes 输入读到它。data 为 Float32，每顶点 size（1-4）个，原样存储不做色彩空间转换。成功返回空串。
        /// </summary>
        [Preserve]
        public static string MeshAttribute(string name, int channel, string attr, int size, Puerts.ArrayBuffer data)
        {
            Mesh mesh;
            if (!meshes.TryGetValue(name, out mesh) || mesh == null) return "未注册的网格：" + name;
            string err = null;
            var d = Floats(data);
            var vcount = mesh.vertexCount;
            if (channel < 1 || channel > 7) err = "自定义顶点属性最多 7 个";
            else if (size < 1 || size > 4) err = "属性 " + attr + " 的 size 须为 1 到 4";
            else if (d == null || d.Length != vcount * size) err = "属性 " + attr + " 须为每顶点 " + size + " 个数，共 " + (vcount * size) + " 个";
            else if (mesh.boneWeights != null && mesh.boneWeights.Length > 0) err = "蒙皮网格不能带自定义顶点属性（UV1-3 已用于静止姿态）";
            if (err != null)
            {
                meshKeys.Remove(name);
                return err;
            }
            if (size == 4)
            {
                var v = new Vector4[vcount];
                for (var i = 0; i < vcount; i++) v[i] = new Vector4(d[i * 4], d[i * 4 + 1], d[i * 4 + 2], d[i * 4 + 3]);
                mesh.SetUVs(channel, v);
            }
            else if (size == 3)
            {
                var v = new Vector3[vcount];
                for (var i = 0; i < vcount; i++) v[i] = new Vector3(d[i * 3], d[i * 3 + 1], d[i * 3 + 2]);
                mesh.SetUVs(channel, v);
            }
            else
            {
                // 单分量也存成 2 分量（Unity 的 SetUVs 最少 2 维），着色器只读 x
                var v = new Vector2[vcount];
                for (var i = 0; i < vcount; i++) v[i] = size == 2 ? new Vector2(d[i * 2], d[i * 2 + 1]) : new Vector2(d[i], 0);
                mesh.SetUVs(channel, v);
            }
            Dictionary<string, int> map;
            if (!meshAttrs.TryGetValue(mesh, out map)) meshAttrs[mesh] = map = new Dictionary<string, int>();
            map[attr] = channel;
            return "";
        }

        /// <summary>
        /// 给已注册的网格补蒙皮数据（紧跟在 Mesh 之后调用）。boneIndices 为 Int32，每顶点 1 到 4 个（个数 = 长度 / 顶点数）；
        /// weights 为 Float32，形状同 boneIndices，null 表示第一根骨骼权重 1（刚性蒙皮）；
        /// bindPoses 为 Float32，每根骨骼 16 个（列主序），null 表示全是单位矩阵（顶点已在骨骼局部空间）。
        /// 同时把静止姿态的位置、法线、切线存进 UV1 到 UV3，供物体空间三平面采样。成功返回空串。
        /// </summary>
        [Preserve]
        public static string MeshSkin(string name, Puerts.ArrayBuffer boneIndices, Puerts.ArrayBuffer weights, Puerts.ArrayBuffer bindPoses)
        {
            Mesh mesh;
            if (!meshes.TryGetValue(name, out mesh) || mesh == null) return "未注册的网格：" + name;
            if (meshAttrs.ContainsKey(mesh)) { meshKeys.Remove(name); return "带自定义顶点属性的网格不能蒙皮（UV1-3 要存静止姿态）"; }
            var err = SkinData(mesh, Ints(boneIndices), Floats(weights), Floats(bindPoses));
            if (err.Length > 0) meshKeys.Remove(name);
            return err;
        }

        static string SkinData(Mesh mesh, int[] bi, float[] w, float[] bp)
        {
            var vcount = mesh.vertexCount;
            if (bi == null || vcount == 0 || bi.Length % vcount != 0) return "boneIndices 的长度须为顶点数的整数倍";
            var per = bi.Length / vcount;
            if (per < 1 || per > 4) return "每个顶点只能有 1 到 4 根骨骼";
            if (w != null && w.Length != bi.Length) return "boneWeights 的长度须与 boneIndices 相同";
            var maxBone = 0;
            var bw = new BoneWeight[vcount];
            var ii = new int[4];
            var ww = new float[4];
            for (var v = 0; v < vcount; v++)
            {
                var sum = 0f;
                for (var k = 0; k < 4; k++)
                {
                    ii[k] = k < per ? bi[v * per + k] : 0;
                    ww[k] = k >= per ? 0f : w != null ? Mathf.Max(0f, w[v * per + k]) : k == 0 ? 1f : 0f;
                    if (ii[k] < 0) return "骨骼下标不能为负";
                    sum += ww[k];
                }
                if (sum <= 0f) { ww[0] = 1f; sum = 1f; }
                // Unity 要求权重从大到小
                for (var a = 1; a < 4; a++)
                    for (var c = a; c > 0 && ww[c] > ww[c - 1]; c--)
                    {
                        var tw = ww[c]; ww[c] = ww[c - 1]; ww[c - 1] = tw;
                        var ti = ii[c]; ii[c] = ii[c - 1]; ii[c - 1] = ti;
                    }
                for (var k = 0; k < 4; k++)
                {
                    if (ww[k] <= 0f) ii[k] = 0;
                    else if (ii[k] > maxBone) maxBone = ii[k];
                }
                bw[v] = new BoneWeight
                {
                    boneIndex0 = ii[0], weight0 = ww[0] / sum,
                    boneIndex1 = ii[1], weight1 = ww[1] / sum,
                    boneIndex2 = ii[2], weight2 = ww[2] / sum,
                    boneIndex3 = ii[3], weight3 = ww[3] / sum,
                };
            }
            Matrix4x4[] poses;
            if (bp != null)
            {
                if (bp.Length % 16 != 0) return "bindPoses 每根骨骼 16 个数";
                if (bp.Length / 16 <= maxBone) return "bindPoses 只有 " + bp.Length / 16 + " 根，顶点用到了第 " + maxBone + " 根";
                poses = new Matrix4x4[bp.Length / 16];
                for (var i = 0; i < poses.Length; i++)
                    for (var k = 0; k < 16; k++) poses[i][k] = bp[i * 16 + k];
            }
            else
            {
                poses = new Matrix4x4[maxBone + 1];
                for (var i = 0; i < poses.Length; i++) poses[i] = Matrix4x4.identity;
            }

            // 静止姿态：Unity 只对位置、法线、切线做蒙皮，UV 通道原样透传。
            // 切线与法线正交化（没有 UV 或 UV 退化时任取一个垂直方向），着色器靠这对标架把静止空间的法线扰动转到蒙皮后的空间
            var verts = mesh.vertices;
            var normals = mesh.normals;
            var tangents = mesh.tangents;
            if (tangents == null || tangents.Length != vcount) tangents = new Vector4[vcount];
            var rest = new Vector3[vcount];
            for (var i = 0; i < vcount; i++)
            {
                var n = normals[i];
                var t = (Vector3)tangents[i];
                t -= n * Vector3.Dot(n, t);
                if (t.sqrMagnitude < 1e-8f) t = Vector3.Cross(n, Mathf.Abs(n.y) < 0.99f ? Vector3.up : Vector3.right);
                t.Normalize();
                rest[i] = t;
                tangents[i] = new Vector4(t.x, t.y, t.z, tangents[i].w < 0f ? -1f : 1f);
            }
            mesh.tangents = tangents;
            mesh.SetUVs(1, verts);
            mesh.SetUVs(2, normals);
            mesh.SetUVs(3, rest);
            mesh.boneWeights = bw;
            mesh.bindposes = poses;
            return "";
        }

        // ---------------- 碰撞与射线 ----------------

        static readonly Dictionary<GameObject, int> ids = new Dictionary<GameObject, int>();

        /// <summary>Raycast 的附加返回值：法线、距离</summary>
        [Preserve] public static float nx, ny, nz, dist;

        /// <summary>开关对象上的碰撞体（图元自带碰撞体；empty 没有）</summary>
        [Preserve]
        public static void SetCollider(int id, bool enabled)
        {
            var go = Get(id);
            if (go == null) return;
            if (enabled) collidersOff.Remove(id); else collidersOff.Add(id);
            if (colliderKinds.ContainsKey(id)) { RebuildCollider(id, go, false); return; }
            foreach (var c in go.GetComponents<Collider>()) c.enabled = enabled;
        }

        // mesh: 形状实体：网格名 → 使用它的实体（网格更新时重建碰撞体）；实体 → 网格名
        static readonly Dictionary<string, HashSet<int>> meshUsers = new Dictionary<string, HashSet<int>>();
        static readonly Dictionary<int, string> meshOfObject = new Dictionary<int, string>();
        // 由 pot 管理碰撞体的实体：mesh / convex / box（图元没换过形状时不在这里，沿用自带碰撞体）
        static readonly Dictionary<int, string> colliderKinds = new Dictionary<int, string>();
        // 关掉碰撞体的实体：网格碰撞体直接移除，网格更新时也不烘焙
        static readonly HashSet<int> collidersOff = new HashSet<int>();

        // 退化网格（如初始全零的动态池）不建网格碰撞体：PhysX 会报错，且之后每次更新都会重新烘焙
        static bool Degenerate(Mesh m) => m == null || m.vertexCount < 3 || m.bounds.size.sqrMagnitude <= 1e-12f;

        static void ForgetCollider(int id)
        {
            string meshName;
            HashSet<int> users;
            if (meshOfObject.TryGetValue(id, out meshName) && meshUsers.TryGetValue(meshName, out users))
            {
                users.Remove(id);
                if (users.Count == 0) meshUsers.Remove(meshName);
            }
            meshOfObject.Remove(id);
            colliderKinds.Remove(id);
            collidersOff.Remove(id);
        }

        /// <summary>按登记的形状重建碰撞体；remesh 为 true 表示网格内容变了，网格碰撞体要重新烘焙</summary>
        static void RebuildCollider(int id, GameObject go, bool remesh)
        {
            string kind;
            if (!colliderKinds.TryGetValue(id, out kind)) return;
            var mf = go.GetComponent<MeshFilter>();
            var mesh = mf != null ? mf.sharedMesh : null;
            var off = collidersOff.Contains(id);
            if (kind == "box")
            {
                foreach (var c in go.GetComponents<Collider>()) if (!(c is BoxCollider)) Object.DestroyImmediate(c);
                var bc = go.GetComponent<BoxCollider>();
                if (bc == null) bc = go.AddComponent<BoxCollider>();
                if (mesh != null) { var b = mesh.bounds; bc.center = b.center; bc.size = b.size; }
                bc.enabled = !off;
                return;
            }
            foreach (var c in go.GetComponents<Collider>()) if (!(c is MeshCollider)) Object.DestroyImmediate(c);
            var mc = go.GetComponent<MeshCollider>();
            if (off || Degenerate(mesh))
            {
                if (mc != null) Object.DestroyImmediate(mc);
                return;
            }
            var convex = kind == "convex";
            if (mc == null) { mc = go.AddComponent<MeshCollider>(); mc.convex = convex; mc.sharedMesh = mesh; }
            else if (remesh || mc.sharedMesh != mesh || mc.convex != convex)
            {
                // MeshCollider 不会跟着网格内容变化，要重新赋值才会重新烘焙
                mc.sharedMesh = null;
                mc.convex = convex;
                mc.sharedMesh = mesh;
            }
            mc.enabled = true;
        }

        static void RefreshMeshUsers(string meshName)
        {
            HashSet<int> users;
            if (!meshUsers.TryGetValue(meshName, out users)) return;
            Mesh mesh;
            meshes.TryGetValue(meshName, out mesh);
            List<int> dead = null;
            foreach (var id in users)
            {
                var go = Get(id);
                if (go == null) { (dead ??= new List<int>()).Add(id); continue; }
                var mf = go.GetComponent<MeshFilter>();
                if (mf != null && mesh != null && mf.sharedMesh != mesh) mf.sharedMesh = mesh;
                RebuildCollider(id, go, true);
            }
            if (dead != null) foreach (var id in dead) ForgetCollider(id);
        }

        /// <summary>
        /// 换碰撞体形状：kind 为 mesh / convex / box（空串不换），之后跟随网格更新。
        /// dynamic 为 true 时挂运动学刚体（会动的碰撞体，移动不触发静态碰撞体重建）。成功返回空串。
        /// </summary>
        [Preserve]
        public static string SetColliderShape(int id, string kind, bool dynamic)
        {
            var go = Get(id);
            if (go == null || id == CameraIdValue) return "实体不存在";
            if (go.GetComponent<SkinnedMeshRenderer>() != null) return "蒙皮实体没有碰撞体，命中体另挂在骨骼下";
            if (!string.IsNullOrEmpty(kind))
            {
                if (kind != "mesh" && kind != "convex" && kind != "box") return "形状只能是 mesh、convex 或 box";
                var mf = go.GetComponent<MeshFilter>();
                if (mf == null || mf.sharedMesh == null) return "没有网格，不能用 " + kind + " 碰撞体";
                colliderKinds[id] = kind;
                RebuildCollider(id, go, false);
            }
            if (dynamic)
            {
                var rb = go.GetComponent<Rigidbody>();
                if (rb == null) rb = go.AddComponent<Rigidbody>();
                rb.isKinematic = true;
                rb.useGravity = false;
                rb.interpolation = RigidbodyInterpolation.None;
            }
            return "";
        }

        /// <summary>设置层（0 到 31），用于射线掩码</summary>
        [Preserve]
        public static void SetLayer(int id, int layer)
        {
            var go = Get(id);
            if (go != null) go.layer = Mathf.Clamp(layer, 0, 31);
        }

        /// <summary>
        /// 射线检测。mask 为层掩码（0 表示默认层集合）。命中返回对象 id（向上找到第一个 pot 对象），
        /// 命中点写入 vx/vy/vz，法线写入 nx/ny/nz，距离写入 dist；未命中返回 0。
        /// </summary>
        [Preserve]
        public static int Raycast(float ox, float oy, float oz, float dx, float dy, float dz, float maxDistance, int mask)
        {
            Physics.SyncTransforms();
            var dir = new Vector3(dx, dy, dz);
            if (dir.sqrMagnitude < 1e-12f) return 0;
            RaycastHit hit;
            var layers = mask == 0 ? Physics.DefaultRaycastLayers : mask;
            if (!Physics.Raycast(new Ray(new Vector3(ox, oy, oz), dir.normalized), out hit, maxDistance > 0 ? maxDistance : Mathf.Infinity, layers, QueryTriggerInteraction.Ignore)) return 0;
            return HitResult(hit);
        }

        /// <summary>球体扫掠（半径 radius），返回与写入同 Raycast；起点已与碰撞体重叠时不算命中</summary>
        [Preserve]
        public static int SphereCast(float ox, float oy, float oz, float dx, float dy, float dz, float radius, float maxDistance, int mask)
        {
            Physics.SyncTransforms();
            var dir = new Vector3(dx, dy, dz);
            if (dir.sqrMagnitude < 1e-12f || !(radius > 0f)) return 0;
            RaycastHit hit;
            var layers = mask == 0 ? Physics.DefaultRaycastLayers : mask;
            if (!Physics.SphereCast(new Vector3(ox, oy, oz), radius, dir.normalized, out hit, maxDistance > 0 ? maxDistance : Mathf.Infinity, layers, QueryTriggerInteraction.Ignore)) return 0;
            return HitResult(hit);
        }

        static int HitResult(RaycastHit hit)
        {
            vx = hit.point.x; vy = hit.point.y; vz = hit.point.z;
            nx = hit.normal.x; ny = hit.normal.y; nz = hit.normal.z;
            dist = hit.distance;
            var t = hit.collider.transform;
            while (t != null)
            {
                int id;
                if (ids.TryGetValue(t.gameObject, out id)) return id;
                t = t.parent;
            }
            return -1;
        }

        // ---------------- 相机与环境 ----------------

        [Preserve]
        public static void SetCamera(float fov, float near, float far)
        {
            var cam = Camera;
            if (fov > 0) cam.fieldOfView = fov;
            if (near > 0) cam.nearClipPlane = near;
            if (far > 0) cam.farClipPlane = far;
        }

        /// <summary>指数平方雾（density 为 0 关闭）。由 pot 着色器实现；高度雾与太阳散射见 PotRender（fog）</summary>
        [Preserve]
        public static void SetFog(float r, float g, float b, float density)
        {
            Shader.SetGlobalColor("_PotFogColor", new Color(r, g, b, 1));
            Shader.SetGlobalFloat("_PotFogDensity", Mathf.Max(0, density));
        }

        /// <summary>环境光（纯色）；reflection 为环境反射强度（0 到 1）</summary>
        [Preserve]
        public static void SetAmbient(float r, float g, float b, float reflection)
        {
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(r, g, b);
            if (reflection >= 0) RenderSettings.reflectionIntensity = Mathf.Clamp01(reflection);
        }

        /// <summary>三色环境光（天空、地平线、地面，sRGB）</summary>
        [Preserve]
        public static void SetAmbientTrilight(float sr, float sg, float sb, float er, float eg, float eb, float gr, float gg, float gb, float reflection)
        {
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(sr, sg, sb);
            RenderSettings.ambientEquatorColor = new Color(er, eg, eb);
            RenderSettings.ambientGroundColor = new Color(gr, gg, gb);
            if (reflection >= 0) RenderSettings.reflectionIntensity = Mathf.Clamp01(reflection);
        }

        /// <summary>灯光补充参数：spotAngle（度，0 不变）、shadows（-1 不变，0 无，1 硬，2 软）</summary>
        [Preserve]
        public static void LightOptions(int id, float spotAngle, int shadows)
        {
            var go = Get(id);
            if (go == null) return;
            var light = go.GetComponent<Light>();
            if (light == null) return;
            if (spotAngle > 0) light.spotAngle = spotAngle;
            if (shadows >= 0) light.shadows = shadows == 0 ? LightShadows.None : shadows == 1 ? LightShadows.Hard : LightShadows.Soft;
        }

        [Preserve]
        public static void SetLightIntensity(int id, float intensity)
        {
            var go = Get(id);
            if (go == null) return;
            var light = go.GetComponent<Light>();
            if (light != null) light.intensity = intensity;
        }

        static void ResetEnvironment()
        {
            SetFog(0, 0, 0, 0);
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.35f, 0.35f, 0.38f);
            RenderSettings.reflectionIntensity = 1;
            RenderSettings.sun = null;
            if (camera != null)
            {
                camera.fieldOfView = 60;
                camera.nearClipPlane = 0.3f;
                camera.farClipPlane = 1000;
            }
        }


        [Preserve]
        public static void SetActive(int id, bool active)
        {
            var go = Get(id);
            if (go != null) go.SetActive(active);
        }

        [Preserve]
        public static void LookAt(int id, float x, float y, float z)
        {
            var go = Get(id);
            if (go != null) go.transform.LookAt(new Vector3(x, y, z));
        }

        [Preserve]
        public static void Light(int id, string type, float intensity, float r, float g, float b, float range)
        {
            var go = Get(id);
            if (go == null) return;
            var light = go.GetComponent<Light>() ?? go.AddComponent<Light>();
            switch (type)
            {
                case "point": light.type = LightType.Point; break;
                case "spot": light.type = LightType.Spot; break;
                default: light.type = LightType.Directional; break;
            }
            light.intensity = intensity;
            light.color = new Color(r, g, b);
            if (range > 0) light.range = range;
            if (light.type == LightType.Directional)
            {
                light.shadows = LightShadows.Soft;
                if (RenderSettings.sun == null) RenderSettings.sun = light;
            }
        }

        [Preserve]
        public static int CameraId()
        {
            return CameraIdValue;
        }

        [Preserve]
        public static void SetBackground(float r, float g, float b)
        {
            var cam = Camera;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(r, g, b);
        }

        [Preserve]
        public static int Count()
        {
            var n = 0;
            foreach (var go in objects.Values) if (go != null) n++;
            return n;
        }

        /// <summary>冷重启时清理所有由 pot 创建的对象与资源（相机保留，重置环境与渲染设置）</summary>
        public static void Clear()
        {
            foreach (var go in objects.Values) if (go != null) Object.Destroy(go);
            objects.Clear();
            ids.Clear();
            meshUsers.Clear();
            meshOfObject.Clear();
            colliderKinds.Clear();
            collidersOff.Clear();
            foreach (var t in textures.Values) if (t != null) Object.Destroy(t);
            textures.Clear();
            foreach (var m in meshes.Values) if (m != null) Object.Destroy(m);
            meshes.Clear();
            meshKeys.Clear();
            meshAttrs.Clear();
            ResetEnvironment();
            PotRender.Clear();
            PotUI.Clear();
            PotAudio.Clear();
            PotInput.SetCursor(false);
            if (root != null)
            {
                for (var i = root.childCount - 1; i >= 0; i--) Object.Destroy(root.GetChild(i).gameObject);
            }
            if (camera != null)
            {
                camera.transform.position = new Vector3(0, 1, -10);
                camera.transform.rotation = Quaternion.identity;
                camera.clearFlags = CameraClearFlags.SolidColor;
                camera.backgroundColor = new Color(0.1f, 0.1f, 0.12f);
            }
        }
    }
}
