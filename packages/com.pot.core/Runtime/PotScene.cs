using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Scripting;

namespace Pot
{
    /// <summary>
    /// 引擎桥：JS 只拿到整数 id，不直接接触 GameObject。
    /// 向量通过静态字段 vx/vy/vz 带回，避免结构体封送。
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
                    var shader = Resources.Load<Shader>("pot/PotLit");
                    if (shader == null || !shader.isSupported)
                    {
                        Debug.LogWarning("[pot] Pot/Lit 着色器不可用，回退到 Legacy Diffuse");
                        shader = Shader.Find("Legacy Shaders/Diffuse");
                    }
                    defaultMaterial = new Material(shader) { name = "PotDefault" };
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
                default: go = new GameObject(); break;
            }
            var id = nextId++;
            go.name = string.IsNullOrEmpty(name) ? shape + "#" + id : name;
            var meshRenderer = go.GetComponent<Renderer>();
            if (meshRenderer != null) meshRenderer.sharedMaterial = DefaultMaterial;
            var parentGo = parent != 0 ? Get(parent) : null;
            go.transform.SetParent(parentGo != null ? parentGo.transform : Root, false);
            objects[id] = go;
            return id;
        }

        [Preserve]
        public static void Destroy(int id)
        {
            GameObject go;
            if (!objects.TryGetValue(id, out go)) return;
            objects.Remove(id);
            if (go != null) Object.Destroy(go);
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
            if (renderer != null) renderer.material.color = new Color(r, g, b, a);
            var light = go.GetComponent<Light>();
            if (light != null) light.color = new Color(r, g, b, a);
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
            if (light.type == LightType.Directional) light.shadows = LightShadows.Soft;
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

        /// <summary>冷重启时清理所有由 pot 创建的对象（相机保留，重置背景）</summary>
        public static void Clear()
        {
            foreach (var go in objects.Values) if (go != null) Object.Destroy(go);
            objects.Clear();
            if (root != null)
            {
                for (var i = root.childCount - 1; i >= 0; i--) Object.Destroy(root.GetChild(i).gameObject);
            }
            if (camera != null)
            {
                camera.transform.position = new Vector3(0, 1, -10);
                camera.transform.rotation = Quaternion.identity;
                camera.clearFlags = CameraClearFlags.Skybox;
            }
        }
    }
}
