using System;
using UnityEngine;
using UnityEngine.Scripting;

namespace Pot
{
    /// <summary>
    /// JS 宿主回调（JS 侧见 runtime/src/unity.ts）。只用字符串、数字、布尔跨语言。
    /// </summary>
    [Preserve]
    public static class PotHost
    {
        /// <summary>JS 日志钩子：devtools 通过它把日志（保留级别）转发给 Dev Server</summary>
        public static Action<string, string> LogHook;

        /// <summary>开发通道发送钩子：devtools 设置后，JS 的 host.send 才有效</summary>
        public static Action<string> SendHook;

        /// <summary>当前线程是否正在输出 JS 日志（devtools 据此避免 Unity 日志回调重复转发）</summary>
        [ThreadStatic] public static bool InJsLog;

        [Preserve]
        public static void Log(string level, string text)
        {
            if (LogHook != null)
            {
                try { LogHook(level, text); } catch (Exception) { }
            }
            InJsLog = true;
            try
            {
                switch (level)
                {
                    case "error": Debug.LogError("[js] " + text); break;
                    case "warn": Debug.LogWarning("[js] " + text); break;
                    default: Debug.Log("[js] " + text); break;
                }
            }
            finally
            {
                InJsLog = false;
            }
        }

        /// <summary>请求 GC：在本帧 JS 调用结束后执行（不在 JS 调用栈内触发）</summary>
        [Preserve]
        public static void RequestGC()
        {
            PotRuntime.gcRequested = true;
        }

        [Preserve]
        public static void Send(string message)
        {
            if (SendHook != null) SendHook(message);
        }

        [Preserve]
        public static void OnBooted(bool ok, string error)
        {
            var runtime = PotRuntime.Instance;
            if (runtime != null) runtime.HandleBooted(ok, error);
        }
    }
}
