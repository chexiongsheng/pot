using System;
using Pot.Dev;
using UnityEngine;

namespace Pot.Runner
{
    /// <summary>
    /// Runner 外壳（类似 Expo Go）：启动后连接 Dev Server，由 Dev Server 推送游戏。
    /// 地址来源：命令行 -potServer=ws://host:7788/runner（或 host:port）→ 上次使用的地址 → 默认本机。
    /// F1 或左上角按钮切换面板。
    /// </summary>
    public class PotRunner : MonoBehaviour
    {
        const string PrefKey = "pot.server";
        const string DefaultUrl = "ws://127.0.0.1:7788/runner";

        PotDevClient client;
        string address;
        bool showPanel;
        GUIStyle errorStyle;
        float fps;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void AutoCreate()
        {
            if (FindObjectOfType<PotRunner>() != null || FindObjectOfType<PotBoot>() != null) return;
            new GameObject("PotRunner").AddComponent<PotRunner>();
        }

        public static string Normalize(string input)
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

            string fromArgs = null;
            foreach (var arg in Environment.GetCommandLineArgs())
            {
                if (arg.StartsWith("-potServer=", StringComparison.Ordinal)) fromArgs = arg.Substring("-potServer=".Length);
            }
            address = Normalize(fromArgs ?? PlayerPrefs.GetString(PrefKey, DefaultUrl));
            showPanel = fromArgs == null && !PlayerPrefs.HasKey(PrefKey);
            Connect();
        }

        void Connect()
        {
            address = Normalize(address);
            PlayerPrefs.SetString(PrefKey, address);
            PlayerPrefs.Save();
            Debug.Log("[pot] 连接 Dev Server：" + address);
            client.Connect(address);
        }

        void Update()
        {
            if (Input.GetKeyDown(KeyCode.F1)) showPanel = !showPanel;
            if (Input.touchCount >= 3 && Input.GetTouch(2).phase == TouchPhase.Began) showPanel = !showPanel;
            fps = Mathf.Lerp(fps, 1f / Mathf.Max(0.0001f, Time.unscaledDeltaTime), 0.05f);
        }

        void OnGUI()
        {
            var scale = Mathf.Max(1f, Screen.dpi / 120f);
            GUI.matrix = Matrix4x4.Scale(new Vector3(scale, scale, 1));
            var width = Screen.width / scale;

            var runtime = PotRuntime.Instance;
            var conn = client.State == PotDevClient.ConnectionState.Connected ? "已连接" : client.State == PotDevClient.ConnectionState.Connecting ? "连接中…" : "未连接";
            var status = runtime != null ? runtime.Status.ToString() : "-";
            if (GUI.Button(new Rect(8, 8, 260, 26), "pot  " + conn + "  " + status + "  " + Mathf.RoundToInt(fps) + "fps")) showPanel = !showPanel;

            if (runtime != null && runtime.Status == PotRuntime.RuntimeStatus.Failed && !string.IsNullOrEmpty(runtime.LastError))
            {
                if (errorStyle == null)
                {
                    errorStyle = new GUIStyle(GUI.skin.box) { alignment = TextAnchor.UpperLeft, wordWrap = true, fontSize = 13 };
                    errorStyle.normal.textColor = new Color(1f, 0.55f, 0.55f);
                }
                GUI.Box(new Rect(8, 40, Mathf.Min(width - 16, 720), 220), "启动失败：\n" + runtime.LastError, errorStyle);
            }

            if (!showPanel) return;
            GUILayout.BeginArea(new Rect(8, 270, Mathf.Min(width - 16, 520), 260), GUI.skin.box);
            GUILayout.Label("Dev Server 地址（ws://IP:端口/runner，或 IP:端口）");
            address = GUILayout.TextField(address ?? "");
            GUILayout.BeginHorizontal();
            if (GUILayout.Button("连接", GUILayout.Height(32))) Connect();
            if (GUILayout.Button("断开", GUILayout.Height(32))) client.Disconnect();
            GUILayout.EndHorizontal();
            GUILayout.Label("连接：" + conn + (client.LastError != null ? "（" + client.LastError + "）" : ""));
            GUILayout.Label("游戏：" + status + "  启动次数 " + (runtime != null ? runtime.Boots : 0) + "  收到命令 " + client.Commands);
            GUILayout.BeginHorizontal();
            if (runtime != null && GUILayout.Button("冷重启（保留 state）", GUILayout.Height(28))) runtime.Restart(true);
            if (runtime != null && GUILayout.Button("清空 state 重启", GUILayout.Height(28))) runtime.Restart(false);
            GUILayout.EndHorizontal();
            GUILayout.Label("F1 / 三指触摸 切换本面板");
            GUILayout.EndArea();
        }
    }
}
