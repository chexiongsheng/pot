using System;
using System.Collections;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using UnityEngine;
using UnityEngine.Networking;

namespace Pot.Runner
{
    /// <summary>
    /// Runner 当前打开的游戏：负责把各种来源变成本地目录、监听变化、触发热重载、保存存档。
    /// 来源（spec）：
    /// - 本地游戏目录（含 manifest.json）：FileSystemWatcher 监听，改源码即热重载
    /// - 本地 .potg：解压到 persistentDataPath/pot/installed/，文件变化时重装并冷重启
    /// - http(s)://…/*.potg：下载后解压
    /// - http(s)://…/（目录，如 Dev Server 的 /files/games/hello/）：镜像到 persistentDataPath/pot/mirror/，每秒轮询变化
    ///   也支持普通静态服务器（http-server、python -m http.server）：?list 不是 JSON 时改为爬目录列表 + HEAD 比对版本
    /// 与 Dev Server 无关：不启动 Dev Server 也能打开、试玩、热重载。
    /// </summary>
    public class GameSession : MonoBehaviour
    {
        public enum SourceKind { None, Directory, Package, RemotePackage, RemoteDirectory }

        [Serializable]
        class Manifest
        {
            public string id;
            public string name;
            public string version;
        }

        [Serializable]
        class RemoteFile
        {
            public string path;
            public long size;
            public long mtime;
        }

        [Serializable]
        class RemoteList
        {
            public RemoteFile[] files;
        }

        static readonly HashSet<string> Ignored = new HashSet<string> { ".pot", "node_modules", ".git" };

        public SourceKind Kind { get; private set; }
        /// <summary>用户打开时给的原始来源（路径或 URL）</summary>
        public string Spec { get; private set; }
        /// <summary>游戏所在的本地目录（GameFS.Root）</summary>
        public string Dir { get; private set; }
        public string Id { get; private set; }
        public string Name { get; private set; }
        public bool IsOpen { get { return Kind != SourceKind.None; } }
        /// <summary>正在下载 / 解压</summary>
        public bool Busy { get; private set; }
        /// <summary>来源状态说明（如远端不可达）</summary>
        public string SourceStatus { get; private set; }
        public int Reloads { get; private set; }

        /// <summary>打开完成（ok, error）。ok 只表示文件就绪并已开始启动，启动结果见 PotRuntime.Booted</summary>
        public event Action<bool, string> Opened;

        FileSystemWatcher watcher;
        /// <summary>套件目录的监视器（GameFS.KitRoot 存在时）：变化路径加前缀 @pot/kit/ 交给 devtools.changed</summary>
        FileSystemWatcher kitWatcher;
        public const string KitPrefix = "@pot/kit/";
        readonly ConcurrentQueue<string> changes = new ConcurrentQueue<string>();
        readonly HashSet<string> pendingPaths = new HashSet<string>();
        float flushAt = -1;
        float nextSave;
        float nextPoll;
        DateTime packageStamp;
        readonly Dictionary<string, RemoteFile> mirrorIndex = new Dictionary<string, RemoteFile>();
        bool polling;
        Coroutine opening;
        int generation;

        /// <summary>最近一次可用的 state（启动失败后修好代码时据此恢复）</summary>
        string lastState = "";

        public static string Home
        {
            get { return Path.Combine(Application.persistentDataPath, "pot"); }
        }

        // ---------------- 打开 / 关闭 ----------------

        /// <summary>打开游戏；reset=true 时不读存档</summary>
        public void Open(string spec, bool reset)
        {
            spec = (spec ?? "").Trim().Trim('"');
            if (spec.Length == 0)
            {
                Finish(false, "请输入游戏目录、.potg 文件或 URL");
                return;
            }
            Close();
            var gen = ++generation;
            if (IsHttp(spec))
            {
                var path = new Uri(spec).AbsolutePath;
                if (path.EndsWith(".potg", StringComparison.OrdinalIgnoreCase)) opening = StartCoroutine(OpenRemotePackage(spec, reset, gen));
                else opening = StartCoroutine(OpenRemoteDirectory(spec, reset, gen));
                return;
            }
            try
            {
                var full = Path.GetFullPath(spec);
                if (Directory.Exists(full))
                {
                    if (!File.Exists(Path.Combine(full, "manifest.json"))) throw new Exception(full + " 下没有 manifest.json，不是游戏目录");
                    Kind = SourceKind.Directory;
                    Spec = full;
                    StartWatcher(full);
                    Launch(full, reset);
                }
                else if (File.Exists(full))
                {
                    if (!full.EndsWith(".potg", StringComparison.OrdinalIgnoreCase)) throw new Exception("只支持游戏目录或 .potg 文件：" + full);
                    Kind = SourceKind.Package;
                    Spec = full;
                    var dir = InstallDir(full);
                    Extract(File.ReadAllBytes(full), dir);
                    packageStamp = File.GetLastWriteTimeUtc(full);
                    Launch(dir, reset);
                }
                else throw new Exception("找不到 " + full);
                Finish(true, null);
            }
            catch (Exception e)
            {
                Close();
                Finish(false, e.Message);
            }
        }

