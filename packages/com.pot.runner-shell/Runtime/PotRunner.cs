using System;
using System.Collections.Generic;
using Pot.Dev;
using UnityEngine;

namespace Pot.Runner
{
    /// <summary>
    /// Runner 外壳（类似 Expo Go）：自己打开游戏（本地目录 / .potg / URL），自己监听文件变化并热重载。
    /// Dev Server 只是 AI 与 Runner 之间的可选通道：后台静默连接，连上后 AI 可以 open / eval / 截图等。
    ///
    /// 启动参数：
    /// - PotRunner.exe D:/games/hello            第一个像游戏的位置参数（目录含 manifest.json、.potg 或 URL）
    /// - -potOpen=&lt;目录|.potg|URL&gt;             同上
    /// - -potServer=ws://host:7788/runner       Dev Server 地址（仅本次生效，不保存）
    /// 没有参数时显示首页：输入框 + 最近打开。F1 / 三指触摸打开面板。
    /// </summary>
    public class PotRunner : MonoBehaviour
    {
        const string ServerKey = "pot.server";
        const string RecentKey = "pot.recent";
        const string DefaultUrl = "ws://127.0.0.1:7788/runner";
        const int MaxRecent = 10;

        [Serializable]
        class ShellCommand
        {
            public string type;
            public int id;
            public string path;
            public string files;
            public string url;
            public bool reset;
        }

        PotDevClient client;
        GameSession session;
        string address;
        string openInput = "";
        bool showPanel;
        float fps;
        GUIStyle errorStyle;
        GUIStyle titleStyle;
        Vector2 errorScroll;
        string openError;
        string lastLogError;
        float lastLogErrorAt = -100;
        readonly List<string> recent = new List<string>();

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void AutoCreate()
        {
            if (FindObjectOfType<PotRunner>() != null || FindObjectOfType<PotBoot>() != null) return;
            new GameObject("PotRunner").AddComponent<PotRunner>();
        }

        public static string NormalizeServer(string input)
        {
            var s = (input ?? "").Trim();
            if (s.Length == 0) return DefaultUrl;
            if (!s.StartsWith("ws://", StringComparison.OrdinalIgnoreCase) && !s.StartsWith("wss://", StringComparison.OrdinalIgnoreCase)) s = "ws://" + s;
            var hostStart = s.IndexOf("//", StringComparison.Ordinal) + 2;
            var pathStart = s.IndexOf('/', hostStart);
            var hostPart = pathStart < 0 ? s.Substring(hostStart) : s.Substring(hostStart, pathStart - hostStart);
            if (hostPart.IndexOf(':') < 0) hostPart += ":7788";
            return s.Substring(0, hostStart) + hostPart + (pathStart < 0 ? "/runner" : s.Substring(pathStart));
        }

        void Awake()
        {
            DontDestroyOnLoad(gameObject);
            Application.runInBackground = true;
            if (Application.targetFrameRate <= 0) Application.targetFrameRate = 60;
            PotRuntime.Ensure();
            client = gameObject.AddComponent<PotDevClient>();
            session = gameObject.AddComponent<GameSession>();
            session.Opened += OnOpened;
            PotRuntime.Booted += OnBooted;
            PotDevClient.ShellHandler = HandleShellCommand;
            PotDevClient.GameInfo = session.InfoJson;
            Application.logMessageReceived += OnLog;
            LoadRecent();

            string server = null;
            string open = null;
            var args = Environment.GetCommandLineArgs();
            for (var i = 1; i < args.Length; i++)
            {
                var arg = args[i];
                if (arg.StartsWith("-potServer=", StringComparison.Ordinal)) server = arg.Substring("-potServer=".Length);
                else if (arg.StartsWith("-potOpen=", StringComparison.Ordinal)) open = arg.Substring("-potOpen=".Length);
                else if (open == null && GameSession.LooksLikeGame(arg)) open = arg;
            }
            address = NormalizeServer(server ?? PlayerPrefs.GetString(ServerKey, DefaultUrl));
            client.Connect(address); // 后台静默连接，连不上每 2 秒重试，不影响游戏
            if (open != null) OpenGame(open, false);
            else if (recent.Count > 0) openInput = recent[0];
        }

        void OnDestroy()
        {
            PotRuntime.Booted -= OnBooted;
            Application.logMessageReceived -= OnLog;
            if (PotDevClient.ShellHandler == (Func<string, string, int, bool>)HandleShellCommand) PotDevClient.ShellHandler = null;
            PotDevClient.GameInfo = null;
        }

        // ---------------- 打开游戏 ----------------

        void OpenGame(string spec, bool reset)
        {
            openError = null;
            lastLogError = null;
            session.Open(spec, reset);
        }

