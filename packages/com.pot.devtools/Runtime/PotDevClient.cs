using System;
using System.Collections;
using System.Collections.Concurrent;
using System.IO;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Puerts;
using UnityEngine;
using UnityEngine.Scripting;

namespace Pot.Dev
{
    /// <summary>
    /// Runner 与 Dev Server 之间的开发通道（ws://host:port/runner）。
    /// 协议见 js/devserver/server.js：
    /// - Runner → Server：hello、log、result、event
    /// - Server → Runner：open / restart / home 交给外壳（ShellHandler）；screenshot / input 由本类处理；
    ///   其余命令转给 JS 的 pot.devtools.handle
    /// Dev Server 只是 AI 与 Runner 之间的通道：游戏由 Runner 自己加载、监听、热重载，不经过这里。
    /// 网络收发在线程池，命令处理在主线程（Update）。
    /// </summary>
    [Preserve]
    public class PotDevClient : MonoBehaviour
    {
        public enum ConnectionState { Disconnected, Connecting, Connected }

        [Serializable]
        class Command
        {
            public string type;
            public int id;
            public bool reset;
            public int width;
            public string action;
            public string name;
            public float x;
            public float y;
            public int frames;
            public string mode;
        }

        public static PotDevClient Instance { get; private set; }

        /// <summary>
        /// 外壳命令处理（type, 原始 JSON, id）→ 是否已处理。open / home 必须由外壳处理；
        /// restart 未处理时回退为 PotRuntime.Restart。外壳处理后自行调用 Reply 或 ReplyOnBoot。
        /// </summary>
        public static Func<string, string, int, bool> ShellHandler;

        /// <summary>当前游戏信息 JSON（hello 与启动回复里带上）；null 表示没有打开游戏</summary>
        public static Func<string> GameInfo;

        /// <summary>Dev Server 的 HTTP 根地址（由 ws 地址推出），如 http://192.168.1.5:7788</summary>
        public string HttpBase
        {
            get
            {
                if (string.IsNullOrEmpty(Url)) return null;
                Uri uri;
                if (!Uri.TryCreate(Url, UriKind.Absolute, out uri)) return null;
                var scheme = uri.Scheme == "wss" ? "https" : "http";
                return scheme + "://" + uri.Host + ":" + uri.Port;
            }
        }

        public string Url { get; private set; }
        public ConnectionState State { get { return state; } }
        public string LastError { get; private set; }
        public int Commands { get; private set; }
        public bool AutoReconnect = true;

        /// <summary>Dev Server 拒绝（已有 Runner）或被接管时的关闭码，与 js/devserver/server.js 的 BUSY_CODE 一致</summary>
        public const int BusyCode = 4409;

        /// <summary>因已有 Runner 被拒或被接管而停止了自动重连</summary>
        public bool Busy { get { return busy; } }

        volatile bool busy;
        volatile ConnectionState state = ConnectionState.Disconnected;
        ClientWebSocket socket;
        CancellationTokenSource cts;
        readonly ConcurrentQueue<string> inbox = new ConcurrentQueue<string>();
        readonly ConcurrentQueue<string> outbox = new ConcurrentQueue<string>();
        float reconnectAt = -1;
        int pendingBootId = -1;
        string pendingBootKind;

        static string pendingJs;

