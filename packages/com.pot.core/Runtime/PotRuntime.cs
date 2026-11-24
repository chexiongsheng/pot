using System;
using System.Collections.Generic;
using System.Globalization;
using Puerts;
using UnityEngine;
using UnityEngine.Scripting;

namespace Pot
{
    /// <summary>
    /// JS 运行时宿主：创建 Puerts ScriptEnv，加载 Resources/pot/core.cjs，启动游戏并每帧驱动。
    /// 冷重启（Restart）= 导出 state → 销毁 ScriptEnv → 新建 ScriptEnv → 带着 state 启动。
    /// C# 调 JS 不用 ScriptEnv.Eval（小游戏环境禁止 eval）：JS 加载时经 Bind 注册无参入口，C# 用 Call/CallEntry 调用。
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
        Backend backend;
        int tickErrors;

        /// <summary>
        /// JS 后端：桌面/移动用 V8；WebGL 用浏览器自身的 JS 引擎（Puerts.BackendWebGL，来自 com.tencent.puerts.webgl 包）。
        /// </summary>
        static Backend CreateBackend()
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            Type type = null;
            foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
            {
                type = asm.GetType("Puerts.BackendWebGL");
                if (type != null) break;
            }
            if (type == null) throw new Exception("WebGL 需要 Puerts WebGL 后端（com.tencent.puerts.webgl 包），当前工程未安装");
            return (Backend)Activator.CreateInstance(type, new object[] { new DefaultLoader() });
#else
            return new BackendV8();
#endif
        }

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

        // ---------------- C# → JS 入口（不用 eval：小游戏环境禁止 eval / new Function） ----------------

        static readonly Dictionary<string, Action> entries = new Dictionary<string, Action>();
        static string callArg = "";
        static string callResult;

        /// <summary>JS 调用（pot.bindEntry）：注册无参入口，fn 为 null 时注销</summary>
        [Preserve]
        public static void Bind(string name, Action fn)
        {
            if (string.IsNullOrEmpty(name)) return;
            if (fn == null) entries.Remove(name);
            else entries[name] = fn;
        }

        /// <summary>JS 调用：取本次调用的参数</summary>
        [Preserve]
        public static string TakeArg()
        {
            var s = callArg;
            callArg = "";
            return s ?? "";
        }

        /// <summary>JS 调用：带回本次调用的返回值</summary>
        [Preserve]
        public static void Return(string value)
        {
            callResult = value;
        }

        static string CallEntry(string name, string arg)
        {
            Action fn;
            if (!entries.TryGetValue(name, out fn)) throw new Exception("JS 入口未注册：" + name);
            callArg = arg ?? "";
            callResult = null;
            try
            {
                fn();
                return callResult;
            }
            finally
            {
                callArg = "";
                callResult = null;
            }
        }

        /// <summary>调用 JS 侧注册的入口（如 devtools.changed），返回 JS 带回的字符串（没有则为 null）。外壳用，避免依赖 Puerts 程序集</summary>
        public string Call(string name, string arg = "")
        {
            if (env == null) throw new InvalidOperationException("游戏未运行");
            return CallEntry(name, arg);
        }

        public bool HasEntry(string name)
        {
            return env != null && entries.ContainsKey(name);
        }

        /// <summary>
        /// 加载 Resources 里的 .cjs 脚本（resourcePath 不带扩展名）。
        /// WebGL/小游戏禁止 eval，走 ExecuteModule（PotBuild 把脚本放进 Assets/PotGame/Js~/Resources，Puerts 构建后处理打进 JS 资源）；
        /// 桌面/移动 V8 的 Eval 是原生编译，不受影响。
        /// </summary>
        public static void LoadScript(ScriptEnv env, string resourcePath)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            env.ExecuteModule(resourcePath + ".cjs");
#else
            var asset = Resources.Load<TextAsset>(resourcePath);
            if (asset == null) throw new Exception("找不到 Resources/" + resourcePath + ".cjs");
            env.Eval(asset.text, resourcePath + ".cjs");
#endif
        }

        /// <summary>WebGL 发布包：构建时由 bundle.cjs 包装出的工厂脚本（见 PotBuild.WriteWebGLScripts），JS 侧读 globalThis.__potBundle</summary>
        public const string BundleFactory = "pot-game/bundle-factory";

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
                backend = CreateBackend();
                env = new ScriptEnv(backend);
                entries.Clear();
                try { LoadScript(env, "pot/core"); }
                catch (Exception e) { throw new Exception("加载 pot/core.cjs 失败（com.pot.core 包不完整时请运行 js 的 npm run build）：" + e.Message); }
                if (!entries.ContainsKey("unity.boot")) throw new Exception("pot/core.cjs 没有注册 C# 入口（版本过旧？请运行 js 的 npm run build）");
#if UNITY_WEBGL && !UNITY_EDITOR
                if (GameFS.UseResources) LoadScript(env, BundleFactory);
#endif
                if (OnEnvCreated != null) OnEnvCreated(env);
                bootState = state ?? "";
                CallEntry("unity.boot", TakeBootState());
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
            var gfx = PotGfx.Backend();
            if (ok) Debug.Log("[pot] 游戏已启动（" + BootSeconds.ToString("0.00", CultureInfo.InvariantCulture) + " 秒，运行时着色器 " + (string.IsNullOrEmpty(gfx) ? "不可用" : gfx) + (string.IsNullOrEmpty(cache) ? "" : "，着色器缓存命中 " + cache) + (string.IsNullOrEmpty(GameFS.CacheInfo()) ? "" : "，转译缓存命中 " + GameFS.CacheInfo()) + "）");
            else Debug.LogError("[pot] 启动失败：" + error);
            if (ok && string.IsNullOrEmpty(gfx)) Debug.LogWarning("[pot] " + PotGfx.Unsupported() + "；ctx.gfx 的自定义着色器、three 材质、烘焙和后处理链都不会生效，游戏将走回退画面");
            if (Booted != null) Booted(ok, error);
        }

        /// <summary>导出 state JSON；失败或未运行返回空串</summary>
        public string ExportState()
        {
            if (env == null) return "";
            try
            {
                return CallEntry("unity.exportState", "") ?? "";
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

        public string Info()
        {
            if (env == null) return "{\"status\":\"idle\"}";
            try { return CallEntry("unity.info", "") ?? "{\"status\":\"idle\"}"; }
            catch (Exception e) { return "{\"status\":\"error\",\"error\":" + Json.Quote(e.Message) + "}"; }
        }

        public void Shutdown()
        {
            if (env != null)
            {
                try { if (entries.ContainsKey("unity.stop")) CallEntry("unity.stop", ""); }
                catch (Exception e) { Debug.LogWarning("[pot] stop 出错：" + e.Message); }
                // 入口委托持有旧 ScriptEnv 的 JS 函数，销毁前先释放
                entries.Clear();
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
                    CallEntry("unity.tick", "");
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
                try { CallEntry("unity.pump", ""); }
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
