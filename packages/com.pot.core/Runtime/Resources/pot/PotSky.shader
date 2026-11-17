Shader "Pot/Sky"
{
    // 程序化天空盒：天顶/地平线（朝向太阳一侧与背向一侧分别取色）渐变、太阳光晕与日轮、FBM 云层、地平线雾。
    // 太阳方向取全局 _PotSunDir（PotRender 每帧从主方向光同步）。
    Properties
    {
        _Zenith ("Zenith", Color) = (0.26, 0.32, 0.4, 1)
        _Horizon ("Horizon (sun side)", Color) = (0.98, 0.76, 0.56, 1)
        _HorizonAway ("Horizon (away)", Color) = (0.44, 0.51, 0.58, 1)
        _Ground ("Ground", Color) = (0.2, 0.2, 0.2, 1)
        [HDR] _SunColor ("Sun", Color) = (4, 3, 2, 1)
        _SunSize ("Sun Size (rad)", Float) = 0.02
        _SunGlow ("Sun Glow", Float) = 1
        _Clouds ("Cloud Coverage", Float) = 0.5
        _CloudColor ("Cloud Color", Color) = (0.6, 0.6, 0.65, 1)
        _CloudSpeed ("Cloud Speed", Float) = 0.01
        _HorizonFog ("Horizon Fog", Float) = 0.6
        _Exposure ("Exposure", Float) = 1
    }

    SubShader
    {
        Tags { "Queue" = "Background" "RenderType" = "Background" "PreviewType" = "Skybox" "RenderPipeline" = "UniversalPipeline" }
        Cull Off
        ZWrite Off

        Pass
        {
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "PotCommon.hlsl"

            CBUFFER_START(UnityPerMaterial)
            float4 _Zenith;
            float4 _Horizon;
            float4 _HorizonAway;
            float4 _Ground;
            float4 _SunColor;
            float _SunSize;
            float _SunGlow;
            float _Clouds;
            float4 _CloudColor;
            float _CloudSpeed;
            float _HorizonFog;
            float _Exposure;
            CBUFFER_END

            struct Attributes { float4 positionOS : POSITION; };
            struct Varyings { float4 positionCS : SV_POSITION; float3 dir : TEXCOORD0; };

            Varyings vert(Attributes v)
            {
                Varyings o;
                o.positionCS = TransformObjectToHClip(v.positionOS.xyz);
                o.dir = v.positionOS.xyz;
                return o;
            }

            float CloudFbm(float2 p)
            {
                float v = 0.0;
                float a = 0.5;
                [unroll] for (int i = 0; i < 5; i++)
                {
                    v += a * PotNoise(p);
                    p = p * 2.07 + float2(13.7, 7.3);
                    a *= 0.5;
                }
                return v;
            }

            half4 frag(Varyings i) : SV_Target
            {
                float3 d = normalize(i.dir);
                float3 s = normalize(_PotSunDir.xyz + float3(0, 1e-4, 0));
                float h = d.y;
                float2 dh = normalize(d.xz + 1e-5);
                float2 sh = normalize(s.xz + 1e-5);
                float towards = dot(dh, sh) * 0.5 + 0.5;
                float3 horizon = lerp(_HorizonAway.rgb, _Horizon.rgb, smoothstep(0.2, 1.0, towards));
                float up = saturate(h);
                float3 col = lerp(horizon, _Zenith.rgb, pow(up, 0.45));
                col = lerp(col, _Ground.rgb, saturate(-h * 5.0));

                float mu = dot(d, s);
                float glow = 0.18 * pow(saturate(mu), 4.0) + 0.45 * pow(saturate(mu), 32.0) + 1.2 * pow(saturate(mu), 400.0);
                col += _SunColor.rgb * glow * _SunGlow * (0.4 + 0.6 * saturate(1.0 - h * 2.0));
                float disc = smoothstep(cos(_SunSize * 1.25), cos(_SunSize), mu);

                if (_Clouds > 0.001 && h > -0.02)
                {
                    float2 cp = d.xz / (max(h, 0.0) + 0.12) * 0.9 + _Time.y * _CloudSpeed * float2(1.0, 0.35);
                    float c = CloudFbm(cp);
                    float cov = smoothstep(1.0 - _Clouds, 1.0 - _Clouds + 0.3, c) * smoothstep(-0.02, 0.15, h);
                    float thick = smoothstep(1.0 - _Clouds, 1.1, c);
                    float3 lit = _CloudColor.rgb * (0.7 + 0.3 * up) + _SunColor.rgb * 0.12 * pow(saturate(mu), 3.0);
                    float3 dark = _CloudColor.rgb * 0.55;
                    float3 cc = lerp(lit, dark, thick * 0.7);
                    cc += _SunColor.rgb * 0.35 * pow(saturate(mu), 12.0) * (1.0 - thick);
                    col = lerp(col, cc, cov * 0.92);
                    disc *= 1.0 - saturate(cov * 1.5);
                }
                col += _SunColor.rgb * disc * 25.0;

                float fogAmt = exp(-max(h, 0.0) * 9.0) * _HorizonFog;
                col = lerp(col, PotFogColorFor(d), saturate(fogAmt) * step(0.0001, _PotFogDensity));
                return half4(col * _Exposure, 1);
            }
            ENDHLSL
        }
    }
    Fallback Off
}