        void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(this);
                return;
            }
            Instance = this;
            PotRuntime.OnEnvCreated += LoadDevtools;
            PotRuntime.Booted += OnBooted;
            PotHost.SendHook = Enqueue;
            PotHost.LogHook = (level, text) => EnqueueLog(level, text);
            Application.logMessageReceivedThreaded += OnUnityLog;
        }

        void OnDestroy()
        {
            if (Instance != this) return;
            PotRuntime.OnEnvCreated -= LoadDevtools;
            PotRuntime.Booted -= OnBooted;
            PotHost.SendHook = null;
            PotHost.LogHook = null;
            Application.logMessageReceivedThreaded -= OnUnityLog;
            Disconnect();
            Instance = null;
        }

        static void LoadDevtools(ScriptEnv env)
        {
            var asset = Resources.Load<TextAsset>("pot/devtools");
            if (asset == null)
            {
                Debug.LogError("[pot] 找不到 Resources/pot/devtools.cjs");
                return;
            }
            env.Eval(asset.text, "pot/devtools.cjs");
        }

        [Preserve]
        public static string TakePending()
        {
            var s = pendingJs;
            pendingJs = null;
            return s;
        }

        // ---------------- 连接 ----------------

        /// <summary>
        /// 连接 Dev Server。takeover=true（面板里手动点“连接”）时，即使已有别的 Runner 在线也接管；
        /// 后台自动连接用 false，Dev Server 已被占用时会被拒绝并停止重连。
        /// </summary>
        public void Connect(string url, bool takeover = false)
        {
            Disconnect();
            Url = url;
            AutoReconnect = true;
            busy = false;
            takeoverNext = takeover;
            StartConnect();
        }

        bool takeoverNext;

        public void Disconnect()
        {
            AutoReconnect = false;
            reconnectAt = -1;
            if (cts != null) cts.Cancel();
            if (socket != null)
            {
                try { socket.Abort(); } catch (Exception) { }
                socket.Dispose();
            }
            socket = null;
            cts = null;
            state = ConnectionState.Disconnected;
        }

        void StartConnect()
        {
            if (string.IsNullOrEmpty(Url)) return;
            state = ConnectionState.Connecting;
            LastError = null;
            cts = new CancellationTokenSource();
            socket = new ClientWebSocket();
            var ws = socket;
            var token = cts.Token;
            var hello = "{\"type\":\"hello\",\"platform\":" + Json.Quote(Application.platform.ToString())
                + ",\"unity\":" + Json.Quote(Application.unityVersion)
                + ",\"device\":" + Json.Quote(SystemInfo.deviceModel)
                + ",\"game\":" + CurrentGame() + "}";
            var url = Url;
            if (takeoverNext)
            {
                url += (url.Contains("?") ? "&" : "?") + "takeover=1";
                takeoverNext = false;
            }
            Task.Run(() => RunAsync(ws, url, hello, token));
        }

        async Task RunAsync(ClientWebSocket ws, string url, string hello, CancellationToken token)
        {
            try
            {
                await ws.ConnectAsync(new Uri(url), token).ConfigureAwait(false);
                state = ConnectionState.Connected;
                await SendRaw(ws, hello, token).ConfigureAwait(false);
                var sender = SendLoop(ws, token);
                await ReceiveLoop(ws, token).ConfigureAwait(false);
                await sender.ConfigureAwait(false);
            }
            catch (Exception e)
            {
                if (!token.IsCancellationRequested) LastError = e.Message;
            }
            finally
            {
                if (ws == socket) state = ConnectionState.Disconnected;
            }
        }

        static Task SendRaw(ClientWebSocket ws, string text, CancellationToken token)
        {
            var bytes = Encoding.UTF8.GetBytes(text);
            return ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, token);
        }

        async Task SendLoop(ClientWebSocket ws, CancellationToken token)
        {
            while (!token.IsCancellationRequested && ws.State == WebSocketState.Open)
            {
                string msg;
                if (outbox.TryDequeue(out msg))
                {
                    await SendRaw(ws, msg, token).ConfigureAwait(false);
                    continue;
                }
                await Task.Delay(4, token).ConfigureAwait(false);
            }
        }

        async Task ReceiveLoop(ClientWebSocket ws, CancellationToken token)
        {
            var buffer = new byte[64 * 1024];
            var stream = new MemoryStream();
            while (!token.IsCancellationRequested && ws.State == WebSocketState.Open)
            {
                var result = await ws.ReceiveAsync(new ArraySegment<byte>(buffer), token).ConfigureAwait(false);
                if (result.MessageType == WebSocketMessageType.Close)
                {
                    if (ws.CloseStatus.HasValue && (int)ws.CloseStatus.Value == BusyCode)
                    {
                        // 同一 Dev Server 已有别的 Runner：停止自动重连，否则两边会互相顶替、反复重连
                        busy = true;
                        LastError = ws.CloseStatusDescription == "runner-replaced"
                            ? "已被另一个 Runner 接管，停止自动重连（点“连接”可接管回来）"
                            : "Dev Server 已被另一个 Runner 占用，停止自动重连（点“连接”可强制接管）";
                    }
                    else LastError = "Dev Server 关闭了连接";
                    break;
                }
                stream.Write(buffer, 0, result.Count);
                if (!result.EndOfMessage) continue;
                inbox.Enqueue(Encoding.UTF8.GetString(stream.GetBuffer(), 0, (int)stream.Length));
                stream.SetLength(0);
            }
        }

        // ---------------- 发送 ----------------

        void Enqueue(string message)
        {
            if (state != ConnectionState.Connected && outbox.Count > 2000) return;
            outbox.Enqueue(message);
        }

        void EnqueueLog(string level, string text)
        {
            Enqueue("{\"type\":\"log\",\"level\":" + Json.Quote(level) + ",\"text\":" + Json.Quote(text) + "}");
        }

        void OnUnityLog(string condition, string stackTrace, LogType type)
        {
            if (PotHost.InJsLog) return; // 已由 LogHook 带级别转发
            string level;
            switch (type)
            {
                case LogType.Error:
                case LogType.Exception:
                case LogType.Assert:
                    level = "error";
                    if (type == LogType.Exception && !string.IsNullOrEmpty(stackTrace)) condition += "\n" + stackTrace;
                    break;
                case LogType.Warning: level = "warn"; break;
                default: level = "info"; break;
            }
            EnqueueLog(level, condition);
        }

        static string CurrentGame()
        {
            if (GameInfo == null) return "null";
            try { return GameInfo() ?? "null"; }
            catch (Exception) { return "null"; }
        }

        /// <summary>回复 Dev Server 的命令（id &lt; 0 时忽略）</summary>
        public void Reply(int id, bool ok, string dataJson, string error)
        {
            if (id < 0) return;
            var sb = new StringBuilder("{\"type\":\"result\",\"id\":");
            sb.Append(id).Append(",\"ok\":").Append(Json.Bool(ok));
            if (ok) sb.Append(",\"data\":").Append(string.IsNullOrEmpty(dataJson) ? "null" : dataJson);
            else sb.Append(",\"error\":").Append(Json.Quote(error ?? "unknown error"));
            sb.Append('}');
            Enqueue(sb.ToString());
        }

        // ---------------- 主线程处理 ----------------

        void Update()
        {
            if (busy && AutoReconnect)
            {
                AutoReconnect = false;
                reconnectAt = -1;
                Debug.LogWarning("[pot] " + LastError);
            }
            if (state == ConnectionState.Disconnected && AutoReconnect && !string.IsNullOrEmpty(Url))
            {
                if (reconnectAt < 0) reconnectAt = Time.realtimeSinceStartup + 2f;
                else if (Time.realtimeSinceStartup >= reconnectAt)
                {
                    reconnectAt = -1;
                    StartConnect();
                }
            }
            string raw;
            var budget = 64;
            while (budget-- > 0 && inbox.TryDequeue(out raw)) Dispatch(raw);
        }

        void Dispatch(string raw)
        {
            Command cmd;
            try
            {
                cmd = JsonUtility.FromJson<Command>(raw);
            }
            catch (Exception e)
            {
                Debug.LogWarning("[pot] 无法解析 Dev Server 消息：" + e.Message);
                return;
            }
            if (cmd == null || string.IsNullOrEmpty(cmd.type)) return;
            Commands++;
            try
            {
                switch (cmd.type)
                {
                    case "open":
                    case "home":
                    case "restart":
                    case "cold":
                        if (ShellHandler != null && ShellHandler(cmd.type == "cold" ? "restart" : cmd.type, raw, cmd.id)) break;
                        if (cmd.type == "restart" || cmd.type == "cold")
                        {
                            ReplyOnBoot(cmd.id, "restart");
                            PotRuntime.Ensure().Restart(!cmd.reset);
                        }
                        else Reply(cmd.id, false, null, "当前 Runner 不支持 " + cmd.type);
                        break;
                    case "screenshot": StartCoroutine(Screenshot(cmd.id, cmd.width)); break;
                    case "input": HandleInput(cmd); break;
                    default: ForwardToJs(cmd, raw); break;
                }
            }
            catch (Exception e)
            {
                Reply(cmd.id, false, null, e.ToString());
            }
        }

        /// <summary>下一次启动完成时回复该命令（调用方随后自行 Boot / Restart）</summary>
        public void ReplyOnBoot(int id, string kind)
        {
            if (pendingBootId >= 0) Reply(pendingBootId, false, null, "被新的 " + kind + " 请求取代");
            pendingBootId = id;
            pendingBootKind = kind;
        }

        /// <summary>取消等待中的启动回复，以错误回复（如打开失败、没有启动）</summary>
        public void FailBootReply(string error)
        {
            if (pendingBootId < 0) return;
            var id = pendingBootId;
            pendingBootId = -1;
            Reply(id, false, null, error);
        }

        void OnBooted(bool ok, string error)
        {
            if (pendingBootId < 0) return;
            var id = pendingBootId;
            pendingBootId = -1;
            if (ok) Reply(id, true, "{\"mode\":" + Json.Quote(pendingBootKind) + ",\"game\":" + CurrentGame() + "}", null);
            else Reply(id, false, null, error);
        }

        void HandleInput(Command cmd)
        {
            switch (cmd.action)
            {
                case "axis":
                    PotInput.SetAxis(cmd.name ?? "move", cmd.x, cmd.y, cmd.frames);
                    break;
                case "key":
                    if (string.IsNullOrEmpty(cmd.name)) throw new Exception("input key 需要 name");
                    PotInput.InjectKey(cmd.name, string.IsNullOrEmpty(cmd.mode) ? "tap" : cmd.mode);
                    break;
                case "clear":
                case null:
                case "":
                    PotInput.ClearVirtual();
                    break;
                default:
                    throw new Exception("未知 input 操作：" + cmd.action);
            }
            Reply(cmd.id, true, "{}", null);
        }

        void ForwardToJs(Command cmd, string raw)
        {
            var runtime = PotRuntime.Instance;
            if (runtime == null || runtime.Env == null || runtime.Status != PotRuntime.RuntimeStatus.Running)
            {
                var why = runtime == null ? "未加载" : runtime.Status + (runtime.LastError != null ? "：" + runtime.LastError : "");
                Reply(cmd.id, false, null, "游戏未运行（" + why + "）");
                return;
            }
            pendingJs = raw;
            // 回复由 JS 通过 host.send → PotHost.Send → SendHook 发出
            runtime.Env.Eval("pot.devtools.handle(CS.Pot.Dev.PotDevClient.TakePending())", "pot/devtools-handle");
        }

        IEnumerator Screenshot(int id, int width)
        {
            yield return new WaitForEndOfFrame();
            Texture2D full = null;
            Texture2D small = null;
            RenderTexture rt = null;
            try
            {
                if (SystemInfo.graphicsDeviceType == UnityEngine.Rendering.GraphicsDeviceType.Null)
                    throw new Exception("当前没有图形设备（-nographics），无法截图");
                full = ScreenCapture.CaptureScreenshotAsTexture();
                var output = full;
                if (width > 0 && width < full.width)
                {
                    var height = Mathf.Max(1, Mathf.RoundToInt(full.height * (width / (float)full.width)));
                    rt = RenderTexture.GetTemporary(width, height, 0);
                    Graphics.Blit(full, rt);
                    var prev = RenderTexture.active;
                    RenderTexture.active = rt;
                    small = new Texture2D(width, height, TextureFormat.RGB24, false);
                    small.ReadPixels(new Rect(0, 0, width, height), 0, 0);
                    small.Apply();
                    RenderTexture.active = prev;
                    output = small;
                }
                var png = output.EncodeToPNG();
                Reply(id, true, "{\"png\":\"" + Convert.ToBase64String(png) + "\",\"width\":" + output.width + ",\"height\":" + output.height + "}", null);
            }
            catch (Exception e)
            {
                Reply(id, false, null, e.Message);
            }
            finally
            {
                if (rt != null) RenderTexture.ReleaseTemporary(rt);
                if (full != null) Destroy(full);
                if (small != null) Destroy(small);
            }
        }
    }
}
