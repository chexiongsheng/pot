using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;
using Debug = UnityEngine.Debug;

namespace Pot.Build
{
    /// <summary>
    /// 发布构建：pot build（esbuild 打包为 bundle.cjs）→ 复制到 Assets/PotGame/Resources/pot-game
    /// → 生成启动场景（只有 PotBoot）→ 复制 link.xml → BuildPipeline.BuildPlayer。
    /// </summary>
    public static class PotBuild
    {
        public const string GameRoot = "Assets/PotGame";
        public const string ResourcesDir = GameRoot + "/Resources/pot-game";
        public const string ScenePath = GameRoot + "/PotBoot.unity";
        const string PrefGame = "pot.build.game";

        /// <summary>batchmode 入口</summary>
        public static void Build()
        {
            var code = 0;
            try
            {
                var game = Arg("potGame");
                var output = Arg("potOut");
                if (string.IsNullOrEmpty(game) || string.IsNullOrEmpty(output))
                    throw new Exception("用法：-executeMethod Pot.Build.PotBuild.Build -potGame=<游戏目录> -potOut=<输出路径> [-potTarget=Win64|Android|iOS|WebGL] [-potNode=node] [-potCli=cli.js]");
                var target = ParseTarget(Arg("potTarget") ?? "Win64");
                var report = BuildGame(game, output, target);
                if (report.summary.result != BuildResult.Succeeded) code = 2;
            }
            catch (Exception e)
            {
                Debug.LogError("[pot] 构建失败：" + e);
                code = 1;
            }
            if (Application.isBatchMode) EditorApplication.Exit(code);
        }

        [MenuItem("pot/Build Game...", false, 1)]
        static void BuildMenu()
        {
            var game = EditorUtility.OpenFolderPanel("选择游戏目录（含 manifest.json）", EditorPrefs.GetString(PrefGame, ""), "");
            if (string.IsNullOrEmpty(game)) return;
            EditorPrefs.SetString(PrefGame, game);
            var target = EditorUserBuildSettings.activeBuildTarget;
            var ext = target == BuildTarget.StandaloneWindows64 ? "exe" : target == BuildTarget.Android ? "apk" : "";
            var output = string.IsNullOrEmpty(ext)
                ? EditorUtility.SaveFolderPanel("输出目录", "", "")
                : EditorUtility.SaveFilePanel("输出", "", Path.GetFileName(game), ext);
            if (string.IsNullOrEmpty(output)) return;
            BuildGame(game, output, target);
        }

        [MenuItem("pot/Import Game Only", false, 2)]
        static void ImportMenu()
        {
            var game = EditorUtility.OpenFolderPanel("选择游戏目录（含 manifest.json）", EditorPrefs.GetString(PrefGame, ""), "");
            if (string.IsNullOrEmpty(game)) return;
            EditorPrefs.SetString(PrefGame, game);
            ImportGame(game);
            CreateBootScene();
        }

        public static BuildReport BuildGame(string gameDir, string outputPath, BuildTarget target)
        {
            ImportGame(gameDir);
            CreateBootScene();
            EnsurePuertsGenerated();
            var options = new BuildPlayerOptions
            {
                scenes = new[] { ScenePath },
                locationPathName = Path.GetFullPath(outputPath),
                target = target,
                targetGroup = BuildPipeline.GetBuildTargetGroup(target),
                options = BuildOptions.None,
            };
            Debug.Log("[pot] BuildPlayer → " + options.locationPathName + "（" + target + "）");
            var report = BuildPipeline.BuildPlayer(options);
            Debug.Log("[pot] 构建结果：" + report.summary.result + "，大小 " + (report.summary.totalSize / 1024) + " KB，耗时 " + report.summary.totalTime);
            return report;
        }

        /// <summary>运行 pot build 并把产物复制进 Resources</summary>
        public static void ImportGame(string gameDir)
        {
            gameDir = Path.GetFullPath(gameDir);
            if (!File.Exists(Path.Combine(gameDir, "manifest.json"))) throw new Exception("不是 pot 游戏目录（缺少 manifest.json）：" + gameDir);
            var temp = Path.Combine(Path.GetFullPath("Temp"), "pot-release");
            if (Directory.Exists(temp)) Directory.Delete(temp, true);
            RunNode(FindCli(), "build", gameDir, temp);

            if (Directory.Exists(ResourcesDir)) FileUtil.DeleteFileOrDirectory(ResourcesDir);
            Directory.CreateDirectory(ResourcesDir);
            CopyDir(temp, ResourcesDir);

            var link = Path.Combine(PackageRoot("com.pot.core"), "Runtime/link.xml");
            if (File.Exists(link)) File.Copy(link, Path.Combine(GameRoot, "link.xml"), true);
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            Debug.Log("[pot] 已导入游戏 " + gameDir + " → " + ResourcesDir);
        }

