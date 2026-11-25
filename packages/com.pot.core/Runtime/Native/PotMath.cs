using System;

namespace Pot
{
    /// <summary>
    /// 与 V8 的 Math 逐位一致的数学函数（004 第 18.7 节），原生积木里用它们，不用 System.Math 的超越函数。
    /// Sin、Cos、Exp 照搬 V8 src/base/ieee754.cc（fdlibm）；Hypot 照搬 V8 的 MathHypot（按最大值归一、Kahan 求和）；
    /// Max、Min 按 JS 语义处理 NaN 与正负零（System.Math 的 Max(0, -0) 返回 -0，JS 返回 +0）。
    /// 三角函数的大参数（|x| 超过 2^19·π/2）没有照搬 __kernel_rem_pio2，退回 System.Math，不保证逐位一致。
    /// </summary>
    public static class PotMath
    {
        public const double PI = 3.141592653589793;

        static int High(double x) { return (int)(BitConverter.DoubleToInt64Bits(x) >> 32); }
        static uint Low(double x) { return (uint)BitConverter.DoubleToInt64Bits(x); }
        static double Words(int hi, uint lo) { return BitConverter.Int64BitsToDouble(((long)hi << 32) | lo); }

        // ------------------------------------------------------------ JS 语义的小函数

        public static double Max(double a, double b)
        {
            if (double.IsNaN(a) || double.IsNaN(b)) return double.NaN;
            if (a == 0 && b == 0) return (BitConverter.DoubleToInt64Bits(a) < 0 && BitConverter.DoubleToInt64Bits(b) < 0) ? a : 0.0;
            return a > b ? a : b;
        }

        public static double Min(double a, double b)
        {
            if (double.IsNaN(a) || double.IsNaN(b)) return double.NaN;
            if (a == 0 && b == 0) return (BitConverter.DoubleToInt64Bits(a) < 0 || BitConverter.DoubleToInt64Bits(b) < 0) ? -0.0 : 0.0;
            return a < b ? a : b;
        }

        /// <summary>JS 的真值：0、-0、NaN 为假</summary>
        public static bool Truthy(double v) { return v != 0 && !double.IsNaN(v); }

        public static double Sqrt(double x) { return Math.Sqrt(x); }

        // ------------------------------------------------------------ Hypot（V8 builtins/math.tq）

        public static double Hypot(double a, double b)
        {
            var nan = double.IsNaN(a) || double.IsNaN(b);
            var aa = double.IsNaN(a) ? 0 : Math.Abs(a);
            var ab = double.IsNaN(b) ? 0 : Math.Abs(b);
            double max = 0;
            if (!double.IsNaN(a) && aa > max) max = aa;
            if (!double.IsNaN(b) && ab > max) max = ab;
            if (max == double.PositiveInfinity) return double.PositiveInfinity;
            if (nan) return double.NaN;
            if (max == 0) return 0;
            double sum = 0, compensation = 0;
            var n = aa / max;
            var summand = n * n - compensation;
            var preliminary = sum + summand;
            compensation = (preliminary - sum) - summand;
            sum = preliminary;
            n = ab / max;
            summand = n * n - compensation;
            preliminary = sum + summand;
            compensation = (preliminary - sum) - summand;
            sum = preliminary;
            return Math.Sqrt(sum) * max;
        }

        public static double Hypot(double a, double b, double c)
        {
            var nan = double.IsNaN(a) || double.IsNaN(b) || double.IsNaN(c);
            var v0 = double.IsNaN(a) ? 0 : Math.Abs(a);
            var v1 = double.IsNaN(b) ? 0 : Math.Abs(b);
            var v2 = double.IsNaN(c) ? 0 : Math.Abs(c);
            double max = 0;
            if (v0 > max) max = v0;
            if (v1 > max) max = v1;
            if (v2 > max) max = v2;
            if (max == double.PositiveInfinity) return double.PositiveInfinity;
            if (nan) return double.NaN;
            if (max == 0) return 0;
            double sum = 0, compensation = 0;
            foreach (var v in new[] { v0, v1, v2 })
            {
                var n = v / max;
                var summand = n * n - compensation;
                var preliminary = sum + summand;
                compensation = (preliminary - sum) - summand;
                sum = preliminary;
            }
            return Math.Sqrt(sum) * max;
        }

        // ------------------------------------------------------------ Sin、Cos（fdlibm）

