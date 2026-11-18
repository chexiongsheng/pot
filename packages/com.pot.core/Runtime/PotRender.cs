using System;
using System.Collections.Generic;
using System.Reflection;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.Scripting;
using Object = UnityEngine.Object;

namespace Pot
{
    /// <summary>
    /// 通用渲染能力（URP）：后处理、程序化天空与环境反射、高度雾、天气（湿润/积水/雨）、平面反射、画质、粒子迸发、文字转贴图。
    /// 统一入口 Configure(kind, json)：json 中缺省的字段保持不变（数值字段初值为 NaN，整型开关为 -1）。
    /// 颜色一律为 sRGB 数组 [r,g,b] 或 [r,g,b,a]。
    /// </summary>
    [Preserve]
    public static class PotRender
    {
        // ---------------- 配置结构 ----------------

        [Serializable]
        class PostCfg
        {
            public int enabled = -1;
            public int tonemap = -1;       // 0 无 1 Neutral 2 ACES
            public int antialias = -1;     // 0 无 1 FXAA 2 SMAA
            public float exposure = float.NaN, contrast = float.NaN, saturation = float.NaN;
            public float temperature = float.NaN, tint = float.NaN;
            public float bloom = float.NaN, bloomThreshold = float.NaN, bloomScatter = float.NaN;
            public float vignette = float.NaN, vignetteSmooth = float.NaN, grain = float.NaN, chromatic = float.NaN;
            public float ao = float.NaN, aoRadius = float.NaN, aoDirect = float.NaN;
            public float[] filter, bloomTint, shadows, highlights, vignetteColor;
        }

        [Serializable]
        class SkyCfg
        {
            public float[] zenith, horizon, horizonAway, ground, sun, cloudColor;
            public float sunSize = float.NaN, sunGlow = float.NaN, clouds = float.NaN, cloudSpeed = float.NaN, horizonFog = float.NaN, exposure = float.NaN;
            public int reflection = -1;        // 1 用实时反射探针捕捉天空作为环境反射
            public int reflectionSize = -1;
            public float reflectionIntensity = float.NaN;
            public int ambient = -1;           // 1 用天空计算环境光（球谐）
        }

        [Serializable]
        class FogCfg
        {
            public float[] color;
            public float density = float.NaN, height = float.NaN, @base = float.NaN, sun = float.NaN;
        }

        [Serializable]
        class WeatherCfg
        {
            public float wetness = float.NaN, puddles = float.NaN, rain = float.NaN;
            public float[] rainColor, wind, box;
            public float speed = float.NaN, length = float.NaN, width = float.NaN;
            public int drops = -1;
        }

        [Serializable]
        class ReflectionCfg
        {
            public int enabled = -1;
            public float height = float.NaN, scale = float.NaN;
            public int exclude = -1;           // 不进反射的层掩码
            public int shadows = -1;
        }

        [Serializable]
        class QualityCfg
        {
            public float renderScale = float.NaN, shadowDistance = float.NaN;
            public int msaa = -1, shadowResolution = -1, hdr = -1, cascades = -1;
        }

        [Serializable]
        class BurstCfg
        {
            public string kind = "spark";      // spark 叠加火花 / glow 叠加光点 / smoke 烟尘
            public float[] pos, dir, color;
            public int count = 8;
            public float speed = 4, speedJitter = 0.5f, spread = 0.5f, size = 0.05f, sizeJitter = 0.5f, life = 0.4f, lifeJitter = 0.3f;
        }

        [Serializable]
        class TextCfg
        {
            public string text = "";
            public int width = 256, height = 64, size = 48;
            public float[] color, background;
            public int align = 1;              // 0 左 1 中 2 右
            public int bold;
            public float x = float.NaN, y = float.NaN; // 可选：起点（像素，左下为原点）
            public float letterSpacing;
        }

        static bool Has(float v) { return !float.IsNaN(v); }

        static Color Col(float[] a, Color fallback)
        {
            if (a == null || a.Length < 3) return fallback;
            return new Color(a[0], a[1], a[2], a.Length > 3 ? a[3] : 1f);
        }

        static Vector4 Lin(Color c)
        {
            return PotScene.HdrToLinear(c.r, c.g, c.b, c.a);
        }

        // ---------------- 入口 ----------------

        /// <summary>配置渲染能力。kind：post / sky / fog / weather / reflection / quality / refresh。返回空串表示成功，否则为错误信息</summary>
        [Preserve]
        public static string Configure(string kind, string json)
        {
            try
            {
                PotRenderDriver.Ensure();
                if (string.IsNullOrEmpty(json)) json = "{}";
                switch (kind)
                {
                    case "post": Post(json); break;
                    case "sky": Sky(json); break;
                    case "fog": Fog(json); break;
                    case "weather": Weather(json); break;
                    case "reflection": Reflection(json); break;
                    case "quality": Quality(json); break;
                    case "refresh": RefreshEnvironment(); break;
                    default: return "未知的渲染配置：" + kind;
                }
                return "";
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                return e.Message;
            }
        }

        // ---------------- 后处理 ----------------

        static Volume volume;
        static VolumeProfile profile;

        static T Comp<T>() where T : VolumeComponent
        {
            T c;
            if (!profile.TryGet(out c)) c = profile.Add<T>(false);
            c.active = true;
            return c;
        }

