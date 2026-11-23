using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;
using Debug = UnityEngine.Debug;

namespace Pot.Build
{
    /// <summary>
    /// 发布构建（通用打包工程 player/ 与 runner/ 都可用）：
    /// 1. 暂存：pot stage（esbuild 打包为 bundle.cjs + manifest.json + data/**，并按 manifest 解析出 release.json 与图标）
    /// 2. 导入：暂存目录 game/** 以 .bytes 文本资源放进 Assets/PotGame/Resources/pot-game，图标放进 Assets/PotGame
    /// 3. 生成启动场景（只有 PotBoot）、Puerts 胶水代码、URP 管线
    /// 4. 按 release.json 设置 PlayerSettings（名称、公司、包名、版本、图标、方向、窗口）
    /// 5. BuildPipeline.BuildPlayer
    /// 命令行（推荐用 node js/devserver/cli.js release，它会先暂存再调用这里）：
    ///   Unity -batchmode -quit -projectPath player -buildTarget Win64|Android|WebGL
    ///         -executeMethod Pot.Build.PotBuild.Build -potStage=暂存目录 | -potGame=游戏目录  [-potTarget=…] [-potOut=…]
    /// </summary>
    public static class PotBuild
    {
        public const string GameRoot = "Assets/PotGame";
        public const string ResourcesDir = GameRoot + "/Resources/pot-game";
        public const string ScenePath = GameRoot + "/PotBoot.unity";
        public const string IconPath = GameRoot + "/Icon.png";
        public const string FontBase = GameRoot + "/Resources/pot-font";
        const string PrefGame = "pot.build.game";

        /// <summary>release.json（由 js/devserver/release.js 的 resolveRelease 生成）</summary>
        [Serializable]
        public class ReleaseConfig
        {
            public string id;
            public string productName;
            public string company;
            public string packageId;
            public string version;
            public int versionCode = 1;
            /// <summary>相对暂存目录的图标路径；空串表示不设图标</summary>
            public string icon;
            /// <summary>landscape | portrait | auto</summary>
            public string orientation;
            public int width = 1280;
            public int height = 720;
            public bool fullscreen;
            public bool resizable = true;
            /// <summary>产物文件名（不含扩展名）</summary>
            public string fileName;
            /// <summary>相对暂存目录的内置字体子集（font.ttf / font.otf）；空串表示不带字体</summary>
            public string font;
        }

