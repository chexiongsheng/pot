using UnityEngine.Scripting;

namespace Pot.Blocks
{
    /// <summary>
    /// fps 套件的 moveFps（kits/fps/index.ts）的原生实现，逐句照 TS 翻译（运算顺序相同，超越函数用 PotMath）。
    /// 碰撞用 PotCollide（与 w.move、w.overlap 对应）。
    /// </summary>
    [Preserve, PotBlock("moveFps", Kit = "fps")]
    public sealed class MoveFps : IPotNativeBlock
    {
        public string Layout =>
            "moveFps|walk:f;sprint:f;crouch:f;ads:f;accelGround:f;decelGround:f;accelAir:f;gravity:f;jumpApex:f;coyote:f;jumpBuffer:f;" +
            "stepUp:f;radius:f;height:f;crouchHeight:f;eye:f;crouchEye:f;eyeRate:f;sensitivity:f;adsLook:f;invertY:b;pitchLimit:f;" +
            "stride.walk:f;stride.sprint:f;stride.crouch:f;layers:layers;ground:?;ground.y:f;ground.maxX:f?;" +
            "bounds:?;bounds.min:f2;bounds.max:f2;fallY:f?;" +
            "actions.move:axis;actions.look:axis;actions.jump:action;actions.sprint:action;actions.crouch:action;" +
            "active:b;vel:f3;yaw:f;pitch:f;grounded:b;crouched:b;coyoteT:f;buffer:f;lastSafe:f3;curHeight:f;curEye:f;" +
            "bob:f;speed:f;sprinting:b;landed:f;aim:f";

        public bool UsesCollision => true;

        const double DEG = PotMath.PI / 180;

        int walk, sprint, crouch, ads, accelGround, decelGround, accelAir, gravity, jumpApex, coyote, jumpBuffer;
        int stepUp, radius, height, crouchHeight, eye, crouchEye, eyeRate, sensitivity, adsLook, invertY, pitchLimit;
        int strideWalk, strideSprint, strideCrouch, layers, ground, groundY, groundMaxX, bounds, boundsMin, boundsMax, fallY;
        int aMove, aLook, aJump, aSprint, aCrouch;
        int active, vel, yaw, pitch, grounded, crouched, coyoteT, buffer, lastSafe, curHeight, curEye, bob, speed, sprinting, landed, aim;

        [Preserve] public MoveFps() { }

        public void Bind(PotBatch b)
        {
            walk = b.Offset("walk"); sprint = b.Offset("sprint"); crouch = b.Offset("crouch"); ads = b.Offset("ads");
            accelGround = b.Offset("accelGround"); decelGround = b.Offset("decelGround"); accelAir = b.Offset("accelAir");
            gravity = b.Offset("gravity"); jumpApex = b.Offset("jumpApex"); coyote = b.Offset("coyote"); jumpBuffer = b.Offset("jumpBuffer");
            stepUp = b.Offset("stepUp"); radius = b.Offset("radius"); height = b.Offset("height"); crouchHeight = b.Offset("crouchHeight");
            eye = b.Offset("eye"); crouchEye = b.Offset("crouchEye"); eyeRate = b.Offset("eyeRate"); sensitivity = b.Offset("sensitivity");
            adsLook = b.Offset("adsLook"); invertY = b.Offset("invertY"); pitchLimit = b.Offset("pitchLimit");
            strideWalk = b.Offset("stride.walk"); strideSprint = b.Offset("stride.sprint"); strideCrouch = b.Offset("stride.crouch");
            layers = b.Offset("layers"); ground = b.Offset("ground"); groundY = b.Offset("ground.y"); groundMaxX = b.Offset("ground.maxX");
            bounds = b.Offset("bounds"); boundsMin = b.Offset("bounds.min"); boundsMax = b.Offset("bounds.max"); fallY = b.Offset("fallY");
            aMove = b.Offset("actions.move"); aLook = b.Offset("actions.look"); aJump = b.Offset("actions.jump");
            aSprint = b.Offset("actions.sprint"); aCrouch = b.Offset("actions.crouch");
            active = b.Offset("active"); vel = b.Offset("vel"); yaw = b.Offset("yaw"); pitch = b.Offset("pitch");
            grounded = b.Offset("grounded"); crouched = b.Offset("crouched"); coyoteT = b.Offset("coyoteT"); buffer = b.Offset("buffer");
            lastSafe = b.Offset("lastSafe"); curHeight = b.Offset("curHeight"); curEye = b.Offset("curEye"); bob = b.Offset("bob");
            speed = b.Offset("speed"); sprinting = b.Offset("sprinting"); landed = b.Offset("landed"); aim = b.Offset("aim");
        }

