using System;
using System.Collections.Generic;

namespace Pot
{
    /// <summary>
    /// 原生侧的碰撞表（004 第 18.6 节）：JS 的 BodyTable 发来的碰撞体快照，查询与 collide.ts 逐行对应。
    ///
    /// 缓冲区：[数量, 每个的槽数 15, 等待销毁的数量, 碰撞体…, 等待销毁的 id…]，
    /// 碰撞体按 id 升序：[id, 形状（0 盒、1 球、2 胶囊）, solid, 层位（-1 为超出 32 层）, 中心×3, min×3, max×3, 半径, 胶囊半段]。
    ///
    /// 候选只按 XZ 包围盒筛（JS 按 4 米的格子筛，范围更大）；多出的那些在精确判定里都不会命中，按 id 升序遍历即可与 JS 结果相同。
    /// </summary>
    public static class PotCollide
    {
        public const int Stride = 15;
        const double EPS = 0.001;
        const double MAX_STEP = 0.2;
        const double MARGIN = 1;

        public struct Body
        {
            public int Id;
            public int Kind;
            public bool Solid;
            public int LayerBit;
            public double Cx, Cy, Cz;
            public double MinX, MinY, MinZ;
            public double MaxX, MaxY, MaxZ;
            public double R, Seg;
        }

        static Body[] bodies = new Body[0];
        static int count;
        static readonly HashSet<int> pending = new HashSet<int>();
        static int[] cand = new int[64];

        /// <summary>碰撞体数量（调试用）</summary>
        public static int Count => count;

        public static void Load(double[] d)
        {
            pending.Clear();
            if (d == null || d.Length < 3) { count = 0; return; }
            var n = (int)d[0];
            var stride = (int)d[1];
            var np = (int)d[2];
            if (stride != Stride || 3 + n * stride + np != d.Length) throw new ArgumentException("碰撞体缓冲区格式不对");
            if (bodies.Length < n) bodies = new Body[Math.Max(n, bodies.Length * 2)];
            for (var i = 0; i < n; i++)
            {
                var o = 3 + i * Stride;
                bodies[i] = new Body
                {
                    Id = (int)d[o], Kind = (int)d[o + 1], Solid = d[o + 2] != 0, LayerBit = (int)d[o + 3],
                    Cx = d[o + 4], Cy = d[o + 5], Cz = d[o + 6],
                    MinX = d[o + 7], MinY = d[o + 8], MinZ = d[o + 9],
                    MaxX = d[o + 10], MaxY = d[o + 11], MaxZ = d[o + 12],
                    R = d[o + 13], Seg = d[o + 14],
                };
            }
            count = n;
            for (var i = 0; i < np; i++) pending.Add((int)d[3 + n * Stride + i]);
        }

        /// <summary>过滤条件：与 World._bodyFilter 相同（solid、跳过自己、层、等待销毁）</summary>
        static bool Pass(ref Body b, uint mask, int skip, bool solidOnly)
        {
            if (solidOnly && !b.Solid) return false;
            if (b.Id == skip) return false;
            if (mask != 0xFFFFFFFFu && (b.LayerBit < 0 || (mask & (1u << b.LayerBit)) == 0)) return false;
            if (pending.Count > 0 && pending.Contains(b.Id)) return false;
            return true;
        }

        /// <summary>XZ 区域内的候选下标，按 id 升序（bodies 已按 id 排好）</summary>
        static int Candidates(double minX, double minZ, double maxX, double maxZ, uint mask, int skip, bool solidOnly)
        {
            var n = 0;
            for (var i = 0; i < count; i++)
            {
                ref var b = ref bodies[i];
                if (b.MaxX < minX || b.MinX > maxX || b.MaxZ < minZ || b.MinZ > maxZ) continue;
                if (!Pass(ref b, mask, skip, solidOnly)) continue;
                if (n == cand.Length) Array.Resize(ref cand, n * 2);
                cand[n++] = i;
            }
            return n;
        }

        // ------------------------------------------------------------ move

        /// <summary>
        /// 运动学角色移动（BodyTable.move）：改 pos、vel、grounded，返回值同 MoveResult 的 grounded。
        /// ground 为空时 hasGround=false；maxX 为 null 时 hasMaxX=false。
        /// </summary>
        public static void Move(double[] pos, int po, double[] vel, int vo, ref bool grounded,
            double r, double h, double stepUp, double dt, bool hasGround, double groundY, bool hasMaxX, double maxX,
            uint mask, int skip)
        {
            var dist = PotMath.Max(PotMath.Max(Math.Abs(vel[vo]), Math.Abs(vel[vo + 1])), Math.Abs(vel[vo + 2])) * dt;
            var nf = PotMath.Min(64, PotMath.Max(1, Math.Ceiling(dist / MAX_STEP)));
            if (double.IsNaN(nf)) return;
            var n = (int)nf;
            for (var i = 0; i < n; i++) Step(pos, po, vel, vo, ref grounded, r, h, stepUp, dt / n, hasGround, groundY, hasMaxX, maxX, mask, skip);
        }

        static bool Hit(ref Body b, double x, double y, double z, double r, double h)
        {
            return x + r > b.MinX && x - r < b.MaxX && z + r > b.MinZ && z - r < b.MaxZ && y + h > b.MinY && y < b.MaxY;
        }

        static bool Blocked(int nc, double x, double y, double z, double r, double h)
        {
            for (var i = 0; i < nc; i++) if (Hit(ref bodies[cand[i]], x, y, z, r, h)) return true;
            return false;
        }