        /// <summary>batchmode 入口</summary>
        public static void Build()
        {
            var code = 0;
            try
            {
                var stage = Arg("potStage");
                var game = Arg("potGame");
                if (string.IsNullOrEmpty(stage) && string.IsNullOrEmpty(game))
                    throw new Exception("用法：-executeMethod Pot.Build.PotBuild.Build -potStage=<暂存目录>|-potGame=<游戏目录> [-potOut=<输出路径>] [-potTarget=Win64|Android|WebGL]");
                var targetArg = Arg("potTarget");
                var target = string.IsNullOrEmpty(targetArg) ? EditorUserBuildSettings.activeBuildTarget : ParseTarget(targetArg);
                if (string.IsNullOrEmpty(stage)) stage = StageGame(game);
                var report = BuildStage(stage, Arg("potOut"), target);
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
            var stage = StageGame(game);
            var config = LoadConfig(stage);
            var ext = OutputExtension(target);
            var output = string.IsNullOrEmpty(ext)
                ? EditorUtility.SaveFolderPanel("输出目录", "", config.fileName)
                : EditorUtility.SaveFilePanel("输出", "", config.fileName, ext.TrimStart('.'));
            if (string.IsNullOrEmpty(output)) return;
            BuildStage(stage, output, target);
        }

        [MenuItem("pot/Import Game Only", false, 2)]
        static void ImportMenu()
        {
            var game = EditorUtility.OpenFolderPanel("选择游戏目录（含 manifest.json）", EditorPrefs.GetString(PrefGame, ""), "");
            if (string.IsNullOrEmpty(game)) return;
            EditorPrefs.SetString(PrefGame, game);
            var stage = StageGame(game);
            ImportStage(stage);
            ApplyPlayerSettings(LoadConfig(stage), EditorUserBuildSettings.activeBuildTarget);
            CreateBootScene();
            EditorSceneManager.OpenScene(ScenePath);
        }

        /// <summary>兼容旧入口：从游戏目录直接构建</summary>
        public static BuildReport BuildGame(string gameDir, string outputPath, BuildTarget target)
        {
            return BuildStage(StageGame(gameDir), outputPath, target);
        }

        public static BuildReport BuildStage(string stageDir, string outputPath, BuildTarget target)
        {
            stageDir = Path.GetFullPath(stageDir);
            var config = LoadConfig(stageDir);
            if (string.IsNullOrEmpty(outputPath))
                outputPath = Path.Combine("Builds", TargetName(target), config.fileName + OutputExtension(target));
            ImportStage(stageDir);
            CreateBootScene();
            EnsurePuertsGenerated();
            PotPipeline.Ensure();
            ApplyPlayerSettings(config, target);
            AssetDatabase.SaveAssets();

            var full = Path.GetFullPath(outputPath);
            var parent = Path.GetDirectoryName(full);
            if (!string.IsNullOrEmpty(parent)) Directory.CreateDirectory(parent);
            var options = new BuildPlayerOptions
            {
                scenes = new[] { ScenePath },
                locationPathName = full,
                target = target,
                targetGroup = BuildPipeline.GetBuildTargetGroup(target),
                options = BuildOptions.None,
            };
            Debug.Log("[pot] BuildPlayer → " + full + "（" + target + "，" + config.productName + " " + config.version + "）");
            var report = BuildPipeline.BuildPlayer(options);
            Debug.Log("[pot] 构建结果：" + report.summary.result + "，大小 " + (report.summary.totalSize / 1024) + " KB，耗时 " + report.summary.totalTime);
            return report;
        }

        /// <summary>运行 pot stage：游戏目录 → 暂存目录（Temp/pot-stage）</summary>
        public static string StageGame(string gameDir)
        {
            gameDir = Path.GetFullPath(gameDir);
            if (!File.Exists(Path.Combine(gameDir, "manifest.json"))) throw new Exception("不是 pot 游戏目录（缺少 manifest.json）：" + gameDir);
            var stage = Path.Combine(Path.GetFullPath("Temp"), "pot-stage");
            RunNode(FindCli(), "stage", gameDir, stage);
            return stage;
        }

        public static ReleaseConfig LoadConfig(string stageDir)
        {
            var file = Path.Combine(stageDir, "release.json");
            if (!File.Exists(file)) throw new Exception("暂存目录缺少 release.json（请用 pot stage 生成）：" + stageDir);
            var config = JsonUtility.FromJson<ReleaseConfig>(File.ReadAllText(file, Encoding.UTF8));
            if (string.IsNullOrEmpty(config.productName)) throw new Exception("release.json 缺少 productName");
            if (string.IsNullOrEmpty(config.fileName)) config.fileName = "game";
            return config;
        }

        /// <summary>
        /// 暂存目录 game/** → Resources/pot-game/**.bytes。统一加 .bytes：Unity 只把少数扩展名识别为文本资源（.frag/.vert/.glsl 不行），
        /// 且 Resources 路径不含扩展名，sea.frag 与 sea.vert 会撞名；加后缀后资源名 = 原文件名（GameFS 按完整路径读取）。
        /// </summary>
        public static void ImportStage(string stageDir)
        {
            var gameDir = Path.Combine(stageDir, "game");
            if (!File.Exists(Path.Combine(gameDir, "manifest.json"))) throw new Exception("暂存目录缺少 game/manifest.json：" + stageDir);
            if (Directory.Exists(ResourcesDir)) FileUtil.DeleteFileOrDirectory(ResourcesDir);
            if (File.Exists(ResourcesDir + ".meta")) File.Delete(ResourcesDir + ".meta");
            Directory.CreateDirectory(ResourcesDir);
            var files = 0;
            foreach (var file in Directory.GetFiles(gameDir, "*", SearchOption.AllDirectories))
            {
                var rel = file.Substring(gameDir.Length).TrimStart('\\', '/');
                var target = Path.Combine(ResourcesDir, rel + ".bytes");
                Directory.CreateDirectory(Path.GetDirectoryName(target));
                File.Copy(file, target, true);
                files++;
            }

            var config = LoadConfig(stageDir);
            if (File.Exists(IconPath)) AssetDatabase.DeleteAsset(IconPath);
            if (!string.IsNullOrEmpty(config.icon))
            {
                var icon = Path.Combine(stageDir, config.icon);
                if (!File.Exists(icon)) throw new Exception("找不到图标：" + icon);
                File.Copy(icon, IconPath, true);
            }

            CopyLinkXml();
            // 内置字体：Resources/pot-font.(ttf|otf)，运行时 PotFonts.Bundled 加载
            foreach (var ext in new[] { ".ttf", ".otf" })
            {
                var old = FontBase + ext;
                if (File.Exists(old)) AssetDatabase.DeleteAsset(old);
            }
            string fontPath = null;
            if (!string.IsNullOrEmpty(config.font))
            {
                var src = Path.Combine(stageDir, config.font);
                if (!File.Exists(src)) throw new Exception("找不到字体：" + src);
                fontPath = FontBase + Path.GetExtension(src).ToLowerInvariant();
                Directory.CreateDirectory(Path.GetDirectoryName(fontPath));
                File.Copy(src, fontPath, true);
            }
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            if (fontPath != null)
            {
                var fi = (TrueTypeFontImporter)AssetImporter.GetAtPath(fontPath);
                fi.fontTextureCase = FontTextureCase.Dynamic;
                fi.includeFontData = true;
                // 子集缺字时回退的系统字体（WebGL 上无效）
                fi.fontNames = new[] { "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "Arial" };
                fi.SaveAndReimport();
                Debug.Log("[pot] 已导入内置字体 → " + fontPath + "（" + (new FileInfo(fontPath).Length / 1024) + " KB）");
            }
            else Debug.LogWarning("[pot] 发布包不带内置字体：WebGL 上中文无法显示");
            if (File.Exists(IconPath))
            {
                var importer = (TextureImporter)AssetImporter.GetAtPath(IconPath);
                importer.textureType = TextureImporterType.Default;
                importer.npotScale = TextureImporterNPOTScale.None;
                importer.mipmapEnabled = false;
                importer.alphaIsTransparency = true;
                importer.textureCompression = TextureImporterCompression.Uncompressed;
                importer.SaveAndReimport();
            }
            Debug.Log("[pot] 已导入 " + files + " 个游戏文件 → " + ResourcesDir);
        }

        public static void ApplyPlayerSettings(ReleaseConfig config, BuildTarget target)
        {
            var group = BuildPipeline.GetBuildTargetGroup(target);
            var named = NamedBuildTarget.FromBuildTargetGroup(group);
            PlayerSettings.productName = config.productName;
            PlayerSettings.companyName = string.IsNullOrEmpty(config.company) ? "pot" : config.company;
            PlayerSettings.bundleVersion = string.IsNullOrEmpty(config.version) ? "0.0.0" : config.version;
            if (!string.IsNullOrEmpty(config.packageId))
            {
                PlayerSettings.SetApplicationIdentifier(named, config.packageId);
                PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Standalone, config.packageId);
            }
            PlayerSettings.insecureHttpOption = InsecureHttpOption.AlwaysAllowed;
            PlayerSettings.runInBackground = true;
            PlayerSettings.SplashScreen.showUnityLogo = false;

            var icon = File.Exists(IconPath) ? AssetDatabase.LoadAssetAtPath<Texture2D>(IconPath) : null;
            PlayerSettings.SetIconsForTargetGroup(BuildTargetGroup.Unknown, icon != null ? new[] { icon } : new Texture2D[0]);

            switch ((config.orientation ?? "").ToLowerInvariant())
            {
                case "portrait":
                    PlayerSettings.defaultInterfaceOrientation = UIOrientation.Portrait;
                    break;
                case "auto":
                    PlayerSettings.defaultInterfaceOrientation = UIOrientation.AutoRotation;
                    PlayerSettings.allowedAutorotateToLandscapeLeft = true;
                    PlayerSettings.allowedAutorotateToLandscapeRight = true;
                    PlayerSettings.allowedAutorotateToPortrait = true;
                    PlayerSettings.allowedAutorotateToPortraitUpsideDown = false;
                    break;
                default:
                    PlayerSettings.defaultInterfaceOrientation = UIOrientation.LandscapeLeft;
                    break;
            }

            // 桌面窗口
            PlayerSettings.fullScreenMode = config.fullscreen ? FullScreenMode.FullScreenWindow : FullScreenMode.Windowed;
            PlayerSettings.defaultScreenWidth = config.width > 0 ? config.width : 1280;
            PlayerSettings.defaultScreenHeight = config.height > 0 ? config.height : 720;
            PlayerSettings.resizableWindow = config.resizable;
            PlayerSettings.usePlayerLog = true;
            // Win64：IL2CPP（与 Android 一致；JS 走反射访问 CS.Pot.*，link.xml 防裁剪）
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Standalone, ScriptingImplementation.IL2CPP);
            PlayerSettings.SetManagedStrippingLevel(NamedBuildTarget.Standalone, ManagedStrippingLevel.Minimal);
            // pot_gfx 的桌面后端是 D3D11
            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.StandaloneWindows64, false);
            PlayerSettings.SetGraphicsAPIs(BuildTarget.StandaloneWindows64, new[] { UnityEngine.Rendering.GraphicsDeviceType.Direct3D11 });