        void OnOpened(bool ok, string error)
        {
            if (ok)
            {
                openError = null;
                AddRecent(session.Spec);
                openInput = session.Spec;
                PotHost.Send("{\"type\":\"event\",\"name\":\"game\",\"data\":" + (session.InfoJson() ?? "null") + "}");
            }
            else
            {
                openError = error;
                client.FailBootReply(error);
            }
        }

        void OnBooted(bool ok, string error)
        {
            PotHost.Send("{\"type\":\"event\",\"name\":\"game\",\"data\":" + (session.InfoJson() ?? "null") + "}");
        }

        void GoHome()
        {
            session.Close();
            openError = null;
            lastLogError = null;
            PotHost.Send("{\"type\":\"event\",\"name\":\"game\",\"data\":null}");
        }

        // ---------------- Dev Server 命令 ----------------

        bool HandleShellCommand(string type, string raw, int id)
        {
            var cmd = JsonUtility.FromJson<ShellCommand>(raw) ?? new ShellCommand();
            switch (type)
            {
                case "open":
                {
                    string spec = null;
                    if (!string.IsNullOrEmpty(cmd.url)) spec = cmd.url;
                    else if (!string.IsNullOrEmpty(cmd.path) && GameSession.LooksLikeGame(cmd.path)) spec = cmd.path; // 与 Dev Server 同机
                    else if (!string.IsNullOrEmpty(cmd.files) && client.HttpBase != null) spec = client.HttpBase + cmd.files; // 手机等：从 Dev Server 镜像
                    if (spec == null)
                    {
                        client.Reply(id, false, null, "Runner 访问不到 " + (cmd.path ?? "该游戏") + "（不在同一台机器，且不在 Dev Server 根目录下）");
                        return true;
                    }
                    // 先登记：启动完成（可能在 Open 内同步完成）时由 PotDevClient 回复；打开失败时 OnOpened 回复错误
                    client.ReplyOnBoot(id, "open");
                    OpenGame(spec, cmd.reset);
                    return true;
                }
                case "restart":
                    if (!session.IsOpen)
                    {
                        client.Reply(id, false, null, "Runner 没有打开游戏，先 pot open <游戏目录>");
                        return true;
                    }
                    client.ReplyOnBoot(id, "restart");
                    session.Restart(!cmd.reset);
                    return true;
                case "home":
                    GoHome();
                    client.Reply(id, true, "{}", null);
                    return true;
            }
            return false;
        }

        // ---------------- 最近打开 ----------------

        void LoadRecent()
        {
            recent.Clear();
            foreach (var line in PlayerPrefs.GetString(RecentKey, "").Split('\n'))
            {
                var s = line.Trim();
                if (s.Length > 0 && !recent.Contains(s)) recent.Add(s);
            }
        }

        void AddRecent(string spec)
        {
            if (string.IsNullOrEmpty(spec)) return;
            recent.Remove(spec);
            recent.Insert(0, spec);
            while (recent.Count > MaxRecent) recent.RemoveAt(recent.Count - 1);
            SaveRecent();
        }

        void SaveRecent()
        {
            PlayerPrefs.SetString(RecentKey, string.Join("\n", recent.ToArray()));
            PlayerPrefs.Save();
        }

        // ---------------- 界面 ----------------

        void OnLog(string condition, string stackTrace, LogType type)
        {
            if (type != LogType.Error && type != LogType.Exception) return;
            if (condition.StartsWith("[pot] 启动失败", StringComparison.Ordinal) || condition.StartsWith("[pot] 打开失败", StringComparison.Ordinal)) return;
            lastLogError = condition;
            lastLogErrorAt = Time.realtimeSinceStartup;
        }

        void Update()
        {
            if (Input.GetKeyDown(KeyCode.F1)) showPanel = !showPanel;
            if (Input.touchCount >= 3 && Input.GetTouch(2).phase == TouchPhase.Began) showPanel = !showPanel;
            if (showPanel && Cursor.lockState != CursorLockMode.None) PotInput.SetCursor(false);
            fps = Mathf.Lerp(fps, 1f / Mathf.Max(0.0001f, Time.unscaledDeltaTime), 0.05f);
        }

        string DevStatus()
        {
            switch (client.State)
            {
                case PotDevClient.ConnectionState.Connected: return "Dev 已连接";
                case PotDevClient.ConnectionState.Connecting: return "Dev 连接中";
                default: return "Dev 未连接";
            }
        }

        void EnsureStyles()
        {
            if (errorStyle != null) return;
            errorStyle = new GUIStyle(GUI.skin.box) { alignment = TextAnchor.UpperLeft, wordWrap = true, fontSize = 13 };
            errorStyle.normal.textColor = new Color(1f, 0.6f, 0.6f);
            titleStyle = new GUIStyle(GUI.skin.label) { fontSize = 22, fontStyle = FontStyle.Bold };
        }

