using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Scripting;

namespace Pot
{
    /// <summary>PotRender 的每帧驱动：同步太阳到着色器全局量、更新平面反射相机、延迟刷新环境反射</summary>
    [Preserve]
    public class PotRenderDriver : MonoBehaviour
    {
        static PotRenderDriver instance;

        public static void Ensure()
        {
            if (instance != null) return;
            var go = new GameObject("PotRenderDriver");
            DontDestroyOnLoad(go);
            go.AddComponent<PotRenderDriver>();
        }

        void Awake()
        {
            if (instance != null && instance != this) { Destroy(this); return; }
            instance = this;
            PotRender.ResetGlobals();
            RenderPipelineManager.beginCameraRendering += PotRender.BeginCamera;
        }

        void OnDestroy()
        {
            if (instance != this) return;
            RenderPipelineManager.beginCameraRendering -= PotRender.BeginCamera;
            instance = null;
        }

        void LateUpdate()
        {
            PotRender.LateTick();
        }
    }
}