        public static void CreateBootScene()
        {
            Directory.CreateDirectory(GameRoot);
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            new GameObject("PotBoot").AddComponent<PotBoot>();
            EditorSceneManager.SaveScene(scene, ScenePath);
            AssetDatabase.Refresh();
        }

        // ---------------- 工具 ----------------

        /// <summary>
        /// Puerts 3 的构建前检查要求 Assets/Gen/Plugins/puerts_il2cpp/Puerts_il2cpp.cpp 存在（Mono 后端也检查）。
        /// 缺失时调用 PuerTS → Generate il2cpp → Reflection Mode（pot 只用反射调用 CS.Pot.*，不需要静态包装）。
        /// </summary>
        public static void EnsurePuertsGenerated()
        {
            if (File.Exists("Assets/Gen/Plugins/puerts_il2cpp/Puerts_il2cpp.cpp")) return;
            Type menu = null;
            foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
            {
                menu = asm.GetType("Puerts.Editor.Generator.UnityMenu");
                if (menu != null) break;
            }
            var gen = menu != null ? menu.GetMethod("GenV2WithoutWrapper") : null;
            if (gen == null) throw new Exception("找不到 Puerts 生成入口 Puerts.Editor.Generator.UnityMenu.GenV2WithoutWrapper");
            Debug.Log("[pot] 生成 Puerts il2cpp 胶水代码（Reflection Mode）");
            gen.Invoke(null, null);
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
        }
        static string Arg(string name)
        {
            var prefix = "-" + name + "=";
            foreach (var arg in Environment.GetCommandLineArgs())
                if (arg.StartsWith(prefix, StringComparison.Ordinal)) return arg.Substring(prefix.Length);
            return null;
        }

        static BuildTarget ParseTarget(string name)
        {
            switch (name.ToLowerInvariant())
            {
                case "win64": case "windows": return BuildTarget.StandaloneWindows64;
                case "android": return BuildTarget.Android;
                case "ios": return BuildTarget.iOS;
                case "webgl": return BuildTarget.WebGL;
                case "osx": case "mac": return BuildTarget.StandaloneOSX;
                case "linux": return BuildTarget.StandaloneLinux64;
                default: throw new Exception("未知目标平台：" + name);
            }
        }

        static string PackageRoot(string name)
        {
            var info = UnityEditor.PackageManager.PackageInfo.FindForAssetPath("Packages/" + name);
            if (info == null) throw new Exception("找不到包 " + name);
            return info.resolvedPath;
        }

        /// <summary>pot CLI：-potCli= / 环境变量 POT_CLI / 本包所在仓库的 js/devserver/cli.js</summary>
        static string FindCli()
        {
            var cli = Arg("potCli") ?? Environment.GetEnvironmentVariable("POT_CLI");
            if (string.IsNullOrEmpty(cli))
                cli = Path.GetFullPath(Path.Combine(PackageRoot("com.pot.build"), "../../js/devserver/cli.js"));
            if (!File.Exists(cli)) throw new Exception("找不到 pot CLI：" + cli + "（用 -potCli= 或环境变量 POT_CLI 指定）");
            return cli;
        }

        static void RunNode(string cli, params string[] args)
        {
            var node = Arg("potNode") ?? "node";
            var sb = new StringBuilder(Quote(cli));
            foreach (var a in args) sb.Append(' ').Append(Quote(a));
            var psi = new ProcessStartInfo(node, sb.ToString())
            {
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8,
            };
            using (var p = Process.Start(psi))
            {
                var stdout = p.StandardOutput.ReadToEndAsync();
                var stderr = p.StandardError.ReadToEnd();
                p.WaitForExit();
                var output = stdout.Result;
                if (!string.IsNullOrEmpty(output)) Debug.Log("[pot] " + output.Trim());
                if (p.ExitCode != 0) throw new Exception("pot build 失败（exit " + p.ExitCode + "）：\n" + stderr + output);
            }
        }

        static string Quote(string s)
        {
            return "\"" + s.Replace("\"", "\\\"") + "\"";
        }

        static void CopyDir(string from, string to)
        {
            foreach (var dir in Directory.GetDirectories(from, "*", SearchOption.AllDirectories))
                Directory.CreateDirectory(dir.Replace(from, to));
            foreach (var file in Directory.GetFiles(from, "*", SearchOption.AllDirectories))
                File.Copy(file, file.Replace(from, to), true);
        }
    }
}