        const double invpio2 = 6.36619772367581382433e-01;
        const double pio2_1 = 1.57079632673412561417e+00;
        const double pio2_1t = 6.07710050650619224932e-11;
        const double pio2_2 = 6.07710050630396597660e-11;
        const double pio2_2t = 2.02226624879595063154e-21;
        const double pio2_3 = 2.02226624871116645580e-21;
        const double pio2_3t = 8.47842766036889956997e-32;

        static readonly int[] npio2_hw =
        {
            0x3FF921FB, 0x400921FB, 0x4012D97C, 0x401921FB, 0x401F6A7A, 0x4022D97C,
            0x4025FDBB, 0x402921FB, 0x402C463A, 0x402F6A7A, 0x4031475C, 0x4032D97C,
            0x40346B9C, 0x4035FDBB, 0x40378FDB, 0x403921FB, 0x403AB41B, 0x403C463A,
            0x403DD85A, 0x403F6A7A, 0x40407E4C, 0x4041475C, 0x4042106C, 0x4042D97C,
            0x4043A28C, 0x40446B9C, 0x404534AC, 0x4045FDBB, 0x4046C6CB, 0x40478FDB,
            0x404858EB, 0x404921FB,
        };

        /// <summary>__ieee754_rem_pio2：返回 n，y0 + y1 = x - n·π/2。large 为真表示参数太大，没有处理</summary>
        static int RemPio2(double x, out double y0, out double y1, out bool large)
        {
            large = false;
            double z, w, t, r, fn;
            var hx = High(x);
            var ix = hx & 0x7FFFFFFF;
            if (ix <= 0x3FE921FB) { y0 = x; y1 = 0; return 0; }
            if (ix < 0x4002D97C)
            {
                if (hx > 0)
                {
                    z = x - pio2_1;
                    if (ix != 0x3FF921FB) { y0 = z - pio2_1t; y1 = (z - y0) - pio2_1t; }
                    else { z -= pio2_2; y0 = z - pio2_2t; y1 = (z - y0) - pio2_2t; }
                    return 1;
                }
                else
                {
                    z = x + pio2_1;
                    if (ix != 0x3FF921FB) { y0 = z + pio2_1t; y1 = (z - y0) + pio2_1t; }
                    else { z += pio2_2; y0 = z + pio2_2t; y1 = (z - y0) + pio2_2t; }
                    return -1;
                }
            }
            if (ix <= 0x413921FB)
            {
                t = Math.Abs(x);
                var n = (int)(t * invpio2 + 0.5);
                fn = n;
                r = t - fn * pio2_1;
                w = fn * pio2_1t;
                if (n < 32 && ix != npio2_hw[n - 1])
                {
                    y0 = r - w;
                }
                else
                {
                    var j = ix >> 20;
                    y0 = r - w;
                    var i = j - ((High(y0) >> 20) & 0x7FF);
                    if (i > 16)
                    {
                        t = r;
                        w = fn * pio2_2;
                        r = t - w;
                        w = fn * pio2_2t - ((t - r) - w);
                        y0 = r - w;
                        i = j - ((High(y0) >> 20) & 0x7FF);
                        if (i > 49)
                        {
                            t = r;
                            w = fn * pio2_3;
                            r = t - w;
                            w = fn * pio2_3t - ((t - r) - w);
                            y0 = r - w;
                        }
                    }
                }
                y1 = (r - y0) - w;
                if (hx < 0) { y0 = -y0; y1 = -y1; return -n; }
                return n;
            }
            y0 = y1 = 0;
            large = true;
            return 0;
        }

        static double KernelSin(double x, double y, int iy)
        {
            const double S1 = -1.66666666666666324348e-01, S2 = 8.33333333332248946124e-03, S3 = -1.98412698298579493134e-04,
                S4 = 2.75573137070700676789e-06, S5 = -2.50507602534068634195e-08, S6 = 1.58969099521155010221e-10;
            var ix = High(x) & 0x7FFFFFFF;
            if (ix < 0x3E400000) { if ((int)x == 0) return x; }
            var z = x * x;
            var v = z * x;
            var r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
            if (iy == 0) return x + v * (S1 + z * r);
            return x - ((z * (0.5 * y - v * r) - y) - v * S1);
        }