        void OnGUI()
        {
            EnsureStyles();
            var scale = Mathf.Max(1f, Screen.dpi / 120f);
            GUI.matrix = Matrix4x4.Scale(new Vector3(scale, scale, 1));
            var width = Screen.width / scale;
            var height = Screen.height / scale;

            if (!session.IsOpen) DrawHome(width, height);
            else
            {
                var rt = PotRuntime.Instance;
                if (rt != null && rt.Status == PotRuntime.RuntimeStatus.Booting) DrawLoading(width, height, rt);
                DrawStatusBar(width, height);
            }
            if (showPanel) DrawPanel(width);
        }

        GUIStyle loadTitleStyle, loadTextStyle;

        /// <summary>启动加载界面：不透明遮住半成品场景，显示游戏名、进度条与当前阶段（进度未知时画来回移动的滑块）</summary>
        void DrawLoading(float width, float height, PotRuntime rt)
        {
            if (loadTitleStyle == null)
            {
                loadTitleStyle = new GUIStyle(GUI.skin.label) { fontSize = 26, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter };
                loadTitleStyle.normal.textColor = new Color(0.92f, 0.94f, 0.96f);
                loadTextStyle = new GUIStyle(GUI.skin.label) { fontSize = 13, alignment = TextAnchor.MiddleCenter };
                loadTextStyle.normal.textColor = new Color(0.7f, 0.74f, 0.78f);
            }
            var old = GUI.color;
            GUI.color = new Color(0.055f, 0.06f, 0.07f, 1f);
            GUI.DrawTexture(new Rect(0, 0, width, height), Texture2D.whiteTexture);
            var w = Mathf.Min(520f, width - 64f);
            var x = (width - w) / 2f;
            var y = height * 0.5f;
            GUI.color = old;
            GUI.Label(new Rect(0, y - 70, width, 36), session.Name ?? "加载中", loadTitleStyle);
            // 进度条
            GUI.color = new Color(1f, 1f, 1f, 0.12f);
            GUI.DrawTexture(new Rect(x, y, w, 6), Texture2D.whiteTexture);
            GUI.color = new Color(0.35f, 0.75f, 1f, 0.95f);
            var p = PotRuntime.LoadProgress;
            var elapsed = Time.realtimeSinceStartup - rt.BootStartTime;
            if (p >= 0) GUI.DrawTexture(new Rect(x, y, w * Mathf.Clamp01(p), 6), Texture2D.whiteTexture);
            else
            {
                var seg = w * 0.22f;
                var t = Mathf.PingPong(elapsed * 0.8f, 1f);
                GUI.DrawTexture(new Rect(x + (w - seg) * t, y, seg, 6), Texture2D.whiteTexture);
            }
            GUI.color = old;
            var pct = p >= 0 ? Mathf.RoundToInt(Mathf.Clamp01(p) * 100) + "%  " : "";
            GUI.Label(new Rect(0, y + 14, width, 22), pct + (string.IsNullOrEmpty(PotRuntime.LoadText) ? "启动中" : PotRuntime.LoadText) + "  " + elapsed.ToString("0.0", System.Globalization.CultureInfo.InvariantCulture) + "s", loadTextStyle);
        }

        void DrawHome(float width, float height)
        {
            var w = Mathf.Min(width - 32, 720);
            GUILayout.BeginArea(new Rect((width - w) / 2, 24, w, height - 48));
            GUILayout.Label("pot Runner", titleStyle);
            GUILayout.Label("打开游戏：本地目录（含 manifest.json）、.potg 文件，或 http://电脑IP:7788/files/games/xxx/");
            GUILayout.BeginHorizontal();
            openInput = GUILayout.TextField(openInput ?? "", GUILayout.Height(30));
            GUI.enabled = !session.Busy;
            if (GUILayout.Button(session.Busy ? "打开中…" : "打开", GUILayout.Width(90), GUILayout.Height(30))) OpenGame(openInput, false);
            GUI.enabled = true;
            GUILayout.EndHorizontal();
            if (session.Busy && session.SourceStatus != null) GUILayout.Label(session.SourceStatus);
            if (!string.IsNullOrEmpty(openError)) GUILayout.Box(openError, errorStyle);

            GUILayout.Space(12);
            GUILayout.Label("最近打开");
            if (recent.Count == 0) GUILayout.Label("（无）");
            string remove = null, open = null;
            // OpenGame 会把条目挪到 recent 最前，遍历中不能直接调用
            foreach (var spec in recent.ToArray())
            {
                GUILayout.BeginHorizontal();
                if (GUILayout.Button(spec, GUILayout.Height(28))) openInput = spec;
                if (GUILayout.Button("打开", GUILayout.Width(60), GUILayout.Height(28))) open = spec;
                if (GUILayout.Button("×", GUILayout.Width(28), GUILayout.Height(28))) remove = spec;
                GUILayout.EndHorizontal();
            }
            if (open != null) OpenGame(open, false);
            if (remove != null)
            {
                recent.Remove(remove);
                SaveRecent();
            }

            GUILayout.Space(12);
            GUILayout.Label(DevStatus() + "：" + address + (client.State == PotDevClient.ConnectionState.Connected ? "（AI 可通过 pot open 打开游戏）" : "（可选，启动 pot dev 后自动连上）"));
            GUILayout.Label("F1 / 三指触摸：面板");
            GUILayout.EndArea();
        }