        static void Step(double[] p, int po, double[] v, int vo, ref bool grounded,
            double r, double h, double stepUp, double dt, bool hasGround, double groundY, bool hasMaxX, double maxX,
            uint mask, int skip)
        {
            var wasGrounded = grounded;
            var reach = r + PotMath.Max(Math.Abs(v[vo]), Math.Abs(v[vo + 2])) * dt + MARGIN;
            var nc = Candidates(p[po] - reach, p[po + 2] - reach, p[po] + reach, p[po + 2] + reach, mask, skip, true);

            for (var pass = 0; pass < 2; pass++)
            {
                var axis = pass == 0 ? 0 : 2;
                var d = v[vo + axis] * dt;
                if (!PotMath.Truthy(d)) continue;
                double nx = p[po], ny = p[po + 1], nz = p[po + 2];
                if (axis == 0) nx += d; else nz += d;
                for (var i = 0; i < nc; i++)
                {
                    ref var b = ref bodies[cand[i]];
                    if (!Hit(ref b, nx, ny, nz, r, h)) continue;
                    var rise = b.MaxY - ny;
                    if (wasGrounded && rise > 0 && rise <= stepUp && !Blocked(nc, nx, b.MaxY + EPS, nz, r, h))
                    {
                        ny = b.MaxY + EPS;
                        continue;
                    }
                    if (axis == 0) nx = d > 0 ? b.MinX - r - EPS : b.MaxX + r + EPS;
                    else nz = d > 0 ? b.MinZ - r - EPS : b.MaxZ + r + EPS;
                    v[vo + axis] = 0;
                }
                p[po] = nx;
                p[po + 1] = ny;
                p[po + 2] = nz;
            }

            var dy = v[vo + 1] * dt;
            var nyy = p[po + 1] + dy;
            grounded = false;
            for (var i = 0; i < nc; i++)
            {
                ref var b = ref bodies[cand[i]];
                if (!Hit(ref b, p[po], nyy, p[po + 2], r, h)) continue;
                if (dy <= 0 && b.MaxY <= p[po + 1] + 0.06)
                {
                    nyy = b.MaxY;
                    v[vo + 1] = 0;
                    grounded = true;
                }
                else if (dy > 0 && b.MinY >= p[po + 1] + h - 0.06)
                {
                    nyy = b.MinY - h - EPS;
                    v[vo + 1] = 0;
                }
            }
            var hasFloor = hasGround && (!hasMaxX || p[po] <= maxX);
            if (hasFloor && nyy <= groundY && p[po + 1] >= groundY - 0.3)
            {
                nyy = groundY;
                if (v[vo + 1] < 0) v[vo + 1] = 0;
                grounded = true;
            }
            p[po + 1] = nyy;
            if (!grounded && wasGrounded && v[vo + 1] <= 0)
            {
                double x = p[po], y = p[po + 1], z = p[po + 2];
                const double up = 0.02;
                var has = false;
                double best = 0;
                var gFloor = hasGround && (!hasMaxX || x <= maxX);
                if (gFloor && groundY <= y + up && groundY >= y - stepUp) { best = groundY; has = true; }
                for (var i = 0; i < nc; i++)
                {
                    ref var b = ref bodies[cand[i]];
                    var top = b.MaxY;
                    if (top > y + up || top < y - stepUp) continue;
                    if (x + r > b.MinX && x - r < b.MaxX && z + r > b.MinZ && z - r < b.MaxZ)
                    {
                        if (!has || top > best) { best = top; has = true; }
                    }
                }
                if (has)
                {
                    p[po + 1] = best;
                    v[vo + 1] = 0;
                    grounded = true;
                }
            }
        }

        // ------------------------------------------------------------ overlap

        /// <summary>与轴对齐盒（中心 at、尺寸 size）重叠的碰撞体是否存在（BodyTable.overlap 的盒分支）</summary>
        public static bool OverlapBoxAny(double ax, double ay, double az, double sx, double sy, double sz, uint mask, int skip, bool solidOnly)
        {
            double hx = sx / 2, hy = sy / 2, hz = sz / 2;
            double minX = ax - hx, minY = ay - hy, minZ = az - hz, maxX = ax + hx, maxY = ay + hy, maxZ = az + hz;
            var nc = Candidates(minX, minZ, maxX, maxZ, mask, skip, solidOnly);
            for (var i = 0; i < nc; i++)
            {
                ref var b = ref bodies[cand[i]];
                bool hits;
                if (b.Kind == 1)
                {
                    double d2 = 0, q;
                    q = Clamp(b.Cx, minX, maxX) - b.Cx; d2 += q * q;
                    q = Clamp(b.Cy, minY, maxY) - b.Cy; d2 += q * q;
                    q = Clamp(b.Cz, minZ, maxZ) - b.Cz; d2 += q * q;
                    hits = d2 < b.R * b.R;
                }
                else
                {
                    hits = minX < b.MaxX && maxX > b.MinX && minY < b.MaxY && maxY > b.MinY && minZ < b.MaxZ && maxZ > b.MinZ;
                }
                if (hits) return true;
            }
            return false;
        }

        /// <summary>collide.ts 的 clamp：v &lt; lo ? lo : v &gt; hi ? hi : v</summary>
        static double Clamp(double v, double lo, double hi) { return v < lo ? lo : v > hi ? hi : v; }
    }
}
