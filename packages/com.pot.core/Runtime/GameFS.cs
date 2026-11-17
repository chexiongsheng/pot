using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.Scripting;

namespace Pot
{
    /// <summary>
    /// 游戏文件系统。读取顺序：内存覆盖层（Dev Server 推送）→ 磁盘目录（-potGame=）→ Resources/pot-game/。
    /// 路径为游戏相对路径，如 manifest.json、units/player.cjs、bundle.cjs、data/coins.json。
    /// </summary>
    [Preserve]
    public static class GameFS
    {
        static readonly Dictionary<string, string> overlay = new Dictionary<string, string>();

        /// <summary>磁盘上的游戏目录（发布构建产物目录）；为空则不读磁盘</summary>
        public static string Root;

        /// <summary>是否回退到 Resources/pot-game（发布包）</summary>
        public static bool UseResources = true;

        public const string ResourcesPrefix = "pot-game/";

        static string Normalize(string path)
        {
            return path.Replace('\\', '/').TrimStart('/');
        }

        [Preserve]
        public static string ReadText(string path)
        {
            path = Normalize(path);
            string text;
            if (overlay.TryGetValue(path, out text)) return text;
            if (!string.IsNullOrEmpty(Root))
            {
                var full = Path.Combine(Root, path);
                if (File.Exists(full)) return File.ReadAllText(full);
            }
            if (UseResources)
            {
                var ext = Path.GetExtension(path);
                var resPath = ResourcesPrefix + (ext.Length > 0 ? path.Substring(0, path.Length - ext.Length) : path);
                var asset = Resources.Load<TextAsset>(resPath);
                if (asset != null) return asset.text;
            }
            return null;
        }

        /// <summary>写入覆盖层；content 为 null 表示删除（之后回退到磁盘/Resources）</summary>
        [Preserve]
        public static void WriteText(string path, string content)
        {
            path = Normalize(path);
            if (content == null) overlay.Remove(path);
            else overlay[path] = content;
        }

        public static void Clear()
        {
            overlay.Clear();
        }

        public static int OverlayCount
        {
            get { return overlay.Count; }
        }
    }
}
