#ifndef POT_COMMON_INCLUDED
#define POT_COMMON_INCLUDED

// pot 着色器公共部分：全局环境（雾、太阳、天气、平面反射）与噪声工具。
// 全局量由 PotScene / PotRender（C#）设置，游戏通过 scene.fog/sky/weather/reflection 控制。

float4 _PotFogColor;     // 线性色
float _PotFogDensity;    // exp2 雾密度，0 关闭
float _PotFogHeight;     // 高度衰减（每米），0 为均匀雾
float _PotFogBase;       // 高度雾基准高度
float4 _PotSunDir;       // 指向太阳（世界空间，已归一化）
float4 _PotSunColor;     // 线性色 × 强度
float _PotFogSun;        // 雾中太阳散射强度
float _PotWetness;       // 全局湿润 0~1
float _PotPuddles;       // 积水量 0~1
float _PotRain;          // 雨滴波纹强度 0~1
float _PotPlanarOn;
float _PotPlanarHeight;

float PotHash(float2 p)
{
    p = frac(p * float2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return frac(p.x * p.y);
}

float PotNoise(float2 p)
{
    float2 i = floor(p);
    float2 f = frac(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = PotHash(i);
    float b = PotHash(i + float2(1, 0));
    float c = PotHash(i + float2(0, 1));
    float d = PotHash(i + float2(1, 1));
    return lerp(lerp(a, b, f.x), lerp(c, d, f.x), f.y);
}

float PotFbm(float2 p)
{
    float v = 0.0;
    float a = 0.5;
    [unroll] for (int i = 0; i < 4; i++)
    {
        v += a * PotNoise(p);
        p = p * 2.03 + 17.1;
        a *= 0.5;
    }
    return v / 0.9375;
}

// 雨滴波纹：返回高度场梯度（xz）
float2 PotRipples(float2 p, float t)
{
    float2 g = 0;
    [unroll] for (int layer = 0; layer < 3; layer++)
    {
        float2 q = p * (2.2 + layer * 0.9) + layer * float2(7.7, 3.3);
        float2 cell = floor(q);
        float2 c = cell + 0.3 + 0.4 * float2(PotHash(cell), PotHash(cell + 3.1));
        float ph = frac(t * (0.8 + 0.15 * layer) + PotHash(cell + 11.7));
        float2 v = q - c;
        float d = length(v) + 1e-4;
        float x = d - ph * 0.42;
        float env = saturate(1.0 - abs(x) / 0.07);
        float amp = (1.0 - ph) * (1.0 - ph);
        float dh = cos(x * 60.0) * env * env * amp;
        g += dh * v / d;
    }
    return g;
}

float3 PotFogColorFor(float3 viewDir)
{
    float s = pow(saturate(dot(viewDir, _PotSunDir.xyz)), 8.0);
    return _PotFogColor.rgb + _PotSunColor.rgb * (_PotFogSun * s);
}

// 雾透射率（1 为无雾）
float PotFogTransmittance(float3 positionWS, float3 cameraWS)
{
    if (_PotFogDensity <= 0) return 1.0;
    float3 d = positionWS - cameraWS;
    float dist = length(d);
    float od = _PotFogDensity * dist;
    if (_PotFogHeight > 0)
    {
        float k = _PotFogHeight;
        float f = exp(-k * max(cameraWS.y - _PotFogBase, -20.0));
        float kdy = k * d.y;
        float t = abs(kdy) > 1e-3 ? (1.0 - exp(-kdy)) / kdy : 1.0;
        od *= f * t;
    }
    return exp(-od * od);
}

float3 PotApplyFog(float3 color, float3 positionWS, float3 cameraWS)
{
    float t = PotFogTransmittance(positionWS, cameraWS);
    if (t >= 1.0) return color;
    float3 v = normalize(positionWS - cameraWS);
    return lerp(PotFogColorFor(v), color, t);
}

#endif
