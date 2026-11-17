using System;
using System.Collections.Generic;
using System.Globalization;
using UnityEngine;
using UnityEngine.Scripting;

namespace Pot
{
    /// <summary>
    /// 即时模式 2D 绘制：JS 每帧提交一份命令列表（Submit），这里在 OnGUI 中按顺序绘制。
    /// 坐标为屏幕像素，左上角为原点。点击检测由 JS 用 PotInput.Mouse + mouse0 自己做。
    ///
    /// 命令以 \u001e 分隔，字段以 \u001f 分隔，颜色为 8 位十六进制 rrggbbaa：
    ///   r x y w h color radius                         填充矩形
    ///   b x y w h color thickness radius               描边矩形
    ///   l x1 y1 x2 y2 color width                      线段
    ///   a cx cy radius color thickness start sweep     圆弧（角度制，0 度朝上，顺时针）
    ///   t x y w h color size align flags text          文字；align 0..8 对应 左上/中上/右上/左中/居中/右中/左下/中下/右下；flags 1 粗体 2 阴影 4 换行
    /// </summary>
    [Preserve]
    public static class PotUI
    {
        const char RecordSep = '\u001e';
        const char FieldSep = '\u001f';

        static string commands = "";
        static string[] parsed = new string[0];
        static bool dirty;
        static readonly Dictionary<string, Color> colors = new Dictionary<string, Color>();
        static readonly Dictionary<int, GUIStyle> styles = new Dictionary<int, GUIStyle>();
        static Font font;

        /// <summary>提交本帧的绘制命令（覆盖上一帧）</summary>
        [Preserve]
        public static void Submit(string list)
        {
            commands = list ?? "";
            dirty = true;
        }

        /// <summary>估算文字宽度（像素），JS 用于排版；结果写入 PotUI.tw</summary>
        [Preserve] public static float tw, th;

        [Preserve]
        public static void Measure(string text, int size, bool bold)
        {
            var style = Style(size, 0, bold ? 1 : 0);
            var s = style.CalcSize(new GUIContent(text ?? ""));
            tw = s.x;
            th = s.y;
        }

        public static void Clear()
        {
            commands = "";
            parsed = new string[0];
            dirty = false;
        }