        GUIStyle chipStyle;

        void DrawStatusBar(float width, float height)
        {
            var runtime = PotRuntime.Instance;
            var status = runtime != null ? runtime.Status.ToString() : "-";
            var label = (session.Name ?? "?") + "  " + status + "  " + Mathf.RoundToInt(fps) + "fps  " + DevStatus() + "  F1";
            if (session.SourceStatus != null) label += "  " + session.SourceStatus;
            if (chipStyle == null)
            {
                chipStyle = new GUIStyle(GUI.skin.label) { fontSize = 11, alignment = TextAnchor.MiddleLeft };
                chipStyle.normal.textColor = new Color(1, 1, 1, 0.45f);
            }
            // 游戏通常自己画 HUD：外壳只在左下角留一行小字，点击打开面板
            if (GUI.Button(new Rect(8, height - 22, Mathf.Min(width - 16, 420), 20), label, chipStyle)) showPanel = !showPanel;

            var y = 40f;
            if (runtime != null && runtime.Status == PotRuntime.RuntimeStatus.Failed && !string.IsNullOrEmpty(runtime.LastError))
            {
                var rect = new Rect(8, y, Mathf.Min(width - 16, 760), 240);
                GUI.Box(rect, GUIContent.none, errorStyle);
                GUILayout.BeginArea(new Rect(rect.x + 6, rect.y + 6, rect.width - 12, rect.height - 12));
                errorScroll = GUILayout.BeginScrollView(errorScroll);
                GUILayout.Label("启动失败（修改代码保存后自动重试）：\n" + runtime.LastError, errorStyle);
                GUILayout.EndScrollView();
                GUILayout.EndArea();
                y += 246;
            }
            else if (lastLogError != null && Time.realtimeSinceStartup - lastLogErrorAt < 8f)
            {
                var text = lastLogError.Length > 400 ? lastLogError.Substring(0, 400) + "…" : lastLogError;
                if (GUI.Button(new Rect(8, y, Mathf.Min(width - 16, 760), 64), text, errorStyle)) lastLogError = null;
            }
        }

        void DrawPanel(float width)
        {
            var runtime = PotRuntime.Instance;
            var w = Mathf.Min(width - 16, 520);
            GUILayout.BeginArea(new Rect(width - w - 8, 40, w, 330), GUI.skin.box);
            if (session.IsOpen)
            {
                GUILayout.Label("游戏：" + session.Name + "（" + session.Id + "）");
                GUILayout.Label("来源：" + session.Spec);
                GUILayout.Label("状态：" + (runtime != null ? runtime.Status.ToString() : "-") + "  启动 " + (runtime != null ? runtime.Boots : 0) + " 次  热重载 " + session.Reloads + " 次");
                GUILayout.BeginHorizontal();
                if (GUILayout.Button("冷重启", GUILayout.Height(28))) session.Restart(true);
                if (GUILayout.Button("清空存档重来", GUILayout.Height(28))) session.Restart(false);
                if (GUILayout.Button("返回首页", GUILayout.Height(28))) GoHome();
                GUILayout.EndHorizontal();
            }
            GUILayout.Space(6);
            GUILayout.Label("Dev Server（可选，AI 通道）：ws://IP:端口/runner 或 IP:端口");
            address = GUILayout.TextField(address ?? "");
            GUILayout.BeginHorizontal();
            if (GUILayout.Button("连接", GUILayout.Height(28)))
            {
                address = NormalizeServer(address);
                PlayerPrefs.SetString(ServerKey, address);
                PlayerPrefs.Save();
                client.Connect(address);
            }
            if (GUILayout.Button("断开", GUILayout.Height(28))) client.Disconnect();
            GUILayout.EndHorizontal();
            GUILayout.Label(DevStatus() + (client.State != PotDevClient.ConnectionState.Connected && client.LastError != null ? "（" + client.LastError + "）" : "") + "  收到命令 " + client.Commands);
            GUILayout.Label("F1 / 三指触摸 关闭本面板");
            GUILayout.EndArea();
        }
    }
}
