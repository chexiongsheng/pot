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

        static bool IsMonospace(string families)
        {
            var f = families.ToLowerInvariant();
            return f.StartsWith("monospace") || f.StartsWith("consolas") || f.StartsWith("courier") || f.StartsWith("menlo") || f.StartsWith("cascadia");
        }
    }
}