        static void Post(string json)
        {
            var cfg = new PostCfg();
            JsonUtility.FromJsonOverwrite(json, cfg);
            if (volume == null)
            {
                var go = new GameObject("PotPostVolume");
                Object.DontDestroyOnLoad(go);
                volume = go.AddComponent<Volume>();
                volume.isGlobal = true;
                volume.priority = 10;
                profile = ScriptableObject.CreateInstance<VolumeProfile>();
                volume.sharedProfile = profile;
                Comp<Tonemapping>().mode.Override(TonemappingMode.ACES);
            }
            var cam = PotScene.Camera;
            var data = cam.GetUniversalAdditionalCameraData();
            if (cfg.enabled >= 0) data.renderPostProcessing = cfg.enabled > 0;
            else data.renderPostProcessing = true;
            if (cfg.antialias >= 0)
            {
                data.antialiasing = cfg.antialias == 0 ? AntialiasingMode.None : cfg.antialias == 1 ? AntialiasingMode.FastApproximateAntialiasing : AntialiasingMode.SubpixelMorphologicalAntiAliasing;
                data.antialiasingQuality = AntialiasingQuality.High;
            }
            if (cfg.tonemap >= 0) Comp<Tonemapping>().mode.Override(cfg.tonemap == 0 ? TonemappingMode.None : cfg.tonemap == 1 ? TonemappingMode.Neutral : TonemappingMode.ACES);

            if (Has(cfg.exposure) || Has(cfg.contrast) || Has(cfg.saturation) || cfg.filter != null)
            {
                var ca = Comp<ColorAdjustments>();
                if (Has(cfg.exposure)) ca.postExposure.Override(cfg.exposure);
                if (Has(cfg.contrast)) ca.contrast.Override(cfg.contrast);
                if (Has(cfg.saturation)) ca.saturation.Override(cfg.saturation);
                if (cfg.filter != null) ca.colorFilter.Override(Col(cfg.filter, Color.white));
            }
            if (Has(cfg.temperature) || Has(cfg.tint))
            {
                var wb = Comp<WhiteBalance>();
                if (Has(cfg.temperature)) wb.temperature.Override(cfg.temperature);
                if (Has(cfg.tint)) wb.tint.Override(cfg.tint);
            }
            if (cfg.shadows != null || cfg.highlights != null)
            {
                var smh = Comp<ShadowsMidtonesHighlights>();
                if (cfg.shadows != null) smh.shadows.Override(new Vector4(cfg.shadows[0], cfg.shadows[1], cfg.shadows[2], cfg.shadows.Length > 3 ? cfg.shadows[3] : 0));
                if (cfg.highlights != null) smh.highlights.Override(new Vector4(cfg.highlights[0], cfg.highlights[1], cfg.highlights[2], cfg.highlights.Length > 3 ? cfg.highlights[3] : 0));
            }
            if (Has(cfg.bloom) || Has(cfg.bloomThreshold) || Has(cfg.bloomScatter) || cfg.bloomTint != null)
            {
                var b = Comp<Bloom>();
                if (Has(cfg.bloom)) b.intensity.Override(cfg.bloom);
                if (Has(cfg.bloomThreshold)) b.threshold.Override(cfg.bloomThreshold);
                if (Has(cfg.bloomScatter)) b.scatter.Override(cfg.bloomScatter);
                if (cfg.bloomTint != null) b.tint.Override(Col(cfg.bloomTint, Color.white));
                b.highQualityFiltering.Override(true);
            }
            if (Has(cfg.vignette) || Has(cfg.vignetteSmooth) || cfg.vignetteColor != null)
            {
                var v = Comp<Vignette>();
                if (Has(cfg.vignette)) v.intensity.Override(cfg.vignette);
                if (Has(cfg.vignetteSmooth)) v.smoothness.Override(cfg.vignetteSmooth);
                if (cfg.vignetteColor != null) v.color.Override(Col(cfg.vignetteColor, Color.black));
            }
            if (Has(cfg.grain))
            {
                var g = Comp<FilmGrain>();
                g.type.Override(FilmGrainLookup.Thin1);
                g.intensity.Override(cfg.grain);
            }
            if (Has(cfg.chromatic)) Comp<ChromaticAberration>().intensity.Override(cfg.chromatic);
            if (Has(cfg.ao) || Has(cfg.aoRadius) || Has(cfg.aoDirect)) Ssao(cfg.ao, cfg.aoRadius, cfg.aoDirect);
        }

        /// <summary>SSAO 渲染特性（URP 内部类型，反射设置）。intensity 为 0 时关闭</summary>
        static void Ssao(float intensity, float radius, float direct)
        {
            foreach (var f in Resources.FindObjectsOfTypeAll<ScriptableRendererFeature>())
            {
                if (f == null || f.GetType().Name != "ScreenSpaceAmbientOcclusion") continue;
                if (Has(intensity)) f.SetActive(intensity > 0);
                var sf = f.GetType().GetField("m_Settings", BindingFlags.Instance | BindingFlags.NonPublic);
                if (sf == null) continue;
                var s = sf.GetValue(f);
                SetField(s, "Intensity", intensity > 0 ? intensity : float.NaN);
                SetField(s, "Radius", radius);
                SetField(s, "DirectLightingStrength", direct);
                sf.SetValue(f, s);
            }
        }