        /// <summary>保存存档并关闭游戏，回到首页</summary>
        public void Close()
        {
            generation++;
            if (opening != null) StopCoroutine(opening);
            opening = null;
            Busy = false;
            if (IsOpen) Save();
            StopWatcher();
            var runtime = PotRuntime.Instance;
            if (runtime != null) runtime.Shutdown();
            GameFS.Root = null;
            Kind = SourceKind.None;
            Spec = null;
            Dir = null;
            Id = null;
            Name = null;
            SourceStatus = null;
            lastState = "";
            pendingPaths.Clear();
            mirrorIndex.Clear();
            flushAt = -1;
            string dummy;
            while (changes.TryDequeue(out dummy)) { }
        }

        void Finish(bool ok, string error)
        {
            if (!ok) Debug.LogError("[pot] 打开失败：" + error);
            if (Opened != null) Opened(ok, error);
        }

        void Launch(string dir, bool reset)
        {
            Dir = dir;
            var text = File.ReadAllText(Path.Combine(dir, "manifest.json"));
            var manifest = JsonUtility.FromJson<Manifest>(text) ?? new Manifest();
            Id = string.IsNullOrEmpty(manifest.id) ? Path.GetFileName(dir.TrimEnd('/', '\\')) : manifest.id;
            Name = string.IsNullOrEmpty(manifest.name) ? Id : manifest.name;
            GameFS.Root = dir;
            GameFS.UseResources = false;
            if (reset) DeleteSave();
            lastState = reset ? "" : LoadSave();
            Debug.Log("[pot] 打开 " + Name + "（" + Spec + "）" + (lastState.Length > 0 ? "，读取存档" : ""));
            nextSave = Time.realtimeSinceStartup + 30f;
            PotRuntime.Ensure().Boot(lastState);
        }

        /// <summary>冷重启：keepState=false 时清空存档重新开始</summary>
        public void Restart(bool keepState)
        {
            if (!IsOpen) return;
            if (!keepState) DeleteSave();
            lastState = keepState ? CurrentState() : "";
            PotRuntime.Ensure().Boot(lastState);
        }

        public string InfoJson()
        {
            if (!IsOpen) return null;
            var runtime = PotRuntime.Instance;
            var sb = new StringBuilder("{");
            sb.Append("\"id\":").Append(Json.Quote(Id));
            sb.Append(",\"name\":").Append(Json.Quote(Name));
            sb.Append(",\"source\":").Append(Json.Quote(Spec));
            sb.Append(",\"kind\":").Append(Json.Quote(Kind.ToString()));
            sb.Append(",\"dir\":").Append(Json.Quote(Dir));
            sb.Append(",\"status\":").Append(Json.Quote(runtime != null ? runtime.Status.ToString() : "Idle"));
            sb.Append('}');
            return sb.ToString();
        }

        // ---------------- 存档 ----------------

        string SavePath
        {
            get { return Path.Combine(Home, "saves", Sanitize(Id) + ".json"); }
        }

        string CurrentState()
        {
            var runtime = PotRuntime.Instance;
            if (runtime != null && runtime.Status == PotRuntime.RuntimeStatus.Running)
            {
                var s = runtime.ExportState();
                if (!string.IsNullOrEmpty(s)) lastState = s;
            }
            return lastState;
        }

