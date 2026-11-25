using UnityEngine.Scripting;

namespace Pot.Blocks
{
    /// <summary>
    /// topdown 套件的 moveTopdown（kits/topdown/index.ts）的原生实现：
    /// 读 move 轴，按 speed 改 pos 的 x、z。运算顺序与 TS 相同：pos += x * speed * dt。
    /// </summary>
    [Preserve, PotBlock("moveTopdown", Kit = "topdown")]
    public sealed class MoveTopdown : IPotNativeBlock
    {
        public string Layout => "moveTopdown|@move:axis;speed:f";
        public bool UsesCollision => false;

        int move, speed;

        [Preserve] public MoveTopdown() { }

        public void Bind(PotBatch b)
        {
            move = b.Offset("@move");
            speed = b.Offset("speed");
        }

        public void Step(PotBatch b)
        {
            var d = b.Data;
            var dt = b.Dt;
            for (var i = 0; i < b.Count; i++)
            {
                var o = b.Base(i);
                var x = d[o + move];
                var y = d[o + move + 1];
                // TS 是 if (!x && !y) return：0、-0、NaN 都算“没有”
                if (Falsy(x) && Falsy(y)) continue;
                d[o + PotBatch.PosX] += x * d[o + speed] * dt;
                d[o + PotBatch.PosZ] += y * d[o + speed] * dt;
            }
        }

        static bool Falsy(double v) { return v == 0 || double.IsNaN(v); }
    }
}
