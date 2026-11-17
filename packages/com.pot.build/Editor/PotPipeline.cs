using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Pot.Build
{
    /// <summary>
    /// 构建前确保项目使用 pot 统一的 URP 配置（Linear 色彩空间、HDR、4 级级联软阴影、SSAO）。
    /// 资产由代码生成，Runner 与游戏发布包共用同一份配置，游戏包不需要（也不能）自带渲染设置。
    /// </summary>
    public static class PotPipeline
    {
        const string Dir = "Assets/Settings";
        const string AssetPath = Dir + "/PotURP.asset";
        const string RendererPath = Dir + "/PotURP_Renderer.asset";

        [MenuItem("pot/Setup URP Pipeline", false, 30)]
        public static void Ensure()
        {
            PlayerSettings.colorSpace = ColorSpace.Linear;
            Directory.CreateDirectory(Dir);

            var data = AssetDatabase.LoadAssetAtPath<UniversalRendererData>(RendererPath);
            if (data == null)
            {
                data = ScriptableObject.CreateInstance<UniversalRendererData>();
                AssetDatabase.CreateAsset(data, RendererPath);
            }
            if (data.postProcessData == null)
            {
                var get = typeof(PostProcessData).GetMethod("GetDefaultPostProcessData", BindingFlags.Static | BindingFlags.NonPublic | BindingFlags.Public);
                data.postProcessData = get != null ? (PostProcessData)get.Invoke(null, null) : null;
            }
            ResourceReloader.TryReloadAllNullIn(data, UniversalRenderPipelineAsset.packagePath);
            data.renderingMode = RenderingMode.Forward;
            EnsureSsao(data);
            EditorUtility.SetDirty(data);

            var asset = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(AssetPath);
            if (asset == null)
            {
                asset = UniversalRenderPipelineAsset.Create(data);
                AssetDatabase.CreateAsset(asset, AssetPath);
            }
            asset.supportsHDR = true;
            asset.msaaSampleCount = 1;
            asset.renderScale = 1f;
            asset.shadowDistance = 140f;
            asset.shadowCascadeCount = 4;
            asset.supportsCameraDepthTexture = true;
            asset.supportsCameraOpaqueTexture = false;
            var so = new SerializedObject(asset);
            Set(so, "m_MainLightShadowsSupported", true);
            Set(so, "m_MainLightShadowmapResolution", 4096);
            Set(so, "m_AdditionalLightsRenderingMode", 1);
            Set(so, "m_AdditionalLightsPerObjectLimit", 8);
            Set(so, "m_AdditionalLightShadowsSupported", true);
            Set(so, "m_AdditionalLightsShadowmapResolution", 2048);
            Set(so, "m_SoftShadowsSupported", true);
            Set(so, "m_SoftShadowQuality", 3);
            Set(so, "m_ReflectionProbeBlending", true);
            Set(so, "m_ColorGradingMode", 1);
            Set(so, "m_ColorGradingLutSize", 32);
            Set(so, "m_HDRColorBufferPrecision", 1);
            Set(so, "m_ShadowDepthBias", 0.6f);
            Set(so, "m_ShadowNormalBias", 0.6f);
            Set(so, "m_CascadeBorder", 0.15f);
            var split = so.FindProperty("m_Cascade4Split");
            if (split != null) split.vector3Value = new Vector3(0.04f, 0.13f, 0.38f);
            so.ApplyModifiedPropertiesWithoutUndo();
            EditorUtility.SetDirty(asset);

            GraphicsSettings.renderPipelineAsset = asset;
            var quality = new SerializedObject(AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/QualitySettings.asset")[0]);
            var levels = quality.FindProperty("m_QualitySettings");
            for (var i = 0; i < levels.arraySize; i++)
            {
                var level = levels.GetArrayElementAtIndex(i);
                var rp = level.FindPropertyRelative("customRenderPipeline");
                if (rp != null) rp.objectReferenceValue = asset;
            }
            quality.ApplyModifiedPropertiesWithoutUndo();

            // URP 14 需要全局设置资产（不存在时自动创建）
            var gsType = typeof(UniversalRenderPipelineAsset).Assembly.GetType("UnityEngine.Rendering.Universal.UniversalRenderPipelineGlobalSettings");
            MethodInfo globals = null;
            if (gsType != null)
                foreach (var m in gsType.GetMethods(BindingFlags.Static | BindingFlags.NonPublic | BindingFlags.Public))
                    if (m.Name == "Ensure" && (globals == null || m.GetParameters().Length < globals.GetParameters().Length)) globals = m;
            if (globals != null)
            {
                var ps = globals.GetParameters();
                var args = new object[ps.Length];
                for (var i = 0; i < ps.Length; i++) args[i] = ps[i].HasDefaultValue ? ps[i].DefaultValue : null;
                globals.Invoke(null, args);
            }
            AssetDatabase.SaveAssets();
            Debug.Log("[pot] URP 管线已配置：" + AssetPath);
        }

        static void Set(SerializedObject so, string name, object value)
        {
            var p = so.FindProperty(name);
            if (p == null)
            {
                Debug.LogWarning("[pot] URP 资产缺少字段 " + name);
                return;
            }
            switch (value)
            {
                case bool b: p.boolValue = b; break;
                case int i:
                    if (p.propertyType == SerializedPropertyType.Enum) p.intValue = i;
                    else p.intValue = i;
                    break;
                case float f: p.floatValue = f; break;
            }
        }

        static void EnsureSsao(UniversalRendererData data)
        {
            var type = typeof(UniversalRendererData).Assembly.GetType("UnityEngine.Rendering.Universal.ScreenSpaceAmbientOcclusion");
            if (type == null) return;
            ScriptableRendererFeature feature = null;
            foreach (var f in data.rendererFeatures)
                if (f != null && f.GetType() == type) feature = f;
            if (feature == null)
            {
                feature = (ScriptableRendererFeature)ScriptableObject.CreateInstance(type);
                feature.name = "SSAO";
                AssetDatabase.AddObjectToAsset(feature, data);
                data.rendererFeatures.Add(feature);
            }
            ResourceReloader.TryReloadAllNullIn(feature, UniversalRenderPipelineAsset.packagePath);
            var settingsField = type.GetField("m_Settings", BindingFlags.Instance | BindingFlags.NonPublic);
            var settings = settingsField != null ? settingsField.GetValue(feature) : null;
            if (settings != null)
            {
                SetField(settings, "Intensity", 1.6f);
                SetField(settings, "Radius", 0.45f);
                SetField(settings, "DirectLightingStrength", 0.2f);
                SetField(settings, "Falloff", 60f);
            }
            // 维护 feature map（编辑器面板同款逻辑），否则加载时会被判为丢失
            var mapField = typeof(ScriptableRendererData).GetField("m_RendererFeatureMap", BindingFlags.Instance | BindingFlags.NonPublic);
            var map = mapField != null ? (List<long>)mapField.GetValue(data) : null;
            if (map != null)
            {
                map.Clear();
                foreach (var f in data.rendererFeatures)
                {
                    string guid;
                    long localId;
                    map.Add(f != null && AssetDatabase.TryGetGUIDAndLocalFileIdentifier(f, out guid, out localId) ? localId : 0);
                }
            }
            EditorUtility.SetDirty(feature);
        }

        static void SetField(object target, string name, object value)
        {
            var f = target.GetType().GetField(name, BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public);
            if (f != null) f.SetValue(target, value);
        }
    }
}
