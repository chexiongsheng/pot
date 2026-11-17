using System.Globalization;
using System.Text;

namespace Pot
{
    /// <summary>最小 JSON 输出工具（解析用 UnityEngine.JsonUtility）</summary>
    public static class Json
    {
        public static string Quote(string s)
        {
            if (s == null) return "null";
            var sb = new StringBuilder(s.Length + 2);
            sb.Append('"');
            foreach (var c in s)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < 0x20 || c == '\u2028' || c == '\u2029') sb.Append("\\u").Append(((int)c).ToString("x4"));
                        else sb.Append(c);
                        break;
                }
            }
            sb.Append('"');
            return sb.ToString();
        }

        public static string Number(double v)
        {
            return v.ToString("R", CultureInfo.InvariantCulture);
        }

        public static string Bool(bool v)
        {
            return v ? "true" : "false";
        }
    }
}