        public void Save()
        {
            if (!IsOpen || string.IsNullOrEmpty(Id)) return;
            var state = CurrentState();
            if (string.IsNullOrEmpty(state)) return;
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(SavePath));
                File.WriteAllText(SavePath, state);
            }
            catch (Exception e)
            {
                Debug.LogWarning("[pot] 保存存档失败：" + e.Message);
            }
        }

        string LoadSave()
        {
            try { return File.Exists(SavePath) ? File.ReadAllText(SavePath) : ""; }
            catch (Exception) { return ""; }
        }

        public void DeleteSave()
        {
            if (string.IsNullOrEmpty(Id)) return;
            try { if (File.Exists(SavePath)) File.Delete(SavePath); }
            catch (Exception) { }
        }

        void OnApplicationPause(bool paused)
        {
            if (paused) Save();
        }

        void OnApplicationQuit()
        {
            Save();
        }

        void OnDestroy()
        {
            StopWatcher();
        }

        // ---------------- 变化 → 热重载 ----------------

        void Update()
        {
            string path;
            while (changes.TryDequeue(out path))
            {
                pendingPaths.Add(path);
                flushAt = Time.realtimeSinceStartup + 0.15f; // 去抖：编辑器保存往往连发多个事件
            }
            if (flushAt > 0 && Time.realtimeSinceStartup >= flushAt)
            {
                flushAt = -1;
                var list = new List<string>(pendingPaths);
                pendingPaths.Clear();
                Apply(list);
            }
            if (!IsOpen || Busy) return;
            var now = Time.realtimeSinceStartup;
            if (now >= nextSave)
            {
                nextSave = now + 30f;
                Save();
            }
            if (now >= nextPoll)
            {
                nextPoll = now + 1f;
                if (Kind == SourceKind.Package) PollPackage();
                else if (Kind == SourceKind.RemoteDirectory && !polling) StartCoroutine(PollRemote(generation));
            }
        }

        /// <summary>文件变化：manifest 变化冷重启；运行中热重载；启动失败则重新启动</summary>
        void Apply(List<string> paths)
        {
            if (!IsOpen || paths.Count == 0) return;
            var runtime = PotRuntime.Ensure();
            Reloads++;
            if (paths.Contains("manifest.json"))
            {
                Debug.Log("[pot] manifest.json 变化，冷重启");
                Save();
                Launch(Dir, false);
                return;
            }
            switch (runtime.Status)
            {
                case PotRuntime.RuntimeStatus.Running:
                    var sb = new StringBuilder("[");
                    for (var i = 0; i < paths.Count; i++)
                    {
                        if (i > 0) sb.Append(',');
                        sb.Append(Json.Quote(paths[i]));
                    }
                    sb.Append(']');
                    try
                    {
                        runtime.Call("devtools.changed", sb.ToString());
                    }
                    catch (Exception e)
                    {
                        Debug.LogError("[pot] 热重载出错：" + e.Message);
                    }
                    break;
                case PotRuntime.RuntimeStatus.Failed:
                case PotRuntime.RuntimeStatus.Idle:
                    Debug.Log("[pot] 文件变化，重新启动（上次启动失败）");
                    runtime.Boot(lastState);
                    break;
                // Booting：等启动完成；改动已在磁盘上，启动会读到最新文件
            }
        }

        // ---- 本地目录 ----

        void StartWatcher(string dir)
        {
            StopWatcher();
            watcher = new FileSystemWatcher(dir)
            {
                IncludeSubdirectories = true,
                NotifyFilter = NotifyFilters.FileName | NotifyFilters.DirectoryName | NotifyFilters.LastWrite | NotifyFilters.Size,
            };
            var root = dir;
            FileSystemEventHandler onChange = (s, e) => Enqueue(root, e.FullPath);
            watcher.Changed += onChange;
            watcher.Created += onChange;
            watcher.Deleted += onChange;
            watcher.Renamed += (s, e) =>
            {
                Enqueue(root, e.OldFullPath);
                Enqueue(root, e.FullPath);
            };
            watcher.Error += (s, e) => Debug.LogWarning("[pot] 文件监听出错：" + e.GetException().Message);
            watcher.EnableRaisingEvents = true;
            StartKitWatcher();
        }

        void StartKitWatcher()
        {
            var kits = GameFS.KitRoot;
            if (string.IsNullOrEmpty(kits) || !Directory.Exists(kits)) return;
            try
            {
                kitWatcher = new FileSystemWatcher(kits)
                {
                    IncludeSubdirectories = true,
                    NotifyFilter = NotifyFilters.FileName | NotifyFilters.DirectoryName | NotifyFilters.LastWrite | NotifyFilters.Size,
                };
                FileSystemEventHandler onChange = (s, e) => Enqueue(kits, e.FullPath, KitPrefix);
                kitWatcher.Changed += onChange;
                kitWatcher.Created += onChange;
                kitWatcher.Deleted += onChange;
                kitWatcher.Renamed += (s, e) =>
                {
                    Enqueue(kits, e.OldFullPath, KitPrefix);
                    Enqueue(kits, e.FullPath, KitPrefix);
                };
                kitWatcher.Error += (s, e) => Debug.LogWarning("[pot] 套件目录监听出错：" + e.GetException().Message);
                kitWatcher.EnableRaisingEvents = true;
            }
            catch (Exception e)
            {
                Debug.LogWarning("[pot] 套件目录监听失败：" + e.Message);
                kitWatcher = null;
            }
        }

        void StopWatcher()
        {
            if (kitWatcher != null)
            {
                kitWatcher.EnableRaisingEvents = false;
                kitWatcher.Dispose();
                kitWatcher = null;
            }
            if (watcher == null) return;
            watcher.EnableRaisingEvents = false;
            watcher.Dispose();
            watcher = null;
        }

        /// <summary>后台线程调用；prefix 用于套件目录（@pot/kit/）</summary>
        void Enqueue(string root, string full, string prefix = "")
        {
            var rel = Relative(root, full);
            if (rel == null) return;
            if (Directory.Exists(full)) return;
            changes.Enqueue(prefix + rel);
        }

        static string Relative(string root, string full)
        {
            var r = Path.GetFullPath(root).TrimEnd('/', '\\');
            var f = Path.GetFullPath(full);
            if (!f.StartsWith(r, StringComparison.OrdinalIgnoreCase) || f.Length <= r.Length + 1) return null;
            var rel = f.Substring(r.Length + 1).Replace('\\', '/');
            foreach (var part in rel.Split('/'))
            {
                if (Ignored.Contains(part)) return null;
            }
            if (rel.EndsWith("~") || rel.EndsWith(".tmp", StringComparison.OrdinalIgnoreCase) || rel.EndsWith(".swp")) return null;
            return rel;
        }

        // ---- 本地 .potg ----

        void PollPackage()
        {
            try
            {
                if (!File.Exists(Spec)) return;
                var stamp = File.GetLastWriteTimeUtc(Spec);
                if (stamp == packageStamp) return;
                packageStamp = stamp;
                Save();
                Extract(File.ReadAllBytes(Spec), Dir);
                Debug.Log("[pot] " + Path.GetFileName(Spec) + " 已更新，重新安装并冷重启");
                Reloads++;
                Launch(Dir, false);
            }
            catch (IOException)
            {
                // 正在写入，下一秒再试
                packageStamp = default(DateTime);
            }
            catch (Exception e)
            {
                Debug.LogError("[pot] 重新安装失败：" + e.Message);
            }
        }

        static string InstallDir(string key)
        {
            return Path.Combine(Home, "installed", Hash(key));
        }

        /// <summary>解压 .potg 到 dir（先清空；防 zip slip）</summary>
        static void Extract(byte[] data, string dir)
        {
            if (Directory.Exists(dir)) Directory.Delete(dir, true);
            Directory.CreateDirectory(dir);
            var root = Path.GetFullPath(dir).TrimEnd('/', '\\') + Path.DirectorySeparatorChar;
            using (var zip = new ZipArchive(new MemoryStream(data), ZipArchiveMode.Read))
            {
                foreach (var entry in zip.Entries)
                {
                    if (string.IsNullOrEmpty(entry.Name)) continue; // 目录项
                    var target = Path.GetFullPath(Path.Combine(dir, entry.FullName.Replace('\\', '/')));
                    if (!target.StartsWith(root, StringComparison.OrdinalIgnoreCase)) throw new Exception("非法的包内路径：" + entry.FullName);
                    Directory.CreateDirectory(Path.GetDirectoryName(target));
                    using (var input = entry.Open())
                    using (var output = File.Create(target))
                    {
                        input.CopyTo(output);
                    }
                }
            }
            if (!File.Exists(Path.Combine(dir, "manifest.json"))) throw new Exception("包里没有 manifest.json");
        }

        // ---- 远端 .potg ----

        IEnumerator OpenRemotePackage(string url, bool reset, int gen)
        {
            Busy = true;
            Kind = SourceKind.RemotePackage;
            Spec = url;
            SourceStatus = "下载中…";
            using (var req = UnityWebRequest.Get(url))
            {
                req.timeout = 120;
                yield return req.SendWebRequest();
                if (gen != generation) yield break;
                Busy = false;
                opening = null;
                if (req.result != UnityWebRequest.Result.Success)
                {
                    var error = "下载失败：" + url + "（" + req.error + "）";
                    Close();
                    Finish(false, error);
                    yield break;
                }
                try
                {
                    var dir = InstallDir(url);
                    Extract(req.downloadHandler.data, dir);
                    SourceStatus = null;
                    Launch(dir, reset);
                    Finish(true, null);
                }
                catch (Exception e)
                {
                    Close();
                    Finish(false, e.Message);
                }
            }
        }

        // ---- 远端目录（镜像 + 轮询） ----

        IEnumerator OpenRemoteDirectory(string url, bool reset, int gen)
        {
            if (!url.EndsWith("/")) url += "/";
            Busy = true;
            Kind = SourceKind.RemoteDirectory;
            Spec = url;
            Dir = Path.Combine(Home, "mirror", Hash(url));
            SourceStatus = "同步中…";
            Directory.CreateDirectory(Dir);
            var result = new List<string>();
            string error = null;
            yield return Sync(url, Dir, result, gen, e => error = e);
            if (gen != generation) yield break;
            Busy = false;
            opening = null;
            if (error != null)
            {
                Close();
                Finish(false, error);
                yield break;
            }
            try
            {
                SourceStatus = null;
                Launch(Dir, reset);
                nextPoll = Time.realtimeSinceStartup + 1f;
                Finish(true, null);
            }
            catch (Exception e)
            {
                Close();
                Finish(false, e.Message);
            }
        }

        IEnumerator PollRemote(int gen)
        {
            polling = true;
            var result = new List<string>();
            string error = null;
            yield return Sync(Spec, Dir, result, gen, e => error = e);
            polling = false;
            if (gen != generation) yield break;
            SourceStatus = error;
            if (result.Count > 0) Apply(result);
        }

        /// <summary>对比远端清单，下载新增 / 变化的文件、删除已不存在的文件；changed 收集变化路径</summary>
        IEnumerator Sync(string url, string dir, List<string> changed, int gen, Action<string> fail)
        {
            RemoteList list = null;
            string listText;
            using (var req = UnityWebRequest.Get(url + "?list"))
            {
                req.timeout = 15;
                req.SetRequestHeader("Cache-Control", "no-cache");
                yield return req.SendWebRequest();
                if (gen != generation) yield break;
                if (req.result != UnityWebRequest.Result.Success)
                {
                    fail("无法访问 " + url + "（" + req.error + "）");
                    yield break;
                }
                listText = req.downloadHandler.text ?? "";
            }
            if (listText.TrimStart('\uFEFF', ' ', '\t', '\r', '\n').StartsWith("{"))
            {
                // Dev Server：?list 直接返回 JSON 清单
                try
                {
                    list = JsonUtility.FromJson<RemoteList>(listText);
                }
                catch (Exception e)
                {
                    fail("文件清单格式不对：" + e.Message);
                    yield break;
                }
            }
            else
            {
                // 普通静态服务器（http-server、python -m http.server 等）：爬 HTML 目录列表 + HEAD 取版本
                var crawled = new List<RemoteFile>();
                string crawlError = null;
                yield return CrawlStatic(url, listText, crawled, gen, e => crawlError = e);
                if (gen != generation) yield break;
                if (crawlError != null)
                {
                    fail(crawlError);
                    yield break;
                }
                list = new RemoteList { files = crawled.ToArray() };
            }
            if (list == null || list.files == null)
            {
                fail("文件清单为空：" + url);
                yield break;
            }
            var root = Path.GetFullPath(dir).TrimEnd('/', '\\') + Path.DirectorySeparatorChar;
            var firstSync = mirrorIndex.Count == 0;
            var seen = new HashSet<string>();
            foreach (var f in list.files)
            {
                if (string.IsNullOrEmpty(f.path)) continue;
                var target = Path.GetFullPath(Path.Combine(dir, f.path));
                if (!target.StartsWith(root, StringComparison.OrdinalIgnoreCase)) continue;
                seen.Add(f.path);
                RemoteFile known;
                if (mirrorIndex.TryGetValue(f.path, out known) && known.size == f.size && known.mtime == f.mtime && File.Exists(target)) continue;
                using (var req = UnityWebRequest.Get(url + EscapePath(f.path)))
                {
                    req.timeout = 60;
                    req.SetRequestHeader("Cache-Control", "no-cache");
                    yield return req.SendWebRequest();
                    if (gen != generation) yield break;
                    if (req.result != UnityWebRequest.Result.Success)
                    {
                        fail("下载 " + f.path + " 失败（" + req.error + "）");
                        yield break;
                    }
                    Directory.CreateDirectory(Path.GetDirectoryName(target));
                    File.WriteAllBytes(target, req.downloadHandler.data);
                }
                mirrorIndex[f.path] = f;
                changed.Add(f.path);
            }
            var removed = new List<string>();
            foreach (var key in mirrorIndex.Keys)
            {
                if (!seen.Contains(key)) removed.Add(key);
            }
            foreach (var key in removed)
            {
                mirrorIndex.Remove(key);
                try { File.Delete(Path.Combine(dir, key)); } catch (Exception) { }
                changed.Add(key);
            }
            if (firstSync)
            {
                // 首次同步：清掉镜像目录里上次残留、远端已没有的文件
                foreach (var file in Directory.GetFiles(dir, "*", SearchOption.AllDirectories))
                {
                    var rel = file.Substring(root.Length).Replace('\\', '/');
                    if (!seen.Contains(rel)) try { File.Delete(file); } catch (Exception) { }
                }
            }
        }

        // ---- 普通静态服务器兜底 ----

        static readonly Regex HrefPattern = new Regex("href\\s*=\\s*[\"']([^\"']+)[\"']", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        const int MaxCrawlFiles = 2000;

        /// <summary>
        /// 没有 ?list 接口时：从目录列表 HTML 递归收集文件，用 HEAD 的 Content-Length + Last-Modified/ETag 作为版本；
        /// 服务器不给这些头时退化为 GET 并以内容哈希作为版本。
        /// </summary>
        IEnumerator CrawlStatic(string rootUrl, string rootHtml, List<RemoteFile> files, int gen, Action<string> fail)
        {
            var root = new Uri(rootUrl);
            var rootPath = root.AbsolutePath;
            var pending = new Queue<KeyValuePair<Uri, string>>();
            var visited = new HashSet<string> { rootPath };
            var filePaths = new List<string>();
            pending.Enqueue(new KeyValuePair<Uri, string>(root, rootHtml));
            while (pending.Count > 0)
            {
                var item = pending.Dequeue();
                var html = item.Value;
                if (html == null)
                {
                    using (var req = UnityWebRequest.Get(item.Key.AbsoluteUri))
                    {
                        req.timeout = 15;
                        req.SetRequestHeader("Cache-Control", "no-cache");
                        yield return req.SendWebRequest();
                        if (gen != generation) yield break;
                        if (req.result != UnityWebRequest.Result.Success)
                        {
                            fail("无法读取目录 " + item.Key.AbsoluteUri + "（" + req.error + "）");
                            yield break;
                        }
                        html = req.downloadHandler.text ?? "";
                    }
                }
                foreach (Match m in HrefPattern.Matches(html))
                {
                    Uri link;
                    if (!Uri.TryCreate(item.Key, WebUtility.HtmlDecode(m.Groups[1].Value), out link)) continue;
                    if (link.Scheme != root.Scheme || link.Authority != root.Authority) continue;
                    var abs = link.AbsolutePath;
                    if (!abs.StartsWith(rootPath, StringComparison.Ordinal) || abs.Length <= rootPath.Length) continue;
                    var rel = Uri.UnescapeDataString(abs.Substring(rootPath.Length));
                    if (IsIgnoredPath(rel)) continue;
                    if (abs.EndsWith("/"))
                    {
                        if (visited.Add(abs)) pending.Enqueue(new KeyValuePair<Uri, string>(new Uri(root, abs), null));
                    }
                    else if (!filePaths.Contains(rel))
                    {
                        filePaths.Add(rel);
                        if (filePaths.Count > MaxCrawlFiles)
                        {
                            fail("目录下文件超过 " + MaxCrawlFiles + " 个，请缩小范围或改用 Dev Server");
                            yield break;
                        }
                    }
                }
            }
            if (!filePaths.Contains("manifest.json"))
            {
                fail("在 " + rootUrl + " 没找到 manifest.json。请确认地址指向游戏目录，且服务器开启了目录列表"
                    + "（http-server 若目录里有 index.html 会直接返回首页，可加 -i false 或改用 Dev Server）");
                yield break;
            }
            foreach (var rel in filePaths)
            {
                var fileUrl = rootUrl + EscapePath(rel);
                long size = -1;
                string stamp = null;
                using (var req = UnityWebRequest.Head(fileUrl))
                {
                    req.timeout = 15;
                    req.SetRequestHeader("Cache-Control", "no-cache");
                    yield return req.SendWebRequest();
                    if (gen != generation) yield break;
                    if (req.result == UnityWebRequest.Result.Success)
                    {
                        long.TryParse(req.GetResponseHeader("Content-Length") ?? "", out size);
                        var lm = req.GetResponseHeader("Last-Modified");
                        var etag = req.GetResponseHeader("ETag");
                        if (!string.IsNullOrEmpty(lm) || !string.IsNullOrEmpty(etag)) stamp = lm + "|" + etag;
                    }
                }
                if (stamp == null)
                {
                    using (var req = UnityWebRequest.Get(fileUrl))
                    {
                        req.timeout = 60;
                        req.SetRequestHeader("Cache-Control", "no-cache");
                        yield return req.SendWebRequest();
                        if (gen != generation) yield break;
                        if (req.result != UnityWebRequest.Result.Success)
                        {
                            fail("下载 " + rel + " 失败（" + req.error + "）");
                            yield break;
                        }
                        var data = req.downloadHandler.data ?? new byte[0];
                        size = data.Length;
                        files.Add(new RemoteFile { path = rel, size = size, mtime = StableHash(data) });
                    }
                    continue;
                }
                files.Add(new RemoteFile { path = rel, size = size, mtime = StableHash(Encoding.UTF8.GetBytes(stamp)) });
            }
        }

        static bool IsIgnoredPath(string rel)
        {
            foreach (var part in rel.Split('/'))
            {
                if (Ignored.Contains(part)) return true;
            }
            return false;
        }

        static long StableHash(byte[] bytes)
        {
            using (var md5 = MD5.Create())
            {
                return BitConverter.ToInt64(md5.ComputeHash(bytes), 0);
            }
        }

        // ---------------- 工具 ----------------

        public static bool IsHttp(string spec)
        {
            return spec.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || spec.StartsWith("https://", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>看起来像能打开的游戏（命令行位置参数判断用）</summary>
        public static bool LooksLikeGame(string spec)
        {
            if (string.IsNullOrEmpty(spec) || spec.StartsWith("-")) return false;
            if (IsHttp(spec)) return true;
            try
            {
                var full = Path.GetFullPath(spec);
                if (Directory.Exists(full)) return File.Exists(Path.Combine(full, "manifest.json"));
                return File.Exists(full) && full.EndsWith(".potg", StringComparison.OrdinalIgnoreCase);
            }
            catch (Exception)
            {
                return false;
            }
        }

        static string EscapePath(string path)
        {
            var parts = path.Split('/');
            for (var i = 0; i < parts.Length; i++) parts[i] = Uri.EscapeDataString(parts[i]);
            return string.Join("/", parts);
        }

        static string Hash(string s)
        {
            using (var md5 = MD5.Create())
            {
                var bytes = md5.ComputeHash(Encoding.UTF8.GetBytes(s));
                var sb = new StringBuilder();
                for (var i = 0; i < 8; i++) sb.Append(bytes[i].ToString("x2"));
                return sb.ToString();
            }
        }

        static string Sanitize(string s)
        {
            var sb = new StringBuilder();
            foreach (var c in s ?? "game")
            {
                sb.Append(char.IsLetterOrDigit(c) || c == '.' || c == '-' || c == '_' ? c : '_');
            }
            return sb.Length == 0 ? "game" : sb.ToString();
        }
    }
}
