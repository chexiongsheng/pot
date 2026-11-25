using System;
using System.Collections.Generic;
using UnityEngine.Scripting;

namespace Pot
{
    /// <summary>
    /// 标记一个积木的原生实现（004 第 18.4 节）。Kit 为空表示系统积木，否则是套件名；
    /// 只有登记表里这个积木的来源与之对应（system 或 kit:名字）时才会被使用。
    /// 实现类还要加 [Preserve]，否则 IL2CPP 裁剪会把它去掉。
    /// </summary>
    [AttributeUsage(AttributeTargets.Class, Inherited = false)]
    public sealed class PotBlockAttribute : Attribute
    {
        public readonly string Name;
        public string Kit = "";

        public PotBlockAttribute(string name) { Name = name; }
    }

    /// <summary>
    /// 积木的原生实现：只替换 step。Layout 必须与 TS 侧推出的规范布局字符串逐字相同（pot blocks --name 输出）。
    /// </summary>
    public interface IPotNativeBlock
    {
        string Layout { get; }
        /// <summary>Step 里会调用 PotCollide；为真时 JS 在调用前同步碰撞体</summary>
        bool UsesCollision { get; }
        /// <summary>首次使用时调用一次，取字段偏移（b.Offset("speed")）</summary>
        void Bind(PotBatch b);
        /// <summary>对 b 里的全部实体执行一步，结果原地写回 b.Data</summary>
        void Step(PotBatch b);
    }

    /// <summary>
    /// 一批实体的数据（18.5）：Data 的头部为 [数量, 每实体槽数, dt, tick]，
    /// 之后每个实体 [id, pos×3, rot×3, 布局字段…]，字段偏移由布局字符串算出。
    /// </summary>
    public sealed class PotBatch
    {
        public const int BufferHead = 4;
        public const int EntityHead = 7;
        /// <summary>实体记录里 pos、rot 的偏移</summary>
        public const int Id = 0, PosX = 1, PosY = 2, PosZ = 3, RotX = 4, RotY = 5, RotZ = 6;

        public readonly string Layout;
        public readonly int Stride;
        public double[] Data = new double[0];
        public int Count;
        public double Dt;
        public double Tick;

        readonly Dictionary<string, int> offsets = new Dictionary<string, int>();

        public PotBatch(string layout)
        {
            Layout = layout;
            var bar = layout.IndexOf('|');
            var offset = EntityHead;
            if (bar >= 0 && bar < layout.Length - 1)
            {
                foreach (var item in layout.Substring(bar + 1).Split(';'))
                {
                    var colon = item.LastIndexOf(':');
                    if (colon <= 0) throw new ArgumentException("布局条目格式不对：" + item);
                    var path = item.Substring(0, colon);
                    var slots = SlotsOf(item.Substring(colon + 1));
                    if (slots <= 0) throw new ArgumentException("布局类型未知：" + item);
                    offsets[path] = offset;
                    offset += slots;
                }
            }
            Stride = offset;
        }

        /// <summary>类型占的槽数，与 layout.ts 相同</summary>
        public static int SlotsOf(string type)
        {
            switch (type)
            {
                case "f": case "b": case "layers": case "?": return 1;
                case "f?": case "axis": case "action": return 2;
            }
            if (type.Length > 1 && type[0] == 'f' && int.TryParse(type.Substring(1), out var n) && n > 0) return n;
            return 0;
        }

        /// <summary>字段在实体记录里的偏移；没有这个字段时抛错</summary>
        public int Offset(string path)
        {
            if (!offsets.TryGetValue(path, out var o)) throw new ArgumentException("布局 " + Layout + " 里没有字段 " + path);
            return o;
        }

        /// <summary>第 i 个实体记录在 Data 里的起点</summary>
        public int Base(int i) { return BufferHead + i * Stride; }
    }
}
