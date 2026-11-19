using System;
using System.Globalization;
using Puerts;
using UnityEngine;
using UnityEngine.Scripting;

namespace Pot
{
    /// <summary>
    /// JS 运行时宿主：创建 Puerts ScriptEnv，加载 Resources/pot/core.cjs，启动游戏并每帧驱动。
    /// 冷重启（Restart）= 导出 state → 销毁 ScriptEnv → 新建 ScriptEnv → 带着 state 启动。
    /// </summary>
    [Preserve]
    public class PotRuntime : MonoBehaviour
    {
        public enum RuntimeStatus { Idle, Booting, Running, Failed }

        public static PotRuntime Instance { get; private set; }

        /// <summary>ScriptEnv 创建、core 加载之后、游戏启动之前调用（devtools 在此加载 pot/devtools.cjs）</summary>
        public static event Action<ScriptEnv> OnEnvCreated;

        /// <summary>启动完成（ok, error）</summary>
        public static event Action<bool, string> Booted;

        /// <summary>JS 读取：本帧 dt（秒）</summary>
        [Preserve] public static double frameDt;

        /// <summary>启动加载进度（0..1，小于 0 表示未知）与阶段文字，外壳据此画加载界面</summary>
        public static float LoadProgress = -1;
        public static string LoadText = "";

        /// <summary>本次启动开始的时间（realtimeSinceStartup）与耗时（秒，启动完成后有效）</summary>
        public float BootStartTime { get; private set; }
        public float BootSeconds { get; private set; }

        internal static bool gcRequested;
        static string bootState = "";

        public RuntimeStatus Status { get; private set; }
        public string LastError { get; private set; }
        public ScriptEnv Env { get { return env; } }
        public int Boots { get; private set; }

        /// <summary>单帧最大 dt，避免卡顿后游戏时间突跳</summary>
        public float maxDeltaTime = 0.1f;

        ScriptEnv env;
        BackendV8 backend;
        int tickErrors;

        public static PotRuntime Ensure()
        {
            if (Instance != null) return Instance;
            var go = new GameObject("PotRuntime");
            DontDestroyOnLoad(go);
            return go.AddComponent<PotRuntime>();
        }

        void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            if (GetComponent<PotUIDrawer>() == null) gameObject.AddComponent<PotUIDrawer>();
            PotRenderDriver.Ensure();
        }

        [Preserve]
        public static string TakeBootState()
        {
            var s = bootState;
            bootState = "";
            return s ?? "";
        }

        /// <summary>启动游戏。state 为上次 exportState 的 JSON（空串表示全新）</summary>
        public void Boot(string state)
        {
            Shutdown();
            Status = RuntimeStatus.Booting;
            LastError = null;
            tickErrors = 0;
            Boots++;
            LoadProgress = -1;
            LoadText = "";
            BootStartTime = Time.realtimeSinceStartup;
            try
            {
                backend = new BackendV8();
                env = new ScriptEnv(backend);
                var core = Resources.Load<TextAsset>("pot/core");
                if (core == null) throw new Exception("找不到 Resources/pot/core.cjs（com.pot.core 包不完整，请运行 js 的 npm run build）");
                env.Eval(core.text, "pot/core.cjs");
                if (OnEnvCreated != null) OnEnvCreated(env);
                bootState = state ?? "";
                env.Eval("pot.unity.boot(CS.Pot.PotRuntime.TakeBootState())", "pot/boot");
            }
            catch (Exception e)
            {
                HandleBooted(false, e.Message);
            }
        }

        internal void HandleBooted(bool ok, string error)
        {
            if (Status != RuntimeStatus.Booting) return;
            Status = ok ? RuntimeStatus.Running : RuntimeStatus.Failed;
            LastError = ok ? null : error;
            BootSeconds = Time.realtimeSinceStartup - BootStartTime;
            var cache = PotGfx.CacheInfo();
            if (ok) Debug.Log("[pot] 游戏已启动（" + BootSeconds.ToString("0.00", CultureInfo.InvariantCulture) + " 秒" + (string.IsNullOrEmpty(cache) ? "" : "，着色器缓存命中 " + cache) + "）");
            else Debug.LogError("[pot] 启动失败：" + error);
            if (Booted != null) Booted(ok, error);
        }

        /// <summary>导出 state JSON；失败或未运行返回空串</summary>
        public string ExportState()
        {
            if (env == null) return "";
            try
            {
                return env.Eval<string>("pot.unity.exportState()", "pot/export") ?? "";
            }
            catch (Exception e)
            {
                Debug.LogError("[pot] 导出 state 失败：" + e.Message);
                return "";
            }
        }

        /// <summary>冷重启。keepState=false 时清空 state</summary>
        public void Restart(bool keepState)
        {
            var state = keepState ? ExportState() : "";
            Boot(state);
        }

        /// <summary>在当前 ScriptEnv 执行一段 JS（外壳用，避免依赖 Puerts 程序集）</summary>
        public void Eval(string code, string chunkName)
        {
            if (env == null) throw new InvalidOperationException("游戏未运行");
            env.Eval(code, chunkName);
        }

        public string Info()
        {
            if (env == null) return "{\"status\":\"idle\"}";
            try { return env.Eval<string>("pot.unity.info()", "pot/info"); }
            catch (Exception e) { return "{\"status\":\"error\",\"error\":" + Json.Quote(e.Message) + "}"; }
        }

        public void Shutdown()
        {
            if (env != null)
            {
                try { env.Eval("pot.unity.stop()", "pot/stop"); }
                catch (Exception e) { Debug.LogWarning("[pot] stop 出错：" + e.Message); }
                try { env.Dispose(); }
                catch (Exception e) { Debug.LogWarning("[pot] 销毁 ScriptEnv 出错：" + e.Message); }
                env = null;
                backend = null;
            }
            PotScene.Clear();
            Status = RuntimeStatus.Idle;
        }

        void Update()
        {
            if (env == null) return;
            frameDt = Math.Min(Time.deltaTime, maxDeltaTime);
            if (Status == RuntimeStatus.Running)
            {
                try
                {
                    env.Eval("pot.unity.tick(CS.Pot.PotRuntime.frameDt)", "pot/tick");
                }
                catch (Exception e)
                {
                    tickErrors++;
                    if (tickErrors <= 10 || tickErrors % 300 == 0)
                        Debug.LogError("[pot] tick 出错（第 " + tickErrors.ToString(CultureInfo.InvariantCulture) + " 次）：" + e.Message);
                }
            }
            else if (Status == RuntimeStatus.Booting)
            {
                // 启动分阶段让帧（loading.step）：每帧放行一次，加载在帧之间推进，窗口保持响应
                try { env.Eval("pot.unity.pump()", "pot/pump"); }
                catch (Exception e) { Debug.LogError("[pot] 启动推进出错：" + e.Message); }
            }
            PotInput.EndFrame();
            if (env == null) return;
            env.Tick();
            if (gcRequested && backend != null)
            {
                gcRequested = false;
                backend.LowMemoryNotification();
            }
        }

        void OnDestroy()
        {
            if (Instance != this) return;
            Shutdown();
            Instance = null;
        }
    }
}