            // Android：IL2CPP + ARM64（Google Play 要求 64 位）；版本号
            PlayerSettings.Android.bundleVersionCode = Math.Max(1, config.versionCode);
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            PlayerSettings.SetManagedStrippingLevel(NamedBuildTarget.Android, ManagedStrippingLevel.Minimal);
            if (PlayerSettings.Android.minSdkVersion < AndroidSdkVersions.AndroidApiLevel24)
                PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel24;
            ConfigureAndroidGfx();

            // WebGL：gzip + 解压回退（任意静态服务器可直接托管）
            PlayerSettings.SetManagedStrippingLevel(NamedBuildTarget.WebGL, ManagedStrippingLevel.Minimal);
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Gzip;
            PlayerSettings.WebGL.decompressionFallback = true;
            PlayerSettings.WebGL.exceptionSupport = WebGLExceptionSupport.ExplicitlyThrownExceptionsOnly;
            PlayerSettings.WebGL.dataCaching = true;
            // pot_gfx 的 WebGL 后端只支持 WebGL2（GLES3）
            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.WebGL, false);
            PlayerSettings.SetGraphicsAPIs(BuildTarget.WebGL, new[] { UnityEngine.Rendering.GraphicsDeviceType.OpenGLES3 });
            Debug.Log("[pot] PlayerSettings：" + config.productName + " / " + config.packageId + " / " + config.version + "（" + config.versionCode + "）" + (icon != null ? " / 图标" : ""));
            var gap = GfxGap(target);
            if (gap != null) Debug.LogWarning("[pot] 平台能力：" + gap);
        }

        /// <summary>目标平台缺少的运行时着色器能力（pot_gfx 后端）；完整支持时为 null</summary>
        public static string GfxGap(BuildTarget target)
        {
            switch (target)
            {
                case BuildTarget.StandaloneWindows64:
                    return "Win64 运行时着色器只有 D3D11 后端；若改用 D3D12 / Vulkan 会退回普通材质";
                case BuildTarget.WebGL:
                    return null;
                case BuildTarget.Android:
                    return "Android 运行时着色器只有 GLES3 后端（arm64-v8a），未在真机上做过完整验证";
                default:
                    return target + " 没有 pot_gfx 后端，ctx.gfx 不可用";
            }
        }

        /// <summary>
        /// Android 的 pot_gfx 只有 GLES3 后端：图形 API 固定为 OpenGLES3；
        /// 关闭多线程渲染，让 PotGfx_Create（在调用线程编译 GL 程序）运行时 GL 上下文就在主线程上。
        /// </summary>
        public static void ConfigureAndroidGfx()
        {
            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.Android, false);
            PlayerSettings.SetGraphicsAPIs(BuildTarget.Android, new[] { UnityEngine.Rendering.GraphicsDeviceType.OpenGLES3 });
            PlayerSettings.SetMobileMTRendering(BuildTargetGroup.Android, false);
        }

        public static void CreateBootScene()
        {
            Directory.CreateDirectory(GameRoot);
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            new GameObject("PotBoot").AddComponent<PotBoot>();
            EditorSceneManager.SaveScene(scene, ScenePath);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
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

        public static BuildTarget ParseTarget(string name)
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

        static string TargetName(BuildTarget target)
        {
            switch (target)
            {
                case BuildTarget.StandaloneWindows64: return "win64";
                case BuildTarget.Android: return "android";
                case BuildTarget.WebGL: return "webgl";
                default: return target.ToString().ToLowerInvariant();
            }
        }

        /// <summary>BuildPlayer 的输出：Win64 为 exe 文件、Android 为 apk 文件、WebGL 为目录</summary>
        static string OutputExtension(BuildTarget target)
        {
            switch (target)
            {
                case BuildTarget.StandaloneWindows64: return ".exe";
                case BuildTarget.Android: return ".apk";
                default: return "";
            }
        }

        public static string PackageRoot(string name)
        {
            var info = UnityEditor.PackageManager.PackageInfo.FindForAssetPath("Packages/" + name);
            if (info == null) throw new Exception("找不到包 " + name);
            return info.resolvedPath;
        }

        /// <summary>Unity 不读取包内的 link.xml：把 com.pot.core/Runtime/link.xml 复制到工程 Assets 下（IL2CPP 防裁剪）</summary>
        public static void CopyLinkXml(string dir = GameRoot)
        {
            var link = Path.Combine(PackageRoot("com.pot.core"), "Runtime/link.xml");
            if (!File.Exists(link)) return;
            Directory.CreateDirectory(dir);
            File.Copy(link, Path.Combine(dir, "link.xml"), true);
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
                if (p.ExitCode != 0) throw new Exception("pot " + args[0] + " 失败（exit " + p.ExitCode + "）：\n" + stderr + output);
            }
        }

        static string Quote(string s)
        {
            return "\"" + s.Replace("\"", "\\\"") + "\"";
        }
    }
}