        static double KernelCos(double x, double y)
        {
            const double C1 = 4.16666666666666019037e-02, C2 = -1.38888888888741095749e-03, C3 = 2.48015872894767294178e-05,
                C4 = -2.75573143513906633035e-07, C5 = 2.08757232129817482790e-09, C6 = -1.13596475577881948265e-11;
            var ix = High(x) & 0x7FFFFFFF;
            if (ix < 0x3E400000) { if ((int)x == 0) return 1.0; }
            var z = x * x;
            var r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
            if (ix < 0x3FD33333) return 1.0 - (0.5 * z - (z * r - x * y));
            double qx = ix > 0x3FE90000 ? 0.28125 : Words(ix - 0x00200000, 0);
            var iz = 0.5 * z - qx;
            var a = 1.0 - qx;
            return a - (iz - (z * r - x * y));
        }

        public static double Sin(double x)
        {
            var ix = High(x) & 0x7FFFFFFF;
            if (ix <= 0x3FE921FB) return KernelSin(x, 0.0, 0);
            if (ix >= 0x7FF00000) return x - x;
            var n = RemPio2(x, out var y0, out var y1, out var large);
            if (large) return Math.Sin(x);
            switch (n & 3)
            {
                case 0: return KernelSin(y0, y1, 1);
                case 1: return KernelCos(y0, y1);
                case 2: return -KernelSin(y0, y1, 1);
                default: return -KernelCos(y0, y1);
            }
        }

        public static double Cos(double x)
        {
            var ix = High(x) & 0x7FFFFFFF;
            if (ix <= 0x3FE921FB) return KernelCos(x, 0.0);
            if (ix >= 0x7FF00000) return x - x;
            var n = RemPio2(x, out var y0, out var y1, out var large);
            if (large) return Math.Cos(x);
            switch (n & 3)
            {
                case 0: return KernelCos(y0, y1);
                case 1: return -KernelSin(y0, y1, 1);
                case 2: return -KernelCos(y0, y1);
                default: return KernelSin(y0, y1, 1);
            }
        }

        // ------------------------------------------------------------ Exp（fdlibm e_exp.c，V8 版）

        public static double Exp(double x)
        {
            const double o_threshold = 7.09782712893383973096e+02, u_threshold = -7.45133219101941108420e+02;
            const double ln2HI0 = 6.93147180369123816490e-01, ln2LO0 = 1.90821492927058770002e-10;
            const double invln2 = 1.44269504088896338700e+00;
            const double P1 = 1.66666666666666019037e-01, P2 = -2.77777777770155933842e-03, P3 = 6.61375632143793436117e-05,
                P4 = -1.65339022054652515390e-06, P5 = 4.13813679705723846039e-08;
            const double E = 2.718281828459045;
            const double huge = 1.0e+300, twom1000 = 9.33263618503218878990e-302, two1023 = 8.988465674311579539e307;

            double y, hi = 0.0, lo = 0.0, c, t, twopk;
            var k = 0;
            var hx = (uint)High(x);
            var xsb = (int)((hx >> 31) & 1);
            hx &= 0x7FFFFFFF;

            if (hx >= 0x40862E42)
            {
                if (hx >= 0x7FF00000)
                {
                    if (((hx & 0xFFFFF) | Low(x)) != 0) return x + x;
                    return xsb == 0 ? x : 0.0;
                }
                if (x > o_threshold) return huge * huge;
                if (x < u_threshold) return twom1000 * twom1000;
            }

            if (hx > 0x3FD62E42)
            {
                if (hx < 0x3FF0A2B2)
                {
                    if (x == 1.0) return E;
                    hi = x - (xsb == 0 ? ln2HI0 : -ln2HI0);
                    lo = xsb == 0 ? ln2LO0 : -ln2LO0;
                    k = 1 - xsb - xsb;
                }
                else
                {
                    k = (int)(invln2 * x + (xsb == 0 ? 0.5 : -0.5));
                    t = k;
                    hi = x - t * ln2HI0;
                    lo = t * ln2LO0;
                }
                x = hi - lo;
            }
            else if (hx < 0x3E300000)
            {
                if (huge + x > 1.0) return 1.0 + x;
            }
            else
            {
                k = 0;
            }

            t = x * x;
            twopk = k >= -1021 ? Words(0x3FF00000 + (k << 20), 0) : Words(0x3FF00000 + ((k + 1000) << 20), 0);
            c = x - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
            if (k == 0) return 1.0 - ((x * c) / (c - 2.0) - x);
            y = 1.0 - ((lo - (x * c) / (2.0 - c)) - hi);
            if (k >= -1021)
            {
                if (k == 1024) return y * 2.0 * two1023;
                return y * twopk;
            }
            return y * twopk * twom1000;
        }
    }
}
