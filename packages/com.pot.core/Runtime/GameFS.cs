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
                // 新格式：pot-game/<完整路径>.bytes（资源名含原扩展名，sea.frag 与 sea.vert 不撞名）
                var asset = Resources.Load<TextAsset>(ResourcesPrefix + path);
                if (asset != null) return asset.text;
                // 旧格式：去掉扩展名（仅 .json/.txt/.cjs 等 Unity 认识的文本类型）
                var ext = Path.GetExtension(path);
                if (ext.Length > 0)
                {
                    asset = Resources.Load<TextAsset>(ResourcesPrefix + path.Substring(0, path.Length - ext.Length));
                    if (asset != null) return asset.text;
                }
            }
            return null;
        }

        // ---- 持久缓存：persistentDataPath/cache/<bucket>/<key>.txt（devtools 转译结果等，可随时删除） ----

        /// <summary>缓存根目录（persistentDataPath/cache）</summary>
        public static string CacheRoot { get { return Path.Combine(Application.persistentDataPath, "cache"); } }

        /// <summary>多久没被读到的缓存条目在本进程第一次写入时清掉</summary>
        const double CacheMaxAgeDays = 14;

        static int cacheHits, cacheReads;
        static readonly System.Collections.Generic.HashSet<string> prunedBuckets = new System.Collections.Generic.HashSet<string>();

        static bool SafeName(string s)
        {
            if (string.IsNullOrEmpty(s) || s.Length > 64) return false;
            foreach (var c in s)
                if (!((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_' || c == '-')) return false;
            return true;
        }

        static string CachePath(string bucket, string key)
        {
            if (!SafeName(bucket) || !SafeName(key)) return null;
            return Path.Combine(CacheRoot, bucket, key + ".txt");
        }

        /// <summary>读缓存；不存在或名字非法返回 null。命中时刷新修改时间（清理按它判断）</summary>
        [Preserve]
        public static string CacheRead(string bucket, string key)
        {
            var path = CachePath(bucket, key);
            if (path == null) return null;
            cacheReads++;
            try
            {
                if (!File.Exists(path)) return null;
                var text = File.ReadAllText(path);
                cacheHits++;
                try { File.SetLastWriteTimeUtc(path, System.DateTime.UtcNow); } catch (IOException) { } catch (System.UnauthorizedAccessException) { }
                return text;
            }
            catch (IOException) { return null; }
            catch (System.UnauthorizedAccessException) { return null; }
        }

        /// <summary>写缓存（先写临时文件再改名，避免读到半截）；失败静默忽略</summary>
        [Preserve]
        public static void CacheWrite(string bucket, string key, string text)
        {
            var path = CachePath(bucket, key);
            if (path == null || text == null) return;
            try
            {
                var dir = Path.GetDirectoryName(path);
                Directory.CreateDirectory(dir);
                if (prunedBuckets.Add(bucket)) PruneCache(dir);
                var tmp = path + "." + System.Guid.NewGuid().ToString("N") + ".tmp";
                File.WriteAllText(tmp, text);
                if (File.Exists(path)) File.Delete(path);
                File.Move(tmp, path);
            }
            catch (IOException) { }
            catch (System.UnauthorizedAccessException) { }
        }

        static void PruneCache(string dir)
        {
            var limit = System.DateTime.UtcNow.AddDays(-CacheMaxAgeDays);
            foreach (var file in Directory.GetFiles(dir))
            {
                try { if (File.GetLastWriteTimeUtc(file) < limit) File.Delete(file); }
                catch (IOException) { }
                catch (System.UnauthorizedAccessException) { }
            }
        }

        /// <summary>本进程持久缓存命中情况（"命中/读取次数"）；没读过返回空串</summary>
        public static string CacheInfo()
        {
            return cacheReads == 0 ? "" : cacheHits + "/" + cacheReads;
        }
    }
}
