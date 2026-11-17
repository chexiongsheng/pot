using System;
using UnityEngine;

namespace Pot
{
    /// <summary>
    /// 发布期入口：从 Resources/pot-game（或 -potGame=目录）加载游戏并启动。
    /// com.pot.build 生成的启动场景里只有这一个组件。
    /// </summary>
    public class PotBoot : MonoBehaviour
    {
        void Start()
        {
            foreach (var arg in Environment.GetCommandLineArgs())
            {
                if (arg.StartsWith("-potGame=", StringComparison.Ordinal)) GameFS.Root = arg.Substring("-potGame=".Length);
            }
            GameFS.UseResources = true;
            var runtime = PotRuntime.Ensure();
            runtime.Boot("");
        }
    }
}
