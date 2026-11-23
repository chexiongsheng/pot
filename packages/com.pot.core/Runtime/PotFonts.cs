using System;
using UnityEngine;

namespace Pot
{
    /// <summary>
    /// 文字用的字体。发布包带内置字体（pot release 按游戏用到的字符从 Noto Sans SC / 思源黑体裁出的子集，
    /// 导入为 Resources/pot-font），有就优先用它，各平台显示一致；WebGL 拿不到系统字体，只能靠它显示中文。
    /// 内置字体缺字时回退到系统字体（导入时设置的 fontNames）。开发期 Runner 不带内置字体，用系统字体。
    /// </summary>
    public static class PotFonts
    {
        static Font bundled;
        static bool looked;

        static readonly string[] SystemCjk = { "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "Source Han Sans SC", "SimHei", "Arial" };

        /// <summary>发布包的内置字体；没有时为 null</summary>
        public static Font Bundled
        {
            get
            {
                if (!looked)
                {
                    looked = true;
                    bundled = Resources.Load<Font>("pot-font");
                    if (bundled != null) Debug.Log("[pot] 使用内置字体 " + bundled.name + "（fontSize " + bundled.fontSize + "，ascent " + bundled.ascent + "，lineHeight " + bundled.lineHeight + "）");
                    else if (Application.platform == RuntimePlatform.WebGLPlayer)
                        Debug.LogWarning("[pot] 发布包没有内置字体，WebGL 上中文无法显示（pot release 时找不到 Noto Sans SC / 思源黑体，见打包输出）");
                }
                return bundled;
            }
        }

        /// <summary>界面、文字贴图的默认字体</summary>
        public static Font Default(int size)
        {
            var b = Bundled;
            if (b != null) return b;
            try
            {
                return Font.CreateDynamicFontFromOSFont(SystemCjk, size);
            }
            catch (Exception)
            {
                return null;
            }
        }

        /// <summary>
        /// Canvas 2D 按 CSS font-family 取字体（逗号分隔）。有内置字体时，除等宽字体外都用内置字体
        /// （WebGL 上等宽也用内置字体，系统字体不可用）
        /// </summary>
        public static Font ForFamilies(string families, int size)
        {
            var b = Bundled;
            if (b != null && (Application.platform == RuntimePlatform.WebGLPlayer || !IsMonospace(families))) return b;
            return Font.CreateDynamicFontFromOSFont(families.Split(','), size);
        }

        static readonly string[] SystemMono = { "Cascadia Mono", "Consolas", "Menlo", "SF Mono", "DejaVu Sans Mono", "Courier New" };

        /// <summary>
        /// 各字族的字面表：“字重:字面名”，字面名为空表示字族本身（700 为空时表示字族自带的粗体，用 FontStyle.Bold 取）。
        /// Windows 把细体、中黑、特粗等非 RIBBI 字面注册成独立字族名（如 “Microsoft YaHei UI Light”），按名字取。
        /// 不在表里的字族只有 400 一档。
        /// </summary>
        static readonly string[][] FaceTable =
        {
            new[] { "Microsoft YaHei UI", "300:Microsoft YaHei UI Light", "400:", "700:" },
            new[] { "Microsoft YaHei", "300:Microsoft YaHei Light", "400:", "700:" },
            new[] { "PingFang SC", "100:PingFang SC Ultralight", "200:PingFang SC Thin", "300:PingFang SC Light", "400:", "500:PingFang SC Medium", "600:PingFang SC Semibold" },
            new[] { "Noto Sans CJK SC", "100:Noto Sans CJK SC Thin", "300:Noto Sans CJK SC Light", "400:", "500:Noto Sans CJK SC Medium", "700:", "900:Noto Sans CJK SC Black" },
            new[] { "Source Han Sans SC", "200:Source Han Sans SC ExtraLight", "300:Source Han Sans SC Light", "400:", "500:Source Han Sans SC Medium", "700:", "900:Source Han Sans SC Heavy" },
            new[] { "Noto Sans SC", "100:Noto Sans SC Thin", "300:Noto Sans SC Light", "400:", "500:Noto Sans SC Medium", "700:", "900:Noto Sans SC Black" },
            new[] { "Cascadia Mono", "200:Cascadia Mono ExtraLight", "300:Cascadia Mono Light", "400:", "600:Cascadia Mono SemiBold", "700:" },
            new[] { "Consolas", "400:", "700:" },
            new[] { "Menlo", "400:", "700:" },
            new[] { "Courier New", "400:", "700:" },
            new[] { "SimHei", "400:" },
        };

        static System.Collections.Generic.HashSet<string> installed;
        static readonly System.Collections.Generic.Dictionary<string, Font> faceFonts = new System.Collections.Generic.Dictionary<string, Font>();

        static bool Installed(string name)
        {
            if (installed == null)
            {
                installed = new System.Collections.Generic.HashSet<string>(StringComparer.OrdinalIgnoreCase);
                try
                {
                    foreach (var n in Font.GetOSInstalledFontNames()) installed.Add(n);
                }
                catch (Exception)
                {
                    // 拿不到字体列表时按“只有字族本身”处理
                }
            }
            return installed.Contains(name);
        }

        static string FirstInstalled(string[] names)
        {
            foreach (var n in names) if (Installed(n)) return n;
            return null;
        }

        /// <summary>
        /// CSS 字重匹配（CSS Fonts 4 §5.2）：目标在 400–500 时先向上找到 500，再向下，再找 500 以上；
        /// 小于 400 先向下再向上；大于 500 先向上再向下。返回 weights 中选中的下标
        /// </summary>
        public static int MatchWeight(int[] weights, int desired)
        {
            int best = -1;
            Func<int, int, bool> better;
            if (desired >= 400 && desired <= 500)
                better = (a, b) => Rank45(a, desired) < Rank45(b, desired);
            else if (desired < 400)
                better = (a, b) => RankDown(a, desired) < RankDown(b, desired);
            else
                better = (a, b) => RankUp(a, desired) < RankUp(b, desired);
            for (var i = 0; i < weights.Length; i++)
                if (best < 0 || better(weights[i], weights[best])) best = i;
            return best;
        }

        // 排名越小越优先
        static int Rank45(int w, int d) => w >= d && w <= 500 ? w - d : w < d ? 1000 + (d - w) : 2000 + (w - 500);
        static int RankDown(int w, int d) => w <= d ? d - w : 1000 + (w - d);
        static int RankUp(int w, int d) => w >= d ? w - d : 1000 + (d - w);

        /// <summary>
        /// 按 CSS 规则取某个字重（100–900）的字体与 FontStyle。界面文字用：默认字族为 SystemCjk 中第一个装了的，
        /// mono 时为 SystemMono 中第一个装了的（缺字回退到中文字体）。选中字面不足 600 而目标 ≥ 600 时合成粗体（同浏览器）。
        /// 有内置字体时（等宽且非 WebGL 除外）只有一个字面：≥ 600 用合成粗体。
        /// </summary>
        public static Font ForWeight(int weight, bool mono, int size, out FontStyle style)
        {
            weight = Mathf.Clamp(weight, 1, 1000);
            var b = Bundled;
            if (b != null && (!mono || Application.platform == RuntimePlatform.WebGLPlayer))
            {
                style = weight >= 600 ? FontStyle.Bold : FontStyle.Normal;
                return b;
            }
            var family = FirstInstalled(mono ? SystemMono : SystemCjk);
            if (family == null)
            {
                style = weight >= 600 ? FontStyle.Bold : FontStyle.Normal;
                if (mono) return ForFamilies("monospace," + string.Join(",", SystemCjk), size);
                return Default(size);
            }
            string[] row = null;
            foreach (var r in FaceTable) if (string.Equals(r[0], family, StringComparison.OrdinalIgnoreCase)) row = r;
            var weights = new System.Collections.Generic.List<int>();
            var names = new System.Collections.Generic.List<string>();
            if (row == null)
            {
                weights.Add(400);
                names.Add("");
            }
            else
            {
                for (var i = 1; i < row.Length; i++)
                {
                    var colon = row[i].IndexOf(':');
                    var name = row[i].Substring(colon + 1);
                    if (name.Length > 0 && !Installed(name)) continue;
                    weights.Add(int.Parse(row[i].Substring(0, colon)));
                    names.Add(name);
                }
            }
            var k = MatchWeight(weights.ToArray(), weight);
            var face = names[k].Length > 0 ? names[k] : family;
            // 字族自带的粗体用 Bold 取；字面本身不够粗而目标 ≥ 600 时也用 Bold（合成）
            style = names[k].Length == 0 && weights[k] >= 600 || weight >= 600 && weights[k] < 600 ? FontStyle.Bold : FontStyle.Normal;
            var key = face + (mono ? "|m" : "");
            Font f;
            if (faceFonts.TryGetValue(key, out f) && f != null) return f;
            var chain = new System.Collections.Generic.List<string> { face };
            if (face != family) chain.Add(family);
            foreach (var n in SystemCjk) if (!chain.Contains(n)) chain.Add(n);
            try
            {
                f = Font.CreateDynamicFontFromOSFont(chain.ToArray(), size);
            }
            catch (Exception)
            {
                f = Default(size);
            }
            faceFonts[key] = f;
            return f;
        }

        static bool IsMonospace(string families)
        {
            var f = families.ToLowerInvariant();
            return f.StartsWith("monospace") || f.StartsWith("consolas") || f.StartsWith("courier") || f.StartsWith("menlo") || f.StartsWith("cascadia");
        }
    }
}
