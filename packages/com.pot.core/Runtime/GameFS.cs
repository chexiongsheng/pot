using System.IO;
using UnityEngine;
using UnityEngine.Scripting;

namespace Pot
{
    /// <summary>
    /// 游戏文件系统。读取顺序：磁盘目录 Root → Resources/pot-game/（发布包）。
    /// - Runner：Root 指向游戏源码目录（本地目录、.potg 解压目录或 HTTP 镜像目录），UseResources=false。
    /// - 发布包：Root 为空（或 -potGame= 指定的构建产物目录），UseResources=true。
    /// 路径为游戏相对路径，如 manifest.json、src/plugins/player.ts、bundle.cjs、data/coins.json。
    /// </summary>
    [Preserve]
    public static class GameFS
    {
        /// <summary>磁盘上的游戏目录；为空则不读磁盘</summary>
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
if (path.Length == 0 || path == ".." || path.StartsWith("../") || path.Contains("/../")) return null;
            if (!string.IsNullOrEmpty(Root))
            {
                var full = Path.Combine(Root, path);
                if (File.Exists(full))
                {
                    try { return File.ReadAllText(full); }
                    catch (IOException)
                    {
                        // 编辑器保存时文件可能短暂被占用，稍后由变更通知重读
                        return null;
                    }
                }
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
    }
}
