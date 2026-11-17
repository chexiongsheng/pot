using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Scripting;

namespace Pot
{
    /// <summary>
    /// 音频桥：游戏在 JS 里合成 PCM（资产即代码），以 base64 的 16 位小端单声道传进来注册为片段；
    /// 之后按名字播放（一次性 / 循环）。片段跨冷重启保留，播放中的声音在冷重启时停止。
    /// </summary>
    [Preserve]
    public static class PotAudio
    {
        const int PoolSize = 24;

        static readonly Dictionary<string, AudioClip> clips = new Dictionary<string, AudioClip>();
        static readonly Dictionary<int, AudioSource> loops = new Dictionary<int, AudioSource>();
        static readonly List<AudioSource> pool = new List<AudioSource>();
        static GameObject host;
        static int nextLoop = 1;
        static int poolCursor;

        static GameObject Host
        {
            get
            {
                if (host == null)
                {
                    host = new GameObject("PotAudio");
                    UnityEngine.Object.DontDestroyOnLoad(host);
                    pool.Clear();
                    loops.Clear();
                }
                return host;
            }
        }

        /// <summary>注册（或替换）片段。pcm16 为 base64 编码的 16 位小端 PCM，channels 为声道数</summary>
        [Preserve]
        public static bool Clip(string name, int rate, int channels, string pcm16)
        {
            try
            {
                var bytes = Convert.FromBase64String(pcm16 ?? "");
                channels = Mathf.Max(1, channels);
                var count = bytes.Length / 2;
                var frames = count / channels;
                if (frames <= 0) return false;
                var data = new float[frames * channels];
                for (var i = 0; i < data.Length; i++) data[i] = (short)(bytes[i * 2] | (bytes[i * 2 + 1] << 8)) / 32768f;
                AudioClip old;
                if (clips.TryGetValue(name, out old) && old != null) UnityEngine.Object.Destroy(old);
                var clip = AudioClip.Create(name, frames, channels, Mathf.Clamp(rate, 8000, 96000), false);
                clip.SetData(data, 0);
                clips[name] = clip;
                return true;
            }
            catch (Exception e)
            {
                Debug.LogWarning("[pot] 注册音频 " + name + " 失败：" + e.Message);
                return false;
            }
        }

        [Preserve]
        public static bool HasClip(string name)
        {
            AudioClip clip;
            return clips.TryGetValue(name, out clip) && clip != null;
        }

        static AudioSource NewSource(string label)
        {
            var go = new GameObject(label);
            go.transform.SetParent(Host.transform, false);
            var source = go.AddComponent<AudioSource>();
            source.playOnAwake = false;
            source.rolloffMode = AudioRolloffMode.Linear;
            source.minDistance = 2;
            source.maxDistance = 70;
            source.dopplerLevel = 0;
            return source;
        }

        static void Place(AudioSource source, float x, float y, float z, bool spatial)
        {
            source.spatialBlend = spatial ? 1 : 0;
            if (spatial) source.transform.position = new Vector3(x, y, z);
        }

        /// <summary>一次性播放。spatial=false 时忽略位置（2D 声音）</summary>
        [Preserve]
        public static void Play(string name, float volume, float pitch, float x, float y, float z, bool spatial)
        {
            AudioClip clip;
            if (!clips.TryGetValue(name, out clip) || clip == null) return;
            while (pool.Count < PoolSize) pool.Add(NewSource("oneshot"));
            AudioSource source = null;
            for (var i = 0; i < pool.Count; i++)
            {
                var candidate = pool[(poolCursor + i) % pool.Count];
                if (candidate != null && !candidate.isPlaying)
                {
                    source = candidate;
                    break;
                }
            }
            if (source == null) source = pool[poolCursor % pool.Count];
            poolCursor = (poolCursor + 1) % pool.Count;
            if (source == null) return;
            source.Stop();
            source.clip = clip;
            source.loop = false;
            source.volume = Mathf.Max(0, volume);
            source.pitch = pitch > 0 ? pitch : 1;
            Place(source, x, y, z, spatial);
            source.Play();
        }

        /// <summary>开始循环播放，返回句柄（0 表示片段不存在）</summary>
        [Preserve]
        public static int Loop(string name, float volume, float pitch)
        {
            AudioClip clip;
            if (!clips.TryGetValue(name, out clip) || clip == null) return 0;
            var source = NewSource("loop:" + name);
            source.clip = clip;
            source.loop = true;
            source.volume = Mathf.Max(0, volume);
            source.pitch = pitch > 0 ? pitch : 1;
            source.spatialBlend = 0;
            source.Play();
            var id = nextLoop++;
            loops[id] = source;
            return id;
        }

        /// <summary>调整循环声音；spatial 时使用位置</summary>
        [Preserve]
        public static void SetLoop(int handle, float volume, float pitch, float x, float y, float z, bool spatial)
        {
            AudioSource source;
            if (!loops.TryGetValue(handle, out source) || source == null) return;
            if (volume >= 0) source.volume = volume;
            if (pitch > 0) source.pitch = pitch;
            Place(source, x, y, z, spatial);
        }

        [Preserve]
        public static void StopLoop(int handle)
        {
            AudioSource source;
            if (!loops.TryGetValue(handle, out source)) return;
            loops.Remove(handle);
            if (source != null) UnityEngine.Object.Destroy(source.gameObject);
        }

        /// <summary>主音量（0 到 1）</summary>
        [Preserve]
        public static void Volume(float volume)
        {
            AudioListener.volume = Mathf.Clamp01(volume);
        }

        /// <summary>暂停/恢复全部声音</summary>
        [Preserve]
        public static void Pause(bool paused)
        {
            AudioListener.pause = paused;
        }

        /// <summary>冷重启：停止所有声音（片段保留）</summary>
        public static void Clear()
        {
            foreach (var source in loops.Values) if (source != null) UnityEngine.Object.Destroy(source.gameObject);
            loops.Clear();
            foreach (var source in pool) if (source != null) source.Stop();
            AudioListener.pause = false;
            AudioListener.volume = 1;
        }
    }
}