        static Font UIFont
        {
            get
            {
                if (font == null)
                {
                    try
                    {
                        font = Font.CreateDynamicFontFromOSFont(new[] { "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "Source Han Sans SC", "Arial" }, 16);
                    }
                    catch (Exception)
                    {
                        font = null;
                    }
                }
                return font;
            }
        }

        static GUIStyle Style(int size, int align, int flags)
        {
            var key = (size << 8) | (align << 4) | (flags & 15);
            GUIStyle style;
            if (styles.TryGetValue(key, out style)) return style;
            style = new GUIStyle();
            var f = UIFont;
            if (f != null) style.font = f;
            style.fontSize = Mathf.Max(1, size);
            style.fontStyle = (flags & 1) != 0 ? FontStyle.Bold : FontStyle.Normal;
            style.alignment = (TextAnchor)Mathf.Clamp(align, 0, 8);
            style.wordWrap = (flags & 4) != 0;
            style.clipping = TextClipping.Overflow;
            style.richText = false;
            styles[key] = style;
            return style;
        }

        static float F(string s)
        {
            float v;
            return float.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out v) ? v : 0;
        }

        static Color C(string s)
        {
            Color c;
            if (colors.TryGetValue(s, out c)) return c;
            uint n;
            if (!uint.TryParse(s, NumberStyles.HexNumber, CultureInfo.InvariantCulture, out n)) n = 0xffffffff;
            if (s.Length == 6) n = (n << 8) | 0xff;
            c = new Color((n >> 24 & 255) / 255f, (n >> 16 & 255) / 255f, (n >> 8 & 255) / 255f, (n & 255) / 255f);
            if (colors.Count > 4096) colors.Clear();
            colors[s] = c;
            return c;
        }

        static void Line(Vector2 a, Vector2 b, Color color, float width)
        {
            var d = b - a;
            var len = d.magnitude;
            if (len < 0.01f) return;
            var angle = Mathf.Atan2(d.y, d.x) * Mathf.Rad2Deg;
            var matrix = GUI.matrix;
            GUIUtility.RotateAroundPivot(angle, a);
            GUI.DrawTexture(new Rect(a.x, a.y - width / 2, len, width), Texture2D.whiteTexture, ScaleMode.StretchToFill, true, 0, color, 0, 0);
            GUI.matrix = matrix;
        }

        /// <summary>由 PotUIDrawer.OnGUI 调用</summary>
        internal static void Draw()
        {
            if (Event.current.type != EventType.Repaint) return;
            if (dirty)
            {
                parsed = commands.Length == 0 ? new string[0] : commands.Split(RecordSep);
                dirty = false;
            }
            var white = Texture2D.whiteTexture;
            var content = new GUIContent();
            for (var i = 0; i < parsed.Length; i++)
            {
                var record = parsed[i];
                if (record.Length < 2) continue;
                var f = record.Split(FieldSep);
                try
                {
                    switch (f[0])
                    {
                        case "r":
                            GUI.DrawTexture(new Rect(F(f[1]), F(f[2]), F(f[3]), F(f[4])), white, ScaleMode.StretchToFill, true, 0, C(f[5]), 0, F(f[6]));
                            break;
                        case "b":
                            GUI.DrawTexture(new Rect(F(f[1]), F(f[2]), F(f[3]), F(f[4])), white, ScaleMode.StretchToFill, true, 0, C(f[5]), F(f[6]), F(f[7]));
                            break;
                        case "l":
                            Line(new Vector2(F(f[1]), F(f[2])), new Vector2(F(f[3]), F(f[4])), C(f[5]), F(f[6]));
                            break;
                        case "a":
                        {
                            float cx = F(f[1]), cy = F(f[2]), r = F(f[3]), thick = F(f[5]), start = F(f[6]), sweep = F(f[7]);
                            var color = C(f[4]);
                            var segments = Mathf.Clamp(Mathf.CeilToInt(Mathf.Abs(sweep) / 6f), 1, 120);
                            var prev = Vector2.zero;
                            for (var s = 0; s <= segments; s++)
                            {
                                var deg = start + sweep * s / segments;
                                var rad = deg * Mathf.Deg2Rad;
                                var p = new Vector2(cx + Mathf.Sin(rad) * r, cy - Mathf.Cos(rad) * r);
                                if (s > 0) Line(prev, p, color, thick);
                                prev = p;
                            }
                            break;
                        }
                        case "t":
                        {
                            var rect = new Rect(F(f[1]), F(f[2]), F(f[3]), F(f[4]));
                            var flags = (int)F(f[8]);
                            var style = Style((int)F(f[6]), (int)F(f[7]), flags);
                            content.text = f.Length > 9 ? f[9] : "";
                            var color = C(f[5]);
                            if ((flags & 2) != 0)
                            {
                                style.normal.textColor = new Color(0, 0, 0, color.a * 0.75f);
                                style.Draw(new Rect(rect.x + 1, rect.y + 1, rect.width, rect.height), content, false, false, false, false);
                            }
                            style.normal.textColor = color;
                            style.Draw(rect, content, false, false, false, false);
                            break;
                        }
                    }
                }
                catch (Exception)
                {
                    // 单条命令格式错误不影响其他命令
                }
            }
        }
    }

    /// <summary>挂在 PotRuntime 上的绘制器；GUI.depth 较大，Runner 外壳的界面画在它上面</summary>
    public class PotUIDrawer : MonoBehaviour
    {
        void OnGUI()
        {
            GUI.depth = 10;
            PotUI.Draw();
        }
    }
}
