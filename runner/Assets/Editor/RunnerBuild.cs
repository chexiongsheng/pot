using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;

/// <summary>
/// Runner 构建。Runner 场景是空的：PotRunner 通过 RuntimeInitializeOnLoadMethod 自动创建。
/// batchmode：-executeMethod RunnerBuild.BuildWin64 [-potOut=Builds/Win64/PotRunner.exe]
/// </summary>
public static class RunnerBuild
{
    const string ScenePath = "Assets/Scenes/Runner.unity";

    [MenuItem("pot/Build Runner (Win64)", false, 20)]
    public static void BuildWin64()
    {
        Build(BuildTarget.StandaloneWindows64, "Builds/Win64/PotRunner.exe");
    }

    [MenuItem("pot/Build Runner (Android)", false, 21)]
    public static void BuildAndroid()
    {
        Build(BuildTarget.Android, "Builds/Android/PotRunner.apk");
    }

    static void Build(BuildTarget target, string defaultOut)
    {
        var code = 0;
        try
        {
            EnsureScene();
            Pot.Build.PotBuild.EnsurePuertsGenerated();
            PlayerSettings.productName = "pot Runner";
            PlayerSettings.companyName = "pot";
            PlayerSettings.runInBackground = true;
            PlayerSettings.fullScreenMode = FullScreenMode.Windowed;
            PlayerSettings.defaultScreenWidth = 1280;
            PlayerSettings.defaultScreenHeight = 720;
            PlayerSettings.resizableWindow = true;
            PlayerSettings.SetApplicationIdentifier(BuildTargetGroup.Android, "dev.pot.runner");
            // Runner 需要明文 ws:// 连接局域网 Dev Server
            PlayerSettings.insecureHttpOption = InsecureHttpOption.AlwaysAllowed;

            var output = Arg("potOut") ?? defaultOut;
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = new[] { ScenePath },
                locationPathName = Path.GetFullPath(output),
                target = target,
                targetGroup = BuildPipeline.GetBuildTargetGroup(target),
                options = BuildOptions.None,
            });
            Debug.Log("[pot] Runner 构建结果：" + report.summary.result + " → " + output + "，" + (report.summary.totalSize / 1024) + " KB");
            if (report.summary.result != BuildResult.Succeeded) code = 2;
        }
        catch (Exception e)
        {
            Debug.LogError("[pot] Runner 构建失败：" + e);
            code = 1;
        }
        if (Application.isBatchMode) EditorApplication.Exit(code);
    }

    static void EnsureScene()
    {
        if (File.Exists(ScenePath)) return;
        Directory.CreateDirectory(Path.GetDirectoryName(ScenePath));
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        EditorSceneManager.SaveScene(scene, ScenePath);
        EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
        AssetDatabase.Refresh();
    }

    static string Arg(string name)
    {
        var prefix = "-" + name + "=";
        foreach (var arg in Environment.GetCommandLineArgs())
            if (arg.StartsWith(prefix, StringComparison.Ordinal)) return arg.Substring(prefix.Length);
        return null;
    }
}
