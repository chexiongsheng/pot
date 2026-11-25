using System;
using System.Collections.Generic;
using System.Reflection;
using System.Text;
using UnityEngine;
using UnityEngine.Scripting;

namespace Pot
{
    /// <summary>
    /// 原生积木的入口（004 第 18.4、18.5 节），由 unity.ts 的 Host.nativeBlocks / nativeStep / nativeBodies 调用。
    /// 首次调用时用反射收集带 [PotBlock] 的 IPotNativeBlock 实现。
    /// </summary>
    [Preserve]
    public static class PotNative
    {
        sealed class Entry
        {
            public string Name;
            public string Kit;
            public IPotNativeBlock Impl;
            public PotBatch Batch;
            public bool Bound;
        }

        static Dictionary<string, Entry> entries;
        static readonly System.Diagnostics.Stopwatch clock = System.Diagnostics.Stopwatch.StartNew();

        /// <summary>高精度时间（毫秒，起点为首次使用），verify 计时用</summary>
        [Preserve]
        public static double Now() { return clock.Elapsed.TotalMilliseconds; }

        static Dictionary<string, Entry> All
        {
            get
            {
                if (entries != null) return entries;
                entries = new Dictionary<string, Entry>();
                foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
                {
                    Type[] types;
                    try { types = asm.GetTypes(); }
                    catch (ReflectionTypeLoadException e) { types = e.Types; }
                    foreach (var type in types)
                    {
                        if (type == null || type.IsAbstract || !typeof(IPotNativeBlock).IsAssignableFrom(type)) continue;
                        var attr = type.GetCustomAttribute<PotBlockAttribute>();
                        if (attr == null) continue;
                        try
                        {
                            var impl = (IPotNativeBlock)Activator.CreateInstance(type);
                            if (entries.ContainsKey(attr.Name)) { Debug.LogWarning("[pot] 原生积木重名，忽略 " + type.FullName); continue; }
                            entries[attr.Name] = new Entry { Name = attr.Name, Kit = attr.Kit ?? "", Impl = impl, Batch = new PotBatch(impl.Layout) };
                        }
                        catch (Exception e) { Debug.LogWarning("[pot] 原生积木 " + type.FullName + " 创建失败：" + e.Message); }
                    }
                }
                return entries;
            }
        }

        /// <summary>JSON：[{ name, kit, layout, collision }]</summary>
        [Preserve]
        public static string Blocks()
        {
            var sb = new StringBuilder("[");
            var first = true;
            foreach (var e in All.Values)
            {
                if (!first) sb.Append(',');
                first = false;
                sb.Append("{\"name\":").Append(Json.Quote(e.Name))
                  .Append(",\"kit\":").Append(Json.Quote(e.Kit))
                  .Append(",\"layout\":").Append(Json.Quote(e.Impl.Layout))
                  .Append(",\"collision\":").Append(e.Impl.UsesCollision ? "true" : "false").Append('}');
            }
            return sb.Append(']').ToString();
        }

        /// <summary>执行一个积木的 step：缓冲区进、同格式的缓冲区出</summary>
        [Preserve]
        public static Puerts.ArrayBuffer Step(string name, Puerts.ArrayBuffer buf)
        {
            if (!All.TryGetValue(name, out var e)) throw new ArgumentException("没有原生积木 " + name);
            if (buf == null || buf.Bytes == null || buf.Count < PotBatch.BufferHead * 8) throw new ArgumentException("缓冲区为空");
            var b = e.Batch;
            var n = buf.Count / 8;
            if (b.Data.Length != n) b.Data = new double[n];
            Buffer.BlockCopy(buf.Bytes, 0, b.Data, 0, n * 8);
            b.Count = (int)b.Data[0];
            if ((int)b.Data[1] != b.Stride) throw new ArgumentException("每实体槽数不符：" + b.Data[1] + "，原生布局为 " + b.Stride);
            if (PotBatch.BufferHead + b.Count * b.Stride != n) throw new ArgumentException("缓冲区长度不符");
            b.Dt = b.Data[2];
            b.Tick = b.Data[3];
            if (!e.Bound) { e.Impl.Bind(b); e.Bound = true; }
            e.Impl.Step(b);
            var bytes = new byte[n * 8];
            Buffer.BlockCopy(b.Data, 0, bytes, 0, n * 8);
            return new Puerts.ArrayBuffer(bytes);
        }

        /// <summary>碰撞体表（18.6）</summary>
        [Preserve]
        public static void Bodies(Puerts.ArrayBuffer buf)
        {
            if (buf == null || buf.Bytes == null) return;
            var data = new double[buf.Count / 8];
            Buffer.BlockCopy(buf.Bytes, 0, data, 0, data.Length * 8);
            PotCollide.Load(data);
        }
    }
}
