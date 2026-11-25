namespace Pot
{
    /// <summary>
    /// 原生侧的碰撞表（004 第 18.6 节）。第 4 步只保存 JS 发来的碰撞体缓冲区，查询在第 6 步实现。
    /// </summary>
    public static class PotCollide
    {
        /// <summary>最近一次收到的碰撞体数据</summary>
        public static double[] Raw = new double[0];

        public static void Load(double[] data)
        {
            Raw = data ?? new double[0];
        }
    }
}
