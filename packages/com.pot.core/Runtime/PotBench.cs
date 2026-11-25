using System;
using UnityEngine.Scripting;

namespace Pot
{
    /// <summary>
    /// 跨语言开销实测用的方法（004 第 18.2 节）。只被 js/scripts/bench-interop.js 通过 pot eval 调用，游戏不应使用。
    /// </summary>
    [Preserve]
    public static class PotBench
    {
        static double sink;
        static double[] scratch = new double[0];

        /// <summary>空调用</summary>
        [Preserve]
        public static void Noop() { }

        /// <summary>带标量参数与返回值</summary>
        [Preserve]
        public static double Add(double a, double b) { return a + b; }

        /// <summary>只把 ArrayBuffer 传进来（JS → C# 一次拷贝），返回第一个 double</summary>
        [Preserve]
        public static double Take(Puerts.ArrayBuffer buf)
        {
            if (buf == null || buf.Bytes == null || buf.Count < 8) return 0;
            return BitConverter.ToDouble(buf.Bytes, 0);
        }

        /// <summary>原样返回（JS → C# → JS 两次拷贝）</summary>
        [Preserve]
        public static Puerts.ArrayBuffer Echo(Puerts.ArrayBuffer buf)
        {
            if (buf == null || buf.Bytes == null) return null;
            var bytes = new byte[buf.Count];
            Buffer.BlockCopy(buf.Bytes, 0, bytes, 0, buf.Count);
            return new Puerts.ArrayBuffer(bytes);
        }

        /// <summary>转成 double[]，每个元素加 1 后返回（模拟一次原生积木的打包、计算、回传）</summary>
        [Preserve]
        public static Puerts.ArrayBuffer Increment(Puerts.ArrayBuffer buf)
        {
            if (buf == null || buf.Bytes == null) return null;
            var n = buf.Count / 8;
            if (scratch.Length < n) scratch = new double[n];
            Buffer.BlockCopy(buf.Bytes, 0, scratch, 0, n * 8);
            for (var i = 0; i < n; i++) scratch[i] += 1;
            var bytes = new byte[n * 8];
            Buffer.BlockCopy(scratch, 0, bytes, 0, n * 8);
            return new Puerts.ArrayBuffer(bytes);
        }

        /// <summary>纯 C# 基准：对 n 个 double 做与 JS 基准相同的运算，返回耗时毫秒</summary>
        [Preserve]
        public static double Compute(int n, int rounds)
        {
            if (scratch.Length < n) scratch = new double[n];
            for (var i = 0; i < n; i++) scratch[i] = i * 0.5;
            var sw = System.Diagnostics.Stopwatch.StartNew();
            for (var r = 0; r < rounds; r++)
                for (var i = 0; i < n; i++) scratch[i] = scratch[i] * 0.999 + Math.Sqrt(scratch[i] + 1);
            sw.Stop();
            sink = scratch[0];
            return sw.Elapsed.TotalMilliseconds;
        }
    }
}
