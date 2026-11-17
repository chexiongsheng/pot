Shader "Pot/Unlit"
{
    // 不受光：纯色/贴图 × 颜色（可乘顶点色）。混合状态由材质实例决定（unlit / unlit-fade / additive / 粒子）。
    // _FogMode：0 无雾，1 正常雾，2 叠加模式（按雾透射率淡出）
    Properties
    {
        [HDR] _Color ("Color", Color) = (1,1,1,1)
        _MainTex ("Texture", 2D) = "white" {}
        _Tiling ("Tiling xy / Offset zw", Vector) = (1,1,0,0)
        [HDR] _EmissionColor ("Emission", Color) = (0,0,0,1)
        _VColor ("Use Vertex Color", Float) = 0
        _FogMode ("Fog Mode", Float) = 1
        _Cutoff ("Alpha Cutoff", Float) = 0
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
        float _VColor;
        float _FogMode;
        float _Cutoff;
        float _DstBlend;
        CBUFFER_END

        TEXTURE2D(_MainTex); SAMPLER(sampler_MainTex);

        struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; float2 uv : TEXCOORD0; float4 color : COLOR; };
        struct Varyings { float4 positionCS : SV_POSITION; float2 uv : TEXCOORD0; float3 positionWS : TEXCOORD1; float4 color : TEXCOORD2; float3 normalWS : TEXCOORD3; };

        Varyings vert(Attributes v)
        {
            Varyings o;
            o.positionWS = TransformObjectToWorld(v.positionOS.xyz);
            o.positionCS = TransformWorldToHClip(o.positionWS);
            o.uv = v.uv * _Tiling.xy + _Tiling.zw;
            o.color = v.color;
            o.normalWS = TransformObjectToWorldNormal(v.normalOS);
            return o;
        }
        ENDHLSL

        Pass
        {
            Name "Unlit"
            Tags { "LightMode" = "UniversalForward" }
            Blend [_SrcBlend] [_DstBlend]
            ZWrite [_ZWrite]
            Cull [_Cull]

            HLSLPROGRAM
            #pragma target 3.0
            #pragma vertex vert
            #pragma fragment frag

            half4 frag(Varyings i) : SV_Target
            {
                half4 c = SAMPLE_TEXTURE2D(_MainTex, sampler_MainTex, i.uv) * _Color;
                if (_VColor > 0.5) c *= i.color;
                if (_Cutoff > 0) clip(c.a - _Cutoff);
                c.rgb += _EmissionColor.rgb;
                float3 cam = GetCameraPositionWS();
                if (_FogMode > 1.5) c.rgb *= PotFogTransmittance(i.positionWS, cam);
                else if (_FogMode > 0.5) c.rgb = PotApplyFog(c.rgb, i.positionWS, cam);
                return c;
            }
            ENDHLSL
        }

        Pass
        {
            Name "ShadowCaster"
            Tags { "LightMode" = "ShadowCaster" }
            ZWrite On
            ColorMask 0
            Cull [_Cull]

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment fragShadow
            half4 fragShadow(Varyings i) : SV_Target { return 0; }
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
            #pragma vertex vert
            #pragma fragment fragDepth
            half fragDepth(Varyings i) : SV_Target { return i.positionCS.z; }
            ENDHLSL
        }

        Pass
        {
            Name "DepthNormals"
            Tags { "LightMode" = "DepthNormals" }
            ZWrite On
            Cull [_Cull]

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment fragNormals
            half4 fragNormals(Varyings i) : SV_Target { return half4(normalize(i.normalWS), 0); }
            ENDHLSL
        }
    }
    Fallback Off
}