        static double Clamp(double v, double a, double b) { return v < a ? a : v > b ? b : v; }
        static double Damp(double c, double t, double rate, double dt) { return t + (c - t) * PotMath.Exp(-rate * dt); }
        static double B(bool v) { return v ? 1 : 0; }

        bool InBounds(double[] d, int o, double x, double z)
        {
            if (d[o + bounds] == 0) return true;
            var mn = o + boundsMin;
            var mx = o + boundsMax;
            return x >= d[mn] && x <= d[mx] && z >= d[mn + 1] && z <= d[mx + 1];
        }

        public void Step(PotBatch batch)
        {
            var d = batch.Data;
            var dt = batch.Dt;
            for (var i = 0; i < batch.Count; i++)
            {
                var o = batch.Base(i);
                if (d[o + active] == 0) continue;
                var id = (int)d[o + PotBatch.Id];
                var ads_ = d[o + aim];
                var mask = (uint)d[o + layers];

                // 视角
                var lookX = d[o + aLook];
                var lookY = d[o + aLook + 1];
                var k = 2 * d[o + sensitivity] * (ads_ > 0.5 ? d[o + adsLook] : 1);
                d[o + yaw] = (d[o + yaw] + lookX * k) % 360;
                d[o + pitch] = Clamp(d[o + pitch] - lookY * k * (d[o + invertY] != 0 ? -1 : 1), -d[o + pitchLimit], d[o + pitchLimit]);

                // 蹲伏
                if (d[o + aCrouch + 1] != 0) d[o + crouched] = B(d[o + crouched] == 0);
                var isCrouched = d[o + crouched] != 0;
                var targetH = isCrouched ? d[o + crouchHeight] : d[o + height];
                if (!isCrouched && d[o + curHeight] < d[o + height] - 0.01 && HeadBlocked(d, o, mask, id))
                {
                    d[o + crouched] = 1;
                    isCrouched = true;
                }
                else
                {
                    d[o + curHeight] = Damp(d[o + curHeight], targetH, 14, dt);
                }
                d[o + curEye] = Damp(d[o + curEye], isCrouched ? d[o + crouchEye] : d[o + eye], d[o + eyeRate], dt);

                // 移动
                var mx = d[o + aMove];
                var mz = d[o + aMove + 1];
                var ml = PotMath.Hypot(mx, mz);
                if (ml > 1)
                {
                    mx /= ml;
                    mz /= ml;
                }
                var isGrounded = d[o + grounded] != 0;
                var wantsSprint = d[o + aSprint] != 0 && mz > 0.3 && !isCrouched && ads_ < 0.3;
                d[o + sprinting] = B(wantsSprint && isGrounded);
                var spd = isCrouched ? d[o + crouch] : ads_ > 0.5 ? d[o + ads] : wantsSprint ? d[o + sprint] : d[o + walk];
                var y = d[o + yaw] * DEG;
                // forward(yaw)：[sin(y)·cos(0), -sin(0), cos(y)·cos(0)]；right(yaw)：[cos(y), 0, -sin(y)]
                var f0 = PotMath.Sin(y) * PotMath.Cos(0 * DEG);
                var f2 = PotMath.Cos(y) * PotMath.Cos(0 * DEG);
                var r0 = PotMath.Cos(y);
                var r2 = -PotMath.Sin(y);
                var tx = (f0 * mz + r0 * mx) * spd;
                var tz = (f2 * mz + r2 * mx) * spd;
                var accel = isGrounded ? (ml > 0.01 ? d[o + accelGround] : d[o + decelGround]) : d[o + accelAir];
                var v = o + vel;
                var dvx = tx - d[v];
                var dvz = tz - d[v + 2];
                var dl = PotMath.Hypot(dvx, dvz);
                var step = accel * dt;
                if (dl <= step)
                {
                    d[v] = tx;
                    d[v + 2] = tz;
                }
                else
                {
                    d[v] += (dvx / dl) * step;
                    d[v + 2] += (dvz / dl) * step;
                }

                // 跳跃（土狼时间 + 输入缓冲）
                d[o + coyoteT] = isGrounded ? d[o + coyote] : PotMath.Max(0, d[o + coyoteT] - dt);
                d[o + buffer] = d[o + aJump + 1] != 0 ? d[o + jumpBuffer] : PotMath.Max(0, d[o + buffer] - dt);
                if (d[o + buffer] > 0 && d[o + coyoteT] > 0 && !isCrouched)
                {
                    d[v + 1] = PotMath.Sqrt(2 * d[o + gravity] * d[o + jumpApex]);
                    d[o + buffer] = 0;
                    d[o + coyoteT] = 0;
                    isGrounded = false;
                }
                d[v + 1] -= d[o + gravity] * dt;
                var wasAir = !isGrounded;
                var fall = d[v + 1];
                var hasGround = d[o + ground] != 0;
                PotCollide.Move(d, o + PotBatch.PosX, d, v, ref isGrounded,
                    d[o + radius], d[o + curHeight], d[o + stepUp], dt,
                    hasGround, d[o + groundY], hasGround && d[o + groundMaxX] != 0, d[o + groundMaxX + 1],
                    mask, id);
                d[o + grounded] = B(isGrounded);
                d[o + landed] = isGrounded && wasAir ? -fall : 0;

                // 出界、掉出世界：拉回最近的安全点
                var px = o + PotBatch.PosX;
                var outside = !InBounds(d, o, d[px], d[px + 2]) || (d[o + fallY] != 0 && d[px + 1] < d[o + fallY + 1]);
                if (outside)
                {
                    var s = o + lastSafe;
                    d[px] = d[s];
                    d[px + 1] = d[s + 1];
                    d[px + 2] = d[s + 2];
                    d[v] = d[v + 1] = d[v + 2] = 0;
                }
                if (isGrounded && (!hasGround || d[px + 1] >= d[o + groundY] - 0.01) && InBounds(d, o, d[px], d[px + 2]))
                {
                    var s = o + lastSafe;
                    d[s] = d[px];
                    d[s + 1] = d[px + 1];
                    d[s + 2] = d[px + 2];
                }
                d[o + PotBatch.RotX] = 0;
                d[o + PotBatch.RotY] = d[o + yaw];
                d[o + PotBatch.RotZ] = 0;

                // 步伐
                d[o + speed] = PotMath.Hypot(d[v], d[v + 2]);
                if (isGrounded && d[o + speed] > 0.5)
                {
                    var stride = isCrouched ? d[o + strideCrouch] : d[o + sprinting] != 0 ? d[o + strideSprint] : d[o + strideWalk];
                    d[o + bob] += (d[o + speed] / stride) * dt;
                }
            }
        }

        /// <summary>起身时头顶是否被挡（TS 的 headBlocked）</summary>
        bool HeadBlocked(double[] d, int o, uint mask, int id)
        {
            var r = d[o + radius] - 0.02;
            var h = d[o + height] - 0.05;
            var x = d[o + PotBatch.PosX];
            var y = d[o + PotBatch.PosY] + 0.05 + h / 2;
            var z = d[o + PotBatch.PosZ];
            return PotCollide.OverlapBoxAny(x, y, z, 2 * r, h, 2 * r, mask, id, true);
        }
    }
}
