Shader "Pot/Lit"
{
    // pot 通用 PBR（URP）：基础色/法线/遮罩贴图，UV 可选网格 UV、世界三平面、物体三平面（按缩放平铺）；
    // 全局湿润（变暗、变光滑、积水、雨滴波纹）、平面反射、高度雾与太阳散射。
    // 所有参数均可逐对象用 MaterialPropertyBlock 设置；不使用材质关键字，模式由不同材质实例的混合状态区分。
    Properties
    {
        _Color ("Color", Color) = (1,1,1,1)
        _MainTex ("Base Map", 2D) = "white" {}
        _BumpMap ("Normal Map", 2D) = "bump" {}
        _MaskMap ("Mask (R metal G AO B height A smooth)", 2D) = "white" {}
        _Tiling ("Tiling xy / Offset zw", Vector) = (1,1,0,0)
        _UVMode ("UV Mode 0 mesh 1 world 2 object", Float) = 0
        _HasBump ("Has Normal", Float) = 0
        _HasMask ("Has Mask", Float) = 0
        _BumpScale ("Normal Scale", Float) = 1
        _Occlusion ("AO Strength", Float) = 1
        _Glossiness ("Smoothness", Range(0,1)) = 0.5
        _Metallic ("Metallic", Range(0,1)) = 0
        [HDR] _EmissionColor ("Emission", Color) = (0,0,0,1)
        _Wet ("Wetness Response", Float) = 1
        _Planar ("Planar Reflection", Float) = 0
        _Cutoff ("Alpha Cutoff", Float) = 0
        _VColor ("Use Vertex Color", Float) = 0
        [HideInInspector] _SrcBlend ("Src", Float) = 1
        [HideInInspector] _DstBlend ("Dst", Float) = 0
        [HideInInspector] _ZWrite ("ZWrite", Float) = 1
        [HideInInspector] _Cull ("Cull", Float) = 2
    }

    SubShader
    {
        Tags { "RenderType" = "Opaque" "RenderPipeline" = "UniversalPipeline" "Queue" = "Geometry" }

        HLSLINCLUDE
        #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
        #include "PotCommon.hlsl"

        CBUFFER_START(UnityPerMaterial)
        float4 _Color;
        float4 _Tiling;
        float4 _EmissionColor;
        float _UVMode;
        float _HasBump;
        float _HasMask;
        float _BumpScale;
        float _Occlusion;
        float _Glossiness;
        float _Metallic;
        float _Wet;
        float _Planar;
        float _Cutoff;
        float _VColor;
        CBUFFER_END

        TEXTURE2D(_MainTex); SAMPLER(sampler_MainTex);
        TEXTURE2D(_BumpMap); SAMPLER(sampler_BumpMap);
        TEXTURE2D(_MaskMap); SAMPLER(sampler_MaskMap);

        float3 PotObjectScale()
        {
            float4x4 m = GetObjectToWorldMatrix();
            return float3(length(m._m00_m10_m20), length(m._m01_m11_m21), length(m._m02_m12_m22));
        }

        half3 PotUnpack(half4 t)
        {
            half3 n = t.xyz * 2.0 - 1.0;
            n.xy *= _BumpScale;
            n.z = sqrt(saturate(1.0 - dot(n.xy, n.xy)));
            return n;
        }

        // 采样基础色/遮罩/法线（法线输出为世界空间）
        void PotSample(float2 uv0, float3 positionWS, float3 positionOS, float3 normalOS, float3 geomN, float4 tangentWS,
                       out half4 base, out half4 mask, out float3 nWS)
        {
            mask = half4(1, 1, 1, 1);
            nWS = geomN;
            if (_UVMode < 0.5)
            {
                float2 uv = uv0 * _Tiling.xy + _Tiling.zw;
                base = SAMPLE_TEXTURE2D(_MainTex, sampler_MainTex, uv);
                if (_HasMask > 0.5) mask = SAMPLE_TEXTURE2D(_MaskMap, sampler_MaskMap, uv);
                if (_HasBump > 0.5)
                {
                    half3 tn = PotUnpack(SAMPLE_TEXTURE2D(_BumpMap, sampler_BumpMap, uv));
                    float3 T = normalize(tangentWS.xyz - geomN * dot(tangentWS.xyz, geomN));
                    float3 B = cross(geomN, T) * (tangentWS.w > 0 ? 1.0 : -1.0) * GetOddNegativeScale();
                    nWS = normalize(tn.x * T + tn.y * B + tn.z * geomN);
                }
                return;
            }
            float3 p;
            float3 n;
            float3 s = 1;
            if (_UVMode < 1.5)
            {
                p = positionWS;
                n = geomN;
            }
            else
            {
                s = PotObjectScale();
                p = positionOS * s;
                n = normalize(normalOS / s);
            }
            float3 bw = pow(abs(n), 6.0);
            bw /= (bw.x + bw.y + bw.z);
            float3 sg = float3(n.x >= 0 ? 1 : -1, n.y >= 0 ? 1 : -1, n.z >= 0 ? 1 : -1);
            float2 uvX = p.zy; uvX.x *= sg.x;
            float2 uvY = p.xz; uvY.x *= sg.y;
            float2 uvZ = p.xy; uvZ.x *= -sg.z;
            uvX = uvX * _Tiling.xy + _Tiling.zw;
            uvY = uvY * _Tiling.xy + _Tiling.zw;
            uvZ = uvZ * _Tiling.xy + _Tiling.zw;
            base = SAMPLE_TEXTURE2D(_MainTex, sampler_MainTex, uvX) * bw.x
                 + SAMPLE_TEXTURE2D(_MainTex, sampler_MainTex, uvY) * bw.y
                 + SAMPLE_TEXTURE2D(_MainTex, sampler_MainTex, uvZ) * bw.z;
            if (_HasMask > 0.5)
            {
                mask = SAMPLE_TEXTURE2D(_MaskMap, sampler_MaskMap, uvX) * bw.x
                     + SAMPLE_TEXTURE2D(_MaskMap, sampler_MaskMap, uvY) * bw.y
                     + SAMPLE_TEXTURE2D(_MaskMap, sampler_MaskMap, uvZ) * bw.z;
            }
            if (_HasBump > 0.5)
            {
                half3 tx = PotUnpack(SAMPLE_TEXTURE2D(_BumpMap, sampler_BumpMap, uvX));
                half3 ty = PotUnpack(SAMPLE_TEXTURE2D(_BumpMap, sampler_BumpMap, uvY));
                half3 tz = PotUnpack(SAMPLE_TEXTURE2D(_BumpMap, sampler_BumpMap, uvZ));
                tx.x *= sg.x; ty.x *= sg.y; tz.x *= -sg.z;
                tx = half3(tx.xy + n.zy, abs(tx.z) * n.x);
                ty = half3(ty.xy + n.xz, abs(ty.z) * n.y);
                tz = half3(tz.xy + n.xy, abs(tz.z) * n.z);
                float3 nb = normalize(tx.zyx * bw.x + ty.xzy * bw.y + tz.xyz * bw.z);
                if (_UVMode < 1.5) nWS = nb;
                else nWS = normalize(mul((float3x3)GetObjectToWorldMatrix(), nb / s));
            }
        }
        ENDHLSL

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }
            Blend [_SrcBlend] [_DstBlend]
            ZWrite [_ZWrite]
            Cull [_Cull]

            HLSLPROGRAM
            #pragma target 3.5
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE
            #pragma multi_compile _ _ADDITIONAL_LIGHTS_VERTEX _ADDITIONAL_LIGHTS
            #pragma multi_compile_fragment _ _ADDITIONAL_LIGHT_SHADOWS
            #pragma multi_compile_fragment _ _REFLECTION_PROBE_BLENDING
            #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM _SHADOWS_SOFT_HIGH
            #pragma multi_compile_fragment _ _SCREEN_SPACE_OCCLUSION

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            TEXTURE2D(_PotPlanarTex); SAMPLER(sampler_PotPlanarTex);

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS : NORMAL;
                float4 tangentOS : TANGENT;
                float2 uv : TEXCOORD0;
                float4 color : COLOR;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 positionWS : TEXCOORD0;
                float3 normalWS : TEXCOORD1;
                float4 tangentWS : TEXCOORD2;
                float2 uv : TEXCOORD3;
                float3 positionOS : TEXCOORD4;
                float3 normalOS : TEXCOORD5;
                float4 color : TEXCOORD6;
            };

            Varyings vert(Attributes v)
            {
                Varyings o;
                VertexPositionInputs pos = GetVertexPositionInputs(v.positionOS.xyz);
                VertexNormalInputs nrm = GetVertexNormalInputs(v.normalOS, v.tangentOS);
                o.positionCS = pos.positionCS;
                o.positionWS = pos.positionWS;
                o.normalWS = nrm.normalWS;
                o.tangentWS = float4(nrm.tangentWS, v.tangentOS.w);
                o.uv = v.uv;
                o.positionOS = v.positionOS.xyz;
                o.normalOS = v.normalOS;
                o.color = v.color;
                return o;
            }

            half4 frag(Varyings i) : SV_Target
            {
                float3 geomN = normalize(i.normalWS);
                half4 base;
                half4 mask;
                float3 n;
                PotSample(i.uv, i.positionWS, i.positionOS, i.normalOS, geomN, i.tangentWS, base, mask, n);
                half4 albedo = base * _Color;
                if (_VColor > 0.5) albedo *= i.color;
                if (_Cutoff > 0) clip(albedo.a - _Cutoff);

                half metallic = _Metallic;
                half smooth = _Glossiness;
                half occ = 1;
                if (_HasMask > 0.5)
                {
                    metallic *= mask.r;
                    occ = lerp(1.0, mask.g, _Occlusion);
                    smooth *= mask.a;
                }

                // ---- 天气：湿润、积水、波纹 ----
                float wet = saturate(_PotWetness * _Wet);
                float pm = 0;
                if (wet > 0.001)
                {
                    float up = saturate((geomN.y - 0.7) / 0.25);
                    float2 xz = i.positionWS.xz;
                    float h = _HasMask > 0.5 ? mask.b : 0.5;
                    float field = 1.0 - (PotFbm(xz * 0.19) * 0.82 + h * 0.18);
                    float th = 1.0 - 0.62 * saturate(_PotPuddles) * wet;
                    float puddle = up * smoothstep(th, th + 0.04, field);
                    float soak = up * smoothstep(th - 0.14, th, field) * wet;
                    float porous = 1.0 - metallic;
                    albedo.rgb *= lerp(1.0, lerp(0.92, 0.5, porous), wet);
                    smooth = max(smooth, lerp(smooth, 0.66, wet));
                    smooth = lerp(smooth, 0.86, soak);
                    smooth = lerp(smooth, 0.965, puddle);
                    albedo.rgb *= lerp(1.0, 0.72, puddle);
                    occ = lerp(occ, 1.0, puddle);
                    n = normalize(lerp(n, geomN, saturate(puddle + soak * 0.5)));
                    if (_PotRain > 0.01)
                    {
                        float2 g = PotRipples(xz, _Time.y) * _PotRain * (0.18 + 0.82 * puddle) * up;
                        n = normalize(n + float3(-g.x, 0, -g.y) * 0.35);
                    }
                    pm = saturate(puddle + soak * 0.6 + wet * 0.25);
                }
                if (_PotPlanarOn > 0.5 && _Planar > 0)
                {
                    float near = saturate(1.0 - abs(i.positionWS.y - _PotPlanarHeight) * 3.0);
                    pm = saturate(max(pm, 0.35) * _Planar * near * saturate((geomN.y - 0.9) * 10.0));
                }
                else pm = 0;

                // ---- 光照（URP PBR，环境反射可被平面反射替换） ----
                float3 V = GetWorldSpaceNormalizeViewDir(i.positionWS);
                float2 suv = GetNormalizedScreenSpaceUV(i.positionCS);
                float4 shadowCoord = TransformWorldToShadowCoord(i.positionWS);
                half4 shadowMask = half4(1, 1, 1, 1);
                Light mainLight = GetMainLight(shadowCoord, i.positionWS, shadowMask);
                AmbientOcclusionFactor ao = CreateAmbientOcclusionFactor(suv, occ);
                mainLight.color *= ao.directAmbientOcclusion;

                BRDFData brdf;
                half alpha = albedo.a;
                InitializeBRDFData(albedo.rgb, metallic, half3(0, 0, 0), smooth, alpha, brdf);
                half3 bakedGI = SampleSH(n);
                half3 R = reflect(-V, n);
                half NoV = saturate(dot(n, V));
                half fres = Pow4(1.0 - NoV);
                half3 spec = GlossyEnvironmentReflection(R, i.positionWS, brdf.perceptualRoughness, 1.0h, suv);
                if (pm > 0.001)
                {
                    float2 puv = float2(1.0 - suv.x, suv.y) + (n.xz - geomN.xz) * float2(-0.12, 0.12);
                    half3 pl = SAMPLE_TEXTURE2D_LOD(_PotPlanarTex, sampler_PotPlanarTex, puv, brdf.perceptualRoughness * 7.0).rgb;
                    spec = lerp(spec, pl, pm);
                }
                half3 color = EnvironmentBRDF(brdf, bakedGI, spec, fres) * ao.indirectAmbientOcclusion;
                color += LightingPhysicallyBased(brdf, mainLight, n, V);
                #if defined(_ADDITIONAL_LIGHTS)
                uint count = GetAdditionalLightsCount();
                for (uint li = 0u; li < count; ++li)
                {
                    Light light = GetAdditionalLight(li, i.positionWS, shadowMask);
                    color += LightingPhysicallyBased(brdf, light, n, V);
                }
                #endif
                color += _EmissionColor.rgb;
                color = PotApplyFog(color, i.positionWS, GetCameraPositionWS());
                return half4(color, alpha);
            }
            ENDHLSL
        }

        Pass
        {
            Name "ShadowCaster"
            Tags { "LightMode" = "ShadowCaster" }
            ZWrite On
            ZTest LEqual
            ColorMask 0
            Cull [_Cull]

            HLSLPROGRAM
            #pragma target 3.5
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_vertex _ _CASTING_PUNCTUAL_LIGHT_SHADOW
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Shadows.hlsl"

            float3 _LightDirection;
            float3 _LightPosition;

            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; float2 uv : TEXCOORD0; };
            struct Varyings { float4 positionCS : SV_POSITION; float2 uv : TEXCOORD0; };

            Varyings vert(Attributes v)
            {
                Varyings o;
                float3 positionWS = TransformObjectToWorld(v.positionOS.xyz);
                float3 normalWS = TransformObjectToWorldNormal(v.normalOS);
                #if _CASTING_PUNCTUAL_LIGHT_SHADOW
                float3 lightDir = normalize(_LightPosition - positionWS);
                #else
                float3 lightDir = _LightDirection;
                #endif
                float4 positionCS = TransformWorldToHClip(ApplyShadowBias(positionWS, normalWS, lightDir));
                #if UNITY_REVERSED_Z
                positionCS.z = min(positionCS.z, UNITY_NEAR_CLIP_VALUE);
                #else
                positionCS.z = max(positionCS.z, UNITY_NEAR_CLIP_VALUE);
                #endif
                o.positionCS = positionCS;
                o.uv = v.uv * _Tiling.xy + _Tiling.zw;
                return o;
            }

            half4 frag(Varyings i) : SV_Target
            {
                if (_Cutoff > 0 && _UVMode < 0.5) clip(SAMPLE_TEXTURE2D(_MainTex, sampler_MainTex, i.uv).a * _Color.a - _Cutoff);
                return 0;
            }
            ENDHLSL
        }

        Pass
        {
            Name "DepthOnly"
            Tags { "LightMode" = "DepthOnly" }
            ZWrite On
            ColorMask R
            Cull [_Cull]

            HLSLPROGRAM
            #pragma target 3.5
            #pragma vertex vert
            #pragma fragment frag

            struct Attributes { float4 positionOS : POSITION; float2 uv : TEXCOORD0; };
            struct Varyings { float4 positionCS : SV_POSITION; float2 uv : TEXCOORD0; };

            Varyings vert(Attributes v)
            {
                Varyings o;
                o.positionCS = TransformObjectToHClip(v.positionOS.xyz);
                o.uv = v.uv * _Tiling.xy + _Tiling.zw;
                return o;
            }

            half frag(Varyings i) : SV_Target
            {
                if (_Cutoff > 0 && _UVMode < 0.5) clip(SAMPLE_TEXTURE2D(_MainTex, sampler_MainTex, i.uv).a * _Color.a - _Cutoff);
                return i.positionCS.z;
            }
            ENDHLSL
        }

        Pass
        {
            Name "DepthNormals"
            Tags { "LightMode" = "DepthNormals" }
            ZWrite On
            Cull [_Cull]

            HLSLPROGRAM
            #pragma target 3.5
            #pragma vertex vert
            #pragma fragment frag

            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; float4 tangentOS : TANGENT; float2 uv : TEXCOORD0; };
            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 positionWS : TEXCOORD0;
                float3 normalWS : TEXCOORD1;
                float4 tangentWS : TEXCOORD2;
                float2 uv : TEXCOORD3;
                float3 positionOS : TEXCOORD4;
                float3 normalOS : TEXCOORD5;
            };

            Varyings vert(Attributes v)
            {
                Varyings o;
                VertexPositionInputs pos = GetVertexPositionInputs(v.positionOS.xyz);
                VertexNormalInputs nrm = GetVertexNormalInputs(v.normalOS, v.tangentOS);
                o.positionCS = pos.positionCS;
                o.positionWS = pos.positionWS;
                o.normalWS = nrm.normalWS;
                o.tangentWS = float4(nrm.tangentWS, v.tangentOS.w);
                o.uv = v.uv;
                o.positionOS = v.positionOS.xyz;
                o.normalOS = v.normalOS;
                return o;
            }

            half4 frag(Varyings i) : SV_Target
            {
                float3 geomN = normalize(i.normalWS);
                half4 base;
                half4 mask;
                float3 n;
                PotSample(i.uv, i.positionWS, i.positionOS, i.normalOS, geomN, i.tangentWS, base, mask, n);
                if (_Cutoff > 0) clip(base.a * _Color.a - _Cutoff);
                return half4(NormalizeNormalPerPixel(n), 0.0);
            }
            ENDHLSL
        }
    }
    Fallback Off
}