        static void SetField(object o, string name, float v)
        {
            if (o == null || !Has(v)) return;
            var fi = o.GetType().GetField(name, BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
            if (fi != null && fi.FieldType == typeof(float)) fi.SetValue(o, v);
        }

        // ---------------- 天空与环境 ----------------

        static Material skyMat;
        static ReflectionProbe probe;
        static int probeDelay = -1;
        static bool skyAmbient;

        /// <summary>环境反射立方体贴图（sky 配置开启 reflection 时有效），供运行时着色器的 pot_EnvMap 使用</summary>
        internal static Texture EnvTexture => probe != null ? probe.realtimeTexture : null;

        static void Sky(string json)
        {
            var cfg = new SkyCfg();
            JsonUtility.FromJsonOverwrite(json, cfg);
            if (skyMat == null) skyMat = new Material(PotScene.LoadShader("pot/PotSky", "Skybox/Procedural")) { name = "PotSky" };
            if (cfg.zenith != null) skyMat.SetColor("_Zenith", Col(cfg.zenith, Color.blue));
            if (cfg.horizon != null) skyMat.SetColor("_Horizon", Col(cfg.horizon, Color.white));
            if (cfg.horizonAway != null) skyMat.SetColor("_HorizonAway", Col(cfg.horizonAway, Color.white));
            if (cfg.ground != null) skyMat.SetColor("_Ground", Col(cfg.ground, Color.gray));
            if (cfg.cloudColor != null) skyMat.SetColor("_CloudColor", Col(cfg.cloudColor, Color.gray));
            if (cfg.sun != null) skyMat.SetVector("_SunColor", Lin(Col(cfg.sun, Color.white)));
            if (Has(cfg.sunSize)) skyMat.SetFloat("_SunSize", cfg.sunSize);
            if (Has(cfg.sunGlow)) skyMat.SetFloat("_SunGlow", cfg.sunGlow);
            if (Has(cfg.clouds)) skyMat.SetFloat("_Clouds", cfg.clouds);
            if (Has(cfg.cloudSpeed)) skyMat.SetFloat("_CloudSpeed", cfg.cloudSpeed);
            if (Has(cfg.horizonFog)) skyMat.SetFloat("_HorizonFog", cfg.horizonFog);
            if (Has(cfg.exposure)) skyMat.SetFloat("_Exposure", cfg.exposure);
            RenderSettings.skybox = skyMat;
            PotScene.Camera.clearFlags = CameraClearFlags.Skybox;
            if (cfg.ambient >= 0) skyAmbient = cfg.ambient > 0;
            if (skyAmbient) RenderSettings.ambientMode = AmbientMode.Skybox;
            if (Has(cfg.reflectionIntensity)) RenderSettings.reflectionIntensity = Mathf.Clamp(cfg.reflectionIntensity, 0, 1);
            if (cfg.reflection != 0)
            {
                if (probe == null)
                {
                    var go = new GameObject("PotEnvProbe");
                    Object.DontDestroyOnLoad(go);
                    probe = go.AddComponent<ReflectionProbe>();
                    probe.mode = ReflectionProbeMode.Realtime;
                    probe.refreshMode = ReflectionProbeRefreshMode.ViaScripting;
                    probe.timeSlicingMode = ReflectionProbeTimeSlicingMode.NoTimeSlicing;
                    probe.clearFlags = ReflectionProbeClearFlags.Skybox;
                    probe.cullingMask = 0;
                    probe.size = new Vector3(100000, 100000, 100000);
                    probe.hdr = true;
                    probe.importance = 0;
                    probe.boxProjection = false;
                    probe.resolution = 128;
                }
                if (cfg.reflectionSize > 0) probe.resolution = Mathf.ClosestPowerOfTwo(Mathf.Clamp(cfg.reflectionSize, 16, 1024));
            }
            else if (probe != null)
            {
                Object.Destroy(probe.gameObject);
                probe = null;
            }
            RefreshEnvironment();
        }

        /// <summary>天空或太阳改变后重新捕捉环境反射与环境光（延迟两帧，等太阳方向同步到着色器）</summary>
        [Preserve]
        public static void RefreshEnvironment()
        {
            probeDelay = 2;
        }

        static void DoRefresh()
        {
            SyncSun();
            if (RenderSettings.ambientMode == AmbientMode.Skybox && RenderSettings.skybox != null) DynamicGI.UpdateEnvironment();
            if (probe != null) probe.RenderProbe();
        }

        // ---------------- 雾 ----------------

        static void Fog(string json)
        {
            var cfg = new FogCfg();
            JsonUtility.FromJsonOverwrite(json, cfg);
            if (cfg.color != null) Shader.SetGlobalColor("_PotFogColor", Col(cfg.color, Color.gray));
            if (Has(cfg.density)) Shader.SetGlobalFloat("_PotFogDensity", Mathf.Max(0, cfg.density));
            if (Has(cfg.height)) Shader.SetGlobalFloat("_PotFogHeight", Mathf.Max(0, cfg.height));
            if (Has(cfg.@base)) Shader.SetGlobalFloat("_PotFogBase", cfg.@base);
            if (Has(cfg.sun)) Shader.SetGlobalFloat("_PotFogSun", Mathf.Max(0, cfg.sun));
        }

        // ---------------- 天气 ----------------

        static GameObject rainGo;
        static Material rainMat;
        static Mesh rainMesh;

        static void Weather(string json)
        {
            var cfg = new WeatherCfg();
            JsonUtility.FromJsonOverwrite(json, cfg);
            if (Has(cfg.wetness)) Shader.SetGlobalFloat("_PotWetness", Mathf.Clamp01(cfg.wetness));
            if (Has(cfg.puddles)) Shader.SetGlobalFloat("_PotPuddles", Mathf.Clamp01(cfg.puddles));
            if (Has(cfg.rain)) Shader.SetGlobalFloat("_PotRain", Mathf.Clamp01(cfg.rain));
            var needRain = Has(cfg.rain) ? cfg.rain > 0 : rainGo != null;
            if (!needRain)
            {
                if (rainGo != null) rainGo.SetActive(false);
                return;
            }
            var drops = cfg.drops > 0 ? Mathf.Clamp(cfg.drops, 100, 60000) : 8000;
            if (rainGo == null || (cfg.drops > 0 && rainMesh.vertexCount != drops * 4))
            {
                if (rainMat == null) rainMat = new Material(PotScene.LoadShader("pot/PotRain", "Hidden/InternalErrorShader")) { name = "PotRain" };
                if (rainMesh != null) Object.Destroy(rainMesh);
                rainMesh = BuildRainMesh(drops);
                if (rainGo == null)
                {
                    rainGo = new GameObject("PotRain");
                    Object.DontDestroyOnLoad(rainGo);
                    rainGo.AddComponent<MeshFilter>();
                    var mr = rainGo.AddComponent<MeshRenderer>();
                    mr.sharedMaterial = rainMat;
                    mr.shadowCastingMode = ShadowCastingMode.Off;
                    mr.receiveShadows = false;
                }
                rainGo.GetComponent<MeshFilter>().sharedMesh = rainMesh;
            }
            rainGo.SetActive(true);
            if (Has(cfg.rain)) rainMat.SetFloat("_Intensity", Mathf.Clamp01(cfg.rain));
            if (cfg.rainColor != null) rainMat.SetColor("_RainColor", Col(cfg.rainColor, Color.white));
            if (cfg.wind != null && cfg.wind.Length >= 2) rainMat.SetVector("_RainWind", new Vector4(cfg.wind[0], 0, cfg.wind[1], 0));
            if (cfg.box != null && cfg.box.Length >= 3) rainMat.SetVector("_RainBox", new Vector4(cfg.box[0], cfg.box[1], cfg.box[2], 0));
            if (Has(cfg.speed)) rainMat.SetFloat("_RainSpeed", cfg.speed);
            if (Has(cfg.length)) rainMat.SetFloat("_RainLen", cfg.length);
            if (Has(cfg.width)) rainMat.SetFloat("_RainWidth", cfg.width);
        }

        static Mesh BuildRainMesh(int drops)
        {
            var rnd = new System.Random(1234);
            var n = drops * 4;
            var pos = new Vector3[n];
            var uv = new Vector2[n];
            var r = new Vector4[n];
            var idx = new int[drops * 6];
            for (var i = 0; i < drops; i++)
            {
                var v = new Vector4((float)rnd.NextDouble(), (float)rnd.NextDouble(), (float)rnd.NextDouble(), (float)rnd.NextDouble());
                for (var k = 0; k < 4; k++)
                {
                    pos[i * 4 + k] = Vector3.zero;
                    r[i * 4 + k] = v;
                }
                uv[i * 4] = new Vector2(0, 0);
                uv[i * 4 + 1] = new Vector2(1, 0);
                uv[i * 4 + 2] = new Vector2(1, 1);
                uv[i * 4 + 3] = new Vector2(0, 1);
                idx[i * 6] = i * 4; idx[i * 6 + 1] = i * 4 + 1; idx[i * 6 + 2] = i * 4 + 2;
                idx[i * 6 + 3] = i * 4; idx[i * 6 + 4] = i * 4 + 2; idx[i * 6 + 5] = i * 4 + 3;
            }
            var mesh = new Mesh { name = "PotRainDrops" };
            mesh.indexFormat = n > 65000 ? IndexFormat.UInt32 : IndexFormat.UInt16;
            mesh.vertices = pos;
            mesh.uv = uv;
            mesh.SetUVs(1, new List<Vector4>(r));
            mesh.triangles = idx;
            mesh.bounds = new Bounds(Vector3.zero, Vector3.one * 100000f);
            return mesh;
        }

        // ---------------- 平面反射 ----------------

        static Camera planarCam;
        static RenderTexture planarRT;
        static float planarHeight;
        static float planarScale = 0.5f;
        static int planarExclude;

        /// <summary>给 PotGfx：平面反射贴图（未启用时为 null）、反射平面高度、镜像相机</summary>
        internal static Texture PlanarTexture => planarCam != null ? planarRT : null;
        internal static float PlanarHeight => planarHeight;
        internal static Camera PlanarCamera => planarCam;

        static void Reflection(string json)
        {
            var cfg = new ReflectionCfg();
            JsonUtility.FromJsonOverwrite(json, cfg);
            if (Has(cfg.height)) planarHeight = cfg.height;
            if (Has(cfg.scale)) planarScale = Mathf.Clamp(cfg.scale, 0.1f, 1f);
            if (cfg.exclude >= 0) planarExclude = cfg.exclude;
            Shader.SetGlobalFloat("_PotPlanarHeight", planarHeight);
            if (cfg.enabled == 0 || (Has(cfg.scale) && cfg.scale <= 0))
            {
                DestroyPlanar();
                return;
            }
            if (planarCam == null)
            {
                var go = new GameObject("PotPlanarCamera");
                Object.DontDestroyOnLoad(go);
                planarCam = go.AddComponent<Camera>();
                planarCam.enabled = true;
                var d = planarCam.GetUniversalAdditionalCameraData();
                d.renderPostProcessing = false;
                d.antialiasing = AntialiasingMode.None;
                d.requiresDepthOption = CameraOverrideOption.Off;
                d.requiresColorOption = CameraOverrideOption.Off;
                d.renderShadows = false;
            }
            if (cfg.shadows >= 0) planarCam.GetUniversalAdditionalCameraData().renderShadows = cfg.shadows > 0;
            planarRT = null;
            EnsurePlanarRT();
        }

        static void EnsurePlanarRT()
        {
            var main = PotScene.Camera;
            var w = Mathf.Max(64, (int)(main.pixelWidth * planarScale));
            var h = Mathf.Max(64, (int)(main.pixelHeight * planarScale));
            if (planarRT != null && planarRT.width == w && planarRT.height == h) return;
            if (planarRT != null) { planarCam.targetTexture = null; planarRT.Release(); Object.Destroy(planarRT); }
            planarRT = new RenderTexture(w, h, 24, RenderTextureFormat.DefaultHDR) { name = "PotPlanar", useMipMap = true, autoGenerateMips = true, wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Trilinear };
            planarRT.Create();
            planarCam.targetTexture = planarRT;
            Shader.SetGlobalTexture("_PotPlanarTex", planarRT);
        }

        static void DestroyPlanar()
        {
            if (planarCam != null) Object.Destroy(planarCam.gameObject);
            planarCam = null;
            if (planarRT != null) { planarRT.Release(); Object.Destroy(planarRT); }
            planarRT = null;
            Shader.SetGlobalFloat("_PotPlanarOn", 0);
        }

        static void UpdatePlanar()
        {
            if (planarCam == null) return;
            var main = PotScene.Camera;
            EnsurePlanarRT();
            planarCam.depth = main.depth - 10;
            planarCam.fieldOfView = main.fieldOfView;
            planarCam.nearClipPlane = main.nearClipPlane;
            planarCam.farClipPlane = main.farClipPlane;
            planarCam.aspect = main.aspect;
            planarCam.clearFlags = main.clearFlags == CameraClearFlags.Skybox ? CameraClearFlags.Skybox : CameraClearFlags.SolidColor;
            planarCam.backgroundColor = main.backgroundColor;
            planarCam.cullingMask = main.cullingMask & ~planarExclude;
            var t = main.transform;
            var h = planarHeight;
            var p = t.position;
            var f = t.forward;
            var u = t.up;
            planarCam.transform.position = new Vector3(p.x, 2 * h - p.y, p.z);
            planarCam.transform.rotation = Quaternion.LookRotation(new Vector3(f.x, -f.y, f.z), new Vector3(u.x, -u.y, u.z));
            planarCam.ResetProjectionMatrix();
            var w2c = planarCam.worldToCameraMatrix;
            var cpos = w2c.MultiplyPoint(new Vector3(0, h + 0.02f, 0));
            var cn = w2c.MultiplyVector(Vector3.up).normalized;
            var plane = new Vector4(cn.x, cn.y, cn.z, -Vector3.Dot(cpos, cn));
            planarCam.projectionMatrix = planarCam.CalculateObliqueMatrix(plane);
        }

        internal static void BeginCamera(ScriptableRenderContext ctx, Camera cam)
        {
            Shader.SetGlobalFloat("_PotPlanarOn", planarCam != null && cam != planarCam && planarRT != null ? 1f : 0f);
        }

        // ---------------- 画质 ----------------

        static void Quality(string json)
        {
            var cfg = new QualityCfg();
            JsonUtility.FromJsonOverwrite(json, cfg);
            var asset = GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset;
            if (asset == null) return;
            if (Has(cfg.renderScale)) asset.renderScale = Mathf.Clamp(cfg.renderScale, 0.25f, 2f);
            if (Has(cfg.shadowDistance)) asset.shadowDistance = Mathf.Max(0, cfg.shadowDistance);
            if (cfg.msaa >= 0) asset.msaaSampleCount = cfg.msaa >= 8 ? 8 : cfg.msaa >= 4 ? 4 : cfg.msaa >= 2 ? 2 : 1;
            if (cfg.hdr >= 0) asset.supportsHDR = cfg.hdr > 0;
            if (cfg.cascades > 0) asset.shadowCascadeCount = Mathf.Clamp(cfg.cascades, 1, 4);
            if (cfg.shadowResolution > 0)
            {
                var prop = typeof(UniversalRenderPipelineAsset).GetProperty("mainLightShadowmapResolution", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
                var setter = prop != null ? prop.GetSetMethod(true) : null;
                if (setter != null) setter.Invoke(asset, new object[] { Mathf.ClosestPowerOfTwo(cfg.shadowResolution) });
                else
                {
                    var fi = typeof(UniversalRenderPipelineAsset).GetField("m_MainLightShadowmapResolution", BindingFlags.Instance | BindingFlags.NonPublic);
                    if (fi != null) fi.SetValue(asset, Enum.ToObject(fi.FieldType, Mathf.ClosestPowerOfTwo(cfg.shadowResolution)));
                }
            }
        }

        // ---------------- 粒子迸发 ----------------

        static readonly Dictionary<string, ParticleSystem> systems = new Dictionary<string, ParticleSystem>();
        static Texture2D dotTex;

        static Texture2D DotTexture()
        {
            if (dotTex != null) return dotTex;
            const int S = 64;
            dotTex = new Texture2D(S, S, TextureFormat.RGBA32, true, true) { name = "PotDot", wrapMode = TextureWrapMode.Clamp };
            var px = new Color32[S * S];
            for (var y = 0; y < S; y++)
                for (var x = 0; x < S; x++)
                {
                    var dx = (x + 0.5f) / S * 2 - 1;
                    var dy = (y + 0.5f) / S * 2 - 1;
                    var d = Mathf.Sqrt(dx * dx + dy * dy);
                    var a = Mathf.Clamp01(1 - d);
                    a = a * a * (3 - 2 * a);
                    px[y * S + x] = new Color32(255, 255, 255, (byte)(a * 255));
                }
            dotTex.SetPixels32(px);
            dotTex.Apply(true, true);
            return dotTex;
        }

        static ParticleSystem Particles(string kind)
        {
            ParticleSystem ps;
            if (systems.TryGetValue(kind, out ps) && ps != null) return ps;
            var go = new GameObject("PotParticles_" + kind);
            Object.DontDestroyOnLoad(go);
            ps = go.AddComponent<ParticleSystem>();
            ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            var main = ps.main;
            main.playOnAwake = false;
            main.loop = false;
            main.maxParticles = 4000;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.scalingMode = ParticleSystemScalingMode.Shape;
            var emission = ps.emission;
            emission.enabled = false;
            var shape = ps.shape;
            shape.enabled = false;
            var col = ps.colorOverLifetime;
            col.enabled = true;
            var grad = new Gradient();
            var size = ps.sizeOverLifetime;
            var renderer = go.GetComponent<ParticleSystemRenderer>();
            renderer.shadowCastingMode = ShadowCastingMode.Off;
            renderer.receiveShadows = false;
            var mat = new Material(PotScene.LoadShader("pot/PotUnlit", "Universal Render Pipeline/Particles/Unlit")) { name = "PotParticle_" + kind };
            mat.SetTexture("_MainTex", DotTexture());
            mat.SetFloat("_VColor", 1);
            mat.SetFloat("_ZWrite", 0);
            mat.SetFloat("_Cull", 0);
            mat.renderQueue = 3100;
            switch (kind)
            {
                case "smoke":
                    main.gravityModifier = -0.04f;
                    grad.SetKeys(new[] { new GradientColorKey(Color.white, 0), new GradientColorKey(Color.white, 1) },
                        new[] { new GradientAlphaKey(0, 0), new GradientAlphaKey(1, 0.12f), new GradientAlphaKey(0, 1) });
                    size.enabled = true;
                    size.size = new ParticleSystem.MinMaxCurve(1f, AnimationCurve.Linear(0, 0.5f, 1, 1.6f));
                    var limit = ps.limitVelocityOverLifetime;
                    limit.enabled = true;
                    limit.dampen = 0.08f;
                    limit.limit = 0f;
                    mat.SetFloat("_SrcBlend", (float)BlendMode.SrcAlpha);
                    mat.SetFloat("_DstBlend", (float)BlendMode.OneMinusSrcAlpha);
                    mat.SetFloat("_FogMode", 1);
                    renderer.renderMode = ParticleSystemRenderMode.Billboard;
                    break;
                case "glow":
                    main.gravityModifier = 0f;
                    grad.SetKeys(new[] { new GradientColorKey(Color.white, 0), new GradientColorKey(Color.white, 1) },
                        new[] { new GradientAlphaKey(1, 0), new GradientAlphaKey(0, 1) });
                    size.enabled = true;
                    size.size = new ParticleSystem.MinMaxCurve(1f, AnimationCurve.Linear(0, 1f, 1, 0.3f));
                    mat.SetFloat("_SrcBlend", (float)BlendMode.SrcAlpha);
                    mat.SetFloat("_DstBlend", (float)BlendMode.One);
                    mat.SetFloat("_FogMode", 2);
                    renderer.renderMode = ParticleSystemRenderMode.Billboard;
                    break;
                default:
                    main.gravityModifier = 1f;
                    grad.SetKeys(new[] { new GradientColorKey(Color.white, 0), new GradientColorKey(new Color(1f, 0.55f, 0.3f), 1) },
                        new[] { new GradientAlphaKey(1, 0), new GradientAlphaKey(1, 0.5f), new GradientAlphaKey(0, 1) });
                    mat.SetFloat("_SrcBlend", (float)BlendMode.SrcAlpha);
                    mat.SetFloat("_DstBlend", (float)BlendMode.One);
                    mat.SetFloat("_FogMode", 2);
                    renderer.renderMode = ParticleSystemRenderMode.Stretch;
                    renderer.velocityScale = 0.035f;
                    renderer.lengthScale = 1f;
                    var collision = ps.collision;
                    collision.enabled = true;
                    collision.type = ParticleSystemCollisionType.World;
                    collision.mode = ParticleSystemCollisionMode.Collision3D;
                    collision.quality = ParticleSystemCollisionQuality.Low;
                    collision.bounce = 0.3f;
                    collision.dampen = 0.5f;
                    collision.lifetimeLoss = 0.2f;
                    break;
            }
            col.color = grad;
            renderer.sharedMaterial = mat;
            ps.Play();
            systems[kind] = ps;
            return ps;
        }

        /// <summary>粒子迸发：{kind, pos, dir, color(sRGB, 可 HDR), count, speed, speedJitter, spread(0~1), size, sizeJitter, life, lifeJitter}</summary>
        [Preserve]
        public static void Burst(string json)
        {
            var cfg = new BurstCfg();
            JsonUtility.FromJsonOverwrite(json, cfg);
            if (cfg.pos == null || cfg.pos.Length < 3) return;
            var ps = Particles(string.IsNullOrEmpty(cfg.kind) ? "spark" : cfg.kind);
            if (!ps.isPlaying) ps.Play();
            var origin = new Vector3(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
            var dir = cfg.dir != null && cfg.dir.Length >= 3 ? new Vector3(cfg.dir[0], cfg.dir[1], cfg.dir[2]) : Vector3.up;
            if (dir.sqrMagnitude < 1e-6f) dir = Vector3.up;
            dir.Normalize();
            var c = Col(cfg.color, Color.white);
            var lin = Lin(c);
            var m = Mathf.Max(1f, Mathf.Max(lin.x, Mathf.Max(lin.y, lin.z)));
            var color = new Color(lin.x / m, lin.y / m, lin.z / m, c.a);
            var ep = new ParticleSystem.EmitParams();
            var count = Mathf.Clamp(cfg.count, 1, 500);
            for (var i = 0; i < count; i++)
            {
                var v = Vector3.Slerp(dir, UnityEngine.Random.onUnitSphere, Mathf.Clamp01(cfg.spread));
                if (Vector3.Dot(v, dir) < 0 && cfg.spread < 1) v = Vector3.Reflect(v, dir);
                var speed = cfg.speed * (1 + (UnityEngine.Random.value * 2 - 1) * cfg.speedJitter);
                ep.position = origin;
                ep.velocity = v.normalized * speed;
                ep.startSize = cfg.size * (1 + (UnityEngine.Random.value * 2 - 1) * cfg.sizeJitter);
                ep.startLifetime = Mathf.Max(0.02f, cfg.life * (1 + (UnityEngine.Random.value * 2 - 1) * cfg.lifeJitter));
                ep.startColor = color;
                ep.rotation = UnityEngine.Random.value * 360f;
                ps.Emit(ep, 1);
            }
        }

        // ---------------- 文字转贴图 ----------------

        static Font font;
        static Material textMat;

        /// <summary>
        /// 把文字画进贴图（RenderTexture，带 mip），返回贴图 id（可用于 MatTexture）。
        /// {text, width, height, size, color, background, align, bold, x, y, letterSpacing}；text 中的 \n 换行。
        /// </summary>
        [Preserve]
        public static int TextTexture(string json)
        {
            var cfg = new TextCfg();
            JsonUtility.FromJsonOverwrite(json, cfg);
            if (font == null) font = Font.CreateDynamicFontFromOSFont(new[] { "Microsoft YaHei", "Microsoft YaHei UI", "SimHei", "PingFang SC", "Noto Sans CJK SC", "Arial" }, 32);
            if (textMat == null) textMat = new Material(PotScene.LoadShader("pot/PotText", "UI/Default"));
            var style = cfg.bold > 0 ? FontStyle.Bold : FontStyle.Normal;
            var size = Mathf.Clamp(cfg.size, 4, 256);
            var text = cfg.text ?? "";
            font.RequestCharactersInTexture(text, size, style);
            var w = Mathf.Clamp(cfg.width, 4, 4096);
            var h = Mathf.Clamp(cfg.height, 4, 4096);
            var rt = new RenderTexture(w, h, 0, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB) { name = "PotText", useMipMap = true, autoGenerateMips = false, wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Trilinear, anisoLevel = 4 };
            rt.Create();

            var lines = text.Split('\n');
            var lineH = size * 1.2f;
            var widths = new float[lines.Length];
            for (var li = 0; li < lines.Length; li++)
            {
                float lw = 0;
                foreach (var ch in lines[li])
                {
                    CharacterInfo ci;
                    if (font.GetCharacterInfo(ch, out ci, size, style)) lw += ci.advance + cfg.letterSpacing;
                }
                widths[li] = lw;
            }

            var prev = RenderTexture.active;
            RenderTexture.active = rt;
            var bg = Col(cfg.background, new Color(0, 0, 0, 0));
            GL.Clear(true, true, QualitySettings.activeColorSpace == ColorSpace.Linear ? bg.linear : bg);
            textMat.mainTexture = font.material.mainTexture;
            textMat.SetPass(0);
            var flip = SystemInfo.graphicsUVStartsAtTop ? -1f : 1f;
            var fc = Col(cfg.color, Color.white);
            var lc = QualitySettings.activeColorSpace == ColorSpace.Linear ? fc.linear : fc;
            lc.a = fc.a;
            GL.PushMatrix();
            GL.LoadIdentity();
            GL.Begin(GL.QUADS);
            GL.Color(lc);
            var totalH = lineH * lines.Length;
            var top = Has(cfg.y) ? cfg.y : (h + totalH) * 0.5f;
            for (var li = 0; li < lines.Length; li++)
            {
                var baseline = top - (li + 1) * lineH + (lineH - size) * 0.5f + size * 0.2f;
                float pen;
                if (Has(cfg.x)) pen = cfg.x;
                else pen = cfg.align == 0 ? size * 0.25f : cfg.align == 2 ? w - widths[li] - size * 0.25f : (w - widths[li]) * 0.5f;
                foreach (var ch in lines[li])
                {
                    CharacterInfo ci;
                    if (!font.GetCharacterInfo(ch, out ci, size, style)) continue;
                    var x0 = pen + ci.minX; var x1 = pen + ci.maxX;
                    var y0 = baseline + ci.minY; var y1 = baseline + ci.maxY;
                    Vert(ci.uvBottomLeft, x0, y0, w, h, flip);
                    Vert(ci.uvTopLeft, x0, y1, w, h, flip);
                    Vert(ci.uvTopRight, x1, y1, w, h, flip);
                    Vert(ci.uvBottomRight, x1, y0, w, h, flip);
                    pen += ci.advance + cfg.letterSpacing;
                }
            }
            GL.End();
            GL.PopMatrix();
            RenderTexture.active = prev;
            rt.GenerateMips();
            return PotScene.RegisterTexture(rt);
        }

        static void Vert(Vector2 uv, float x, float y, int w, int h, float flip)
        {
            GL.TexCoord2(uv.x, uv.y);
            GL.Vertex3(x / w * 2 - 1, (y / h * 2 - 1) * flip, 0);
        }

        // ---------------- 每帧驱动 ----------------

        static void SyncSun()
        {
            var sun = RenderSettings.sun;
            if (sun == null || !sun.isActiveAndEnabled)
            {
                sun = null;
                foreach (var l in Object.FindObjectsOfType<Light>())
                    if (l.type == LightType.Directional && l.isActiveAndEnabled) { sun = l; break; }
            }
            if (sun == null)
            {
                Shader.SetGlobalVector("_PotSunDir", new Vector4(0, 1, 0, 0));
                Shader.SetGlobalVector("_PotSunColor", Vector4.zero);
                return;
            }
            var d = -sun.transform.forward;
            Shader.SetGlobalVector("_PotSunDir", new Vector4(d.x, d.y, d.z, 0));
            var c = sun.color.linear * sun.intensity;
            Shader.SetGlobalVector("_PotSunColor", new Vector4(c.r, c.g, c.b, 1));
        }

        internal static void LateTick()
        {
            SyncSun();
            UpdatePlanar();
            if (probeDelay >= 0)
            {
                if (probeDelay == 0) DoRefresh();
                probeDelay--;
            }
        }

        internal static void ResetGlobals()
        {
            Shader.SetGlobalFloat("_PotFogHeight", 0);
            Shader.SetGlobalFloat("_PotFogBase", 0);
            Shader.SetGlobalFloat("_PotFogSun", 0);
            Shader.SetGlobalFloat("_PotWetness", 0);
            Shader.SetGlobalFloat("_PotPuddles", 0);
            Shader.SetGlobalFloat("_PotRain", 0);
            Shader.SetGlobalFloat("_PotPlanarOn", 0);
            Shader.SetGlobalFloat("_PotPlanarHeight", 0);
            Shader.SetGlobalTexture("_PotPlanarTex", Texture2D.blackTexture);
        }

        /// <summary>冷重启：销毁所有渲染对象并复位全局量</summary>
        public static void Clear()
        {
            if (volume != null) Object.Destroy(volume.gameObject);
            volume = null;
            if (profile != null) Object.Destroy(profile);
            profile = null;
            if (probe != null) Object.Destroy(probe.gameObject);
            probe = null;
            probeDelay = -1;
            skyAmbient = false;
            RenderSettings.skybox = null;
            if (rainGo != null) Object.Destroy(rainGo);
            rainGo = null;
            if (rainMesh != null) Object.Destroy(rainMesh);
            rainMesh = null;
            DestroyPlanar();
            foreach (var ps in systems.Values) if (ps != null) Object.Destroy(ps.gameObject);
            systems.Clear();
            PotGfx.Clear();
            Ssao(1.6f, float.NaN, float.NaN);
            var cam = PotScene.Camera;
            if (cam != null)
            {
                var data = cam.GetUniversalAdditionalCameraData();
                data.renderPostProcessing = false;
                data.antialiasing = AntialiasingMode.None;
            }
            ResetGlobals();
        }
    }
}
