Shader "Pot/Rain"
{
    // GPU 雨：网格里每个四边形是一滴雨（uv2 存随机数），顶点着色器按时间下落并在相机周围的盒子里循环，
    // 沿速度方向拉伸成雨丝、面向相机。迎着太阳时更亮（逆光雨丝）。
    Properties
    {
        _RainColor ("Color", Color) = (0.7, 0.75, 0.8, 0.35)
        _RainBox ("Box Size", Vector) = (28, 18, 28, 0)
        _RainSpeed ("Fall Speed", Float) = 11
        _RainWind ("Wind xz", Vector) = (1.2, 0, 0.4, 0)
        _RainLen ("Streak Length", Float) = 0.9
        _RainWidth ("Streak Width", Float) = 0.012
        _Intensity ("Intensity", Float) = 1
    }

    SubShader
    {
        Tags { "Queue" = "Transparent+50" "RenderType" = "Transparent" "RenderPipeline" = "UniversalPipeline" "IgnoreProjector" = "True" }
        Blend One OneMinusSrcAlpha
        ZWrite Off
        Cull Off

        Pass
        {
            Tags { "LightMode" = "UniversalForward" }
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "PotCommon.hlsl"

            CBUFFER_START(UnityPerMaterial)
            float4 _RainColor;
            float4 _RainBox;
            float _RainSpeed;
            float4 _RainWind;
            float _RainLen;
            float _RainWidth;
            float _Intensity;
            CBUFFER_END

            struct Attributes { float4 positionOS : POSITION; float2 uv : TEXCOORD0; float4 rnd : TEXCOORD1; };
            struct Varyings { float4 positionCS : SV_POSITION; float2 uv : TEXCOORD0; float4 tint : TEXCOORD1; };

            Varyings vert(Attributes v)
            {
                Varyings o;
                float3 cam = GetCameraPositionWS();
                float3 box = _RainBox.xyz;
                float speed = _RainSpeed * (0.85 + 0.3 * v.rnd.w);
                float3 vel = float3(_RainWind.x, -speed, _RainWind.z);
                float3 p = v.rnd.xyz * box + vel * _Time.y;
                p = cam + (frac((p - cam) / box + 0.5) - 0.5) * box;
                float3 dir = normalize(vel);
                float3 toCam = cam - p;
                float dist = length(toCam);
                float3 V = toCam / max(dist, 1e-3);
                float3 right = normalize(cross(dir, V) + 1e-5);
                float len = _RainLen * (0.7 + 0.6 * v.rnd.y);
                float3 wp = p + right * (v.uv.x - 0.5) * _RainWidth * (1.0 + dist * 0.06) + dir * (v.uv.y * len);
                o.positionCS = TransformWorldToHClip(wp);
                if (v.rnd.w > _Intensity) o.positionCS = float4(0, 0, -1, 1);
                o.uv = v.uv;
                float fade = saturate((dist - 0.6) / 1.5) * saturate(1.0 - dist / (box.x * 0.5));
                float glow = pow(saturate(dot(-V, _PotSunDir.xyz)), 5.0);
                float3 c = _RainColor.rgb * (_PotFogColor.rgb * 0.8 + 0.25) + _PotSunColor.rgb * glow * 0.5;
                o.tint = float4(c, _RainColor.a * fade * (0.6 + 0.4 * glow));
                return o;
            }

            half4 frag(Varyings i) : SV_Target
            {
                float across = 1.0 - abs(i.uv.x * 2.0 - 1.0);
                float along = sin(i.uv.y * 3.14159);
                float a = i.tint.a * across * along;
                return half4(i.tint.rgb * a, a);
            }
            ENDHLSL
        }
    }
    Fallback Off
}
