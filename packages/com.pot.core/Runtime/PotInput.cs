using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Scripting;

namespace Pot
{
    /// <summary>
    /// 输入桥。支持虚拟输入注入（Dev Server / AI 测试用），虚拟输入优先于真实输入。
    /// 轴：move（WASD/方向键）、look（鼠标）。键名：KeyCode 名（不区分大小写，如 space、w、mouse0）。
    /// </summary>
    [Preserve]
    public static class PotInput
    {
        [Preserve] public static float ax, ay;

        struct VirtualAxis
        {
            public float x, y;
            public int frames; // 0 表示一直保持到 clear
        }

        static readonly Dictionary<string, VirtualAxis> axes = new Dictionary<string, VirtualAxis>();
        static readonly HashSet<string> held = new HashSet<string>();
        static readonly HashSet<string> down = new HashSet<string>();
        static readonly HashSet<string> up = new HashSet<string>();
        static readonly List<string> tapRelease = new List<string>();
        static readonly Dictionary<string, KeyCode> keyCodes = new Dictionary<string, KeyCode>();

        [Preserve]
        public static void Axis(string name)
        {
            VirtualAxis v;
            if (axes.TryGetValue(name, out v))
            {
                ax = v.x; ay = v.y;
                return;
            }
            ax = 0; ay = 0;
            try
            {
                switch (name)
                {
                    case "move":
                        if (Input.GetKey(KeyCode.A) || Input.GetKey(KeyCode.LeftArrow)) ax -= 1;
                        if (Input.GetKey(KeyCode.D) || Input.GetKey(KeyCode.RightArrow)) ax += 1;
                        if (Input.GetKey(KeyCode.S) || Input.GetKey(KeyCode.DownArrow)) ay -= 1;
                        if (Input.GetKey(KeyCode.W) || Input.GetKey(KeyCode.UpArrow)) ay += 1;
                        TouchMove();
                        break;
                    case "look":
                        ax = Input.GetAxis("Mouse X");
                        ay = Input.GetAxis("Mouse Y");
                        break;
                }
            }
            catch (Exception) { }
        }

        static readonly Dictionary<int, Vector2> touchStart = new Dictionary<int, Vector2>();

        /// <summary>移动端：屏幕左半边触摸作为虚拟摇杆（以按下点为中心，拖动 80px 为满量程）</summary>
        static void TouchMove()
        {
            for (var i = 0; i < Input.touchCount; i++)
            {
                var t = Input.GetTouch(i);
                if (t.phase == TouchPhase.Began)
                {
                    if (t.position.x <= Screen.width * 0.5f) touchStart[t.fingerId] = t.position;
                    continue;
                }
                if (t.phase == TouchPhase.Ended || t.phase == TouchPhase.Canceled)
                {
                    touchStart.Remove(t.fingerId);
                    continue;
                }
                Vector2 start;
                if (!touchStart.TryGetValue(t.fingerId, out start)) continue;
                var d = Vector2.ClampMagnitude((t.position - start) / 80f, 1f);
                ax = d.x;
                ay = d.y;
            }
        }

        static bool TryKeyCode(string name, out KeyCode code)
        {
            if (keyCodes.TryGetValue(name, out code)) return true;
            var ok = Enum.TryParse(name, true, out code);
            if (!ok && name.Length == 1 && char.IsDigit(name[0])) ok = Enum.TryParse("Alpha" + name, out code);
            if (ok) keyCodes[name] = code;
            return ok;
        }

        /// <summary>mode: 0 按住，1 本帧按下，2 本帧抬起</summary>
        [Preserve]
        public static bool Key(string name, int mode)
        {
            name = name.ToLowerInvariant();
            if (mode == 0 && held.Contains(name)) return true;
            if (mode == 1 && down.Contains(name)) return true;
            if (mode == 2 && up.Contains(name)) return true;
            KeyCode code;
            if (!TryKeyCode(name, out code)) return false;
            try
            {
                return mode == 1 ? Input.GetKeyDown(code) : mode == 2 ? Input.GetKeyUp(code) : Input.GetKey(code);
            }
            catch (Exception)
            {
                return false;
            }
        }

        // ---- 虚拟输入注入 ----

        public static void SetAxis(string name, float x, float y, int frames)
        {
            axes[name] = new VirtualAxis { x = x, y = y, frames = Math.Max(0, frames) };
        }

        /// <summary>mode: down / up / tap（按下一帧后抬起）</summary>
        public static void InjectKey(string name, string mode)
        {
            name = name.ToLowerInvariant();
            switch (mode)
            {
                case "down":
                    if (held.Add(name)) down.Add(name);
                    break;
                case "up":
                    if (held.Remove(name)) up.Add(name);
                    break;
                default:
                    held.Add(name);
                    down.Add(name);
                    tapRelease.Add(name);
                    break;
            }
        }

        public static void ClearVirtual()
        {
            axes.Clear();
            held.Clear();
            down.Clear();
            up.Clear();
            tapRelease.Clear();
        }

        /// <summary>每帧 JS tick 之后调用：推进虚拟输入的帧状态</summary>
        public static void EndFrame()
        {
            down.Clear();
            up.Clear();
            if (tapRelease.Count > 0)
            {
                foreach (var name in tapRelease)
                {
                    held.Remove(name);
                    up.Add(name);
                }
                tapRelease.Clear();
            }
            if (axes.Count > 0)
            {
                List<string> expired = null;
                var keys = new List<string>(axes.Keys);
                foreach (var key in keys)
                {
                    var v = axes[key];
                    if (v.frames <= 0) continue;
                    v.frames--;
                    if (v.frames == 0)
                    {
                        if (expired == null) expired = new List<string>();
                        expired.Add(key);
                    }
                    else axes[key] = v;
                }
                if (expired != null) foreach (var key in expired) axes.Remove(key);
            }
        }
    }
}
