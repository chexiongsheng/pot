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
                            var mc = go.AddComponent<MeshCollider>();
                            mc.sharedMesh = mesh;
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
            return id;
        }

        [Preserve]
        public static void Destroy(int id)
        {
            GameObject go;
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
        public static Material ModeMaterial(string mode)
        {
            if (string.IsNullOrEmpty(mode) || mode == "lit") return DefaultMaterial;
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
            return mat;
        }

        /// <summary>切换材质模式；castShadows：-1 不变，0 关，1 开</summary>
        [Preserve]
        public static void SetMaterial(int id, string mode, int castShadows)
        {
            var go = Get(id);
            if (go == null) return;
            var renderer = go.GetComponent<Renderer>();
            if (renderer == null) return;
            if (!string.IsNullOrEmpty(mode)) renderer.sharedMaterial = ModeMaterial(mode);
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

        /// <summary>
        /// 注册网格（之后可用 Spawn("mesh:name")）。positions/normals 为 Float32 xyz，uvs 为 Float32 uv，
        /// colors 为 Float32 rgba（sRGB），indices 为 Uint32 三角形。normals/uvs/colors 可为 null。同名覆盖。
        /// </summary>
        [Preserve]
        public static int Mesh(string name, Puerts.ArrayBuffer positions, Puerts.ArrayBuffer normals, Puerts.ArrayBuffer uvs, Puerts.ArrayBuffer colors, Puerts.ArrayBuffer indices)
        {
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
            return vcount;
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
            foreach (var c in go.GetComponents<Collider>()) c.enabled = enabled;
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
            foreach (var t in textures.Values) if (t != null) Object.Destroy(t);
            textures.Clear();
            foreach (var m in meshes.Values) if (m != null) Object.Destroy(m);
            meshes.Clear();
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
