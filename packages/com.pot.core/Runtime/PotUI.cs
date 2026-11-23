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
    ///   g x y w h radius vertical stops                线性渐变；vertical 1 为从上到下、0 为从左到右；stops 为 color@pos 以 ; 分隔（pos 0..1 递增）
    ///   t x y w h color size align flags text          文字；align 0..8 对应 左上/中上/右上/左中/居中/右中/左下/中下/右下；flags 1 粗体 2 阴影 4 换行 8 等宽，位 4..7 为字重/100（0 表示按粗体位取 400/700）
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
        public static void Measure(string text, int size, int flags)
        {
            var style = Style(size, 0, flags & ~6);
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

        /// <summary>flags 中的字重：位 4..7 为 字重/100（1..9）；为 0 时看位 0（粗体 700，否则 400）</summary>
        internal static int Weight(int flags)
        {
            var w = (flags >> 4) & 15;
            return w > 0 ? Mathf.Min(w, 9) * 100 : (flags & 1) != 0 ? 700 : 400;
        }

        static GUIStyle Style(int size, int align, int flags)
        {
            var key = (size << 12) | (align << 8) | (flags & 255);
            GUIStyle style;
            if (styles.TryGetValue(key, out style)) return style;
            style = new GUIStyle();
            Font f;
            FontStyle fs;
            try
            {
                f = PotFonts.ForWeight(Weight(flags), (flags & 8) != 0, 16, out fs);
            }
            catch (Exception)
            {
                f = null;
                fs = Weight(flags) >= 600 ? FontStyle.Bold : FontStyle.Normal;
            }
            if (f != null) style.font = f;
            style.fontSize = Mathf.Max(1, size);
            style.fontStyle = fs;
            style.alignment = (TextAnchor)Mathf.Clamp(align, 0, 8);
            style.wordWrap = (flags & 4) != 0;
            style.clipping = TextClipping.Overflow;
            style.richText = false;
            if (f != null) style.contentOffset = new Vector2(0, GlyphOffset(f, style.fontSize, style.fontStyle, Mathf.Clamp(align, 0, 8) / 3));
            styles[key] = style;
            return style;
        }

        /// <summary>参考行高（em）：微软雅黑的行高。游戏布局按它调好，其他字体向它看齐</summary>
        const float RefLineHeight = 1.32f;

        /// <summary>
        /// 不同字体的 ascent / 行高差别很大（思源、Noto 的行框比雅黑高，字形偏上），IMGUI 按字体度量摆放，
        /// 换字体后同一布局会上下错位。这里用参考汉字“国”的实际包围盒，把字形中心放到“参考行高的行框”中心：
        /// row 0 顶对齐、1 居中、2 底对齐时，参考行框分别贴着真实行框的顶、中、底。这样布局与字体无关。
        /// </summary>
        static float GlyphOffset(Font f, int size, FontStyle fs, int row)
        {
            try
            {
                f.RequestCharactersInTexture("国", size, fs);
                CharacterInfo ci;
                if (!f.GetCharacterInfo('国', out ci, size, fs) || ci.maxY <= ci.minY) return 0;
                var scale = f.fontSize > 0 ? (float)size / f.fontSize : 1f;
                var ascent = f.ascent * scale;
                var lineH = f.lineHeight * scale;
                if (ascent <= 0 || lineH <= 0) return 0;
                var refH = RefLineHeight * size;
                // 参考行框中心相对真实行框顶部的位置
                var target = row == 0 ? refH * 0.5f : row == 1 ? lineH * 0.5f : lineH - refH * 0.5f;
                var center = ascent - (ci.minY + ci.maxY) * 0.5f;
                return Mathf.Clamp(target - center, -0.5f * size, 0.5f * size);
            }
            catch (Exception)
            {
                return 0;
            }
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

        const int GradientRes = 256;
        static readonly Dictionary<string, Texture2D> gradients = new Dictionary<string, Texture2D>();

        /// <summary>
        /// 渐变贴图：沿渐变方向 256 像素、sRGB、双线性 + 钳位，按 (方向, 色标) 缓存。
        /// 色标间按预乘 alpha 插值（同 CSS），存回非预乘；同位置的两个色标形成硬分界。
        /// </summary>
        static Texture2D Gradient(bool vertical, string spec)
        {
            var key = (vertical ? "v" : "h") + spec;
            Texture2D tex;
            if (gradients.TryGetValue(key, out tex) && tex != null) return tex;
            var parts = spec.Split(';');
            var cols = new Color[parts.Length];
            var pos = new float[parts.Length];
            for (var i = 0; i < parts.Length; i++)
            {
                var at = parts[i].LastIndexOf('@');
                cols[i] = C(at >= 0 ? parts[i].Substring(0, at) : parts[i]);
                pos[i] = at >= 0 ? F(parts[i].Substring(at + 1)) : (parts.Length > 1 ? (float)i / (parts.Length - 1) : 0);
                if (i > 0 && pos[i] < pos[i - 1]) pos[i] = pos[i - 1];
            }
            var px = new Color32[GradientRes];
            for (var i = 0; i < GradientRes; i++)
            {
                var t = (i + 0.5f) / GradientRes;
                Color c;
                if (t <= pos[0]) c = cols[0];
                else if (t >= pos[pos.Length - 1]) c = cols[cols.Length - 1];
                else
                {
                    var k = 1;
                    while (k < pos.Length - 1 && pos[k] <= t) k++;
                    Color a = cols[k - 1], b = cols[k];
                    var span = pos[k] - pos[k - 1];
                    var u = span > 1e-6f ? (t - pos[k - 1]) / span : 1f;
                    var alpha = Mathf.Lerp(a.a, b.a, u);
                    var r = Mathf.Lerp(a.r * a.a, b.r * b.a, u);
                    var g = Mathf.Lerp(a.g * a.a, b.g * b.a, u);
                    var bl = Mathf.Lerp(a.b * a.a, b.b * b.a, u);
                    // 全透明处取两端颜色的插值，避免双线性过滤时把黑色带进相邻像素
                    c = alpha > 1e-4f ? new Color(r / alpha, g / alpha, bl / alpha, alpha) : new Color(Mathf.Lerp(a.r, b.r, u), Mathf.Lerp(a.g, b.g, u), Mathf.Lerp(a.b, b.b, u), 0);
                }
                px[i] = c;
            }
            tex = new Texture2D(vertical ? 1 : GradientRes, vertical ? GradientRes : 1, TextureFormat.RGBA32, false, false)
            {
                wrapMode = TextureWrapMode.Clamp,
                filterMode = FilterMode.Bilinear,
                hideFlags = HideFlags.HideAndDontSave,
                name = "PotUI.Gradient",
            };
            if (vertical)
            {
                // 贴图 v=0 在底部，IMGUI 把 v=1 画在矩形顶部：反向写入，让 pos 0 对应顶边
                var flipped = new Color32[GradientRes];
                for (var i = 0; i < GradientRes; i++) flipped[i] = px[GradientRes - 1 - i];
                px = flipped;
            }
            tex.SetPixels32(px);
            tex.Apply(false, true);
            if (gradients.Count >= 256)
            {
                foreach (var old in gradients.Values) if (old != null) UnityEngine.Object.Destroy(old);
                gradients.Clear();
            }
            gradients[key] = tex;
            return tex;
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
                        case "g":
                            GUI.DrawTexture(new Rect(F(f[1]), F(f[2]), F(f[3]), F(f[4])), Gradient(f[6] == "1", f[7]), ScaleMode.StretchToFill, true, 0, Color.white, 0, F(f[5]));
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
