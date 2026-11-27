/**
 * Web 宿主的音频（004 第 20.10 节 web-2）：audioClip / audioHas / audioPlay / audioLoop / audioSetLoop / audioStop /
 * audioVolume / audioPause 的语义与 PotAudio.cs 一致。用假的 AudioContext 记录节点连接与参数。
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadWebPot } = require('./helpers')

const web = () => loadWebPot().web

function param(v = 0) {
  return { value: v }
}

function node(kind, ctx) {
  return {
    kind,
    outputs: [],
    connect(dest) {
      this.outputs.push(dest)
      return dest
    },
    disconnect() {
      this.outputs = []
    },
  }
}

function fakeContext() {
  const ctx = {
    state: 'suspended',
    destination: { kind: 'destination' },
    listener: { positionX: param(), positionY: param(), positionZ: param(), forwardX: param(), forwardY: param(), forwardZ: param(-1), upX: param(), upY: param(1), upZ: param() },
    buffers: [],
    sources: [],
    panners: [],
    resumed: 0,
    suspended: 0,
    createBuffer(channels, frames, rate) {
      const data = []
      for (let c = 0; c < channels; c++) data.push(new Float32Array(frames))
      const b = { channels, frames, rate, getChannelData: (c) => data[c] }
      ctx.buffers.push(b)
      return b
    },
    createBufferSource() {
      const s = Object.assign(node('source'), {
        buffer: null,
        loop: false,
        playbackRate: param(1),
        onended: null,
        started: false,
        stopped: false,
        start() {
          this.started = true
        },
        stop() {
          this.stopped = true
        },
      })
      ctx.sources.push(s)
      return s
    },
    createGain() {
      return Object.assign(node('gain'), { gain: param(1) })
    },
    createPanner() {
      const p = Object.assign(node('panner'), { panningModel: '', distanceModel: '', refDistance: 1, maxDistance: 10000, rolloffFactor: 1, positionX: param(), positionY: param(), positionZ: param() })
      ctx.panners.push(p)
      return p
    },
    resume() {
      ctx.resumed++
      ctx.state = 'running'
      return Promise.resolve()
    },
    suspend() {
      ctx.suspended++
      ctx.state = 'suspended'
      return Promise.resolve()
    },
  }
  return ctx
}

/** 16 位小端 PCM 的 base64 */
function pcm(samples) {
  const buf = Buffer.alloc(samples.length * 2)
  samples.forEach((s, i) => buf.writeInt16LE(s, i * 2))
  return buf.toString('base64')
}

function fakeHost(audio) {
  const logs = []
  const host = web().createWebHost({
    files: { 'manifest.json': '{"id":"t"}' },
    ui: { submit() {}, measure: () => [0, 0] },
    platform: { screen: () => [800, 600], focused: () => true, cursor() {}, cursorLocked: () => false },
    audio,
    log: (level, text) => logs.push({ level, text }),
  })
  host.logs = logs
  return host
}

test('audioClip 解码 16 位小端 PCM（多声道交错），采样率夹到 8000 到 96000', () => {
  const audio = new (web().WebAudio)(null)
  const e = fakeHost(audio).engine
  assert.equal(e.audioHas('a'), false)
  assert.equal(e.audioClip('a', 22050, 2, pcm([16384, -32768, 0, 32767, -16384])), true)
  assert.equal(e.audioHas('a'), true)
  const clip = audio.clips.get('a')
  assert.equal(clip.channels, 2)
  assert.equal(clip.frames, 2, '多出的半帧丢弃')
  assert.deepEqual(Array.from(clip.data[0]), [0.5, 0])
  assert.deepEqual(Array.from(clip.data[1]), [-1, 32767 / 32768])
  e.audioClip('lo', 100, 1, pcm([1]))
  e.audioClip('hi', 500000, 1, pcm([1]))
  assert.equal(audio.clips.get('lo').rate, 8000)
  assert.equal(audio.clips.get('hi').rate, 96000)
  assert.equal(e.audioClip('empty', 44100, 1, ''), false)
  assert.equal(e.audioHas('empty'), false)
})

test('没有 AudioContext 时播放静默：loop 仍返回句柄，未知片段返回 0', () => {
  const audio = new (web().WebAudio)(null)
  const host = fakeHost(audio)
  const e = host.engine
  e.audioClip('a', 44100, 1, pcm([1, 2, 3]))
  e.audioPlay('a', 1, 1, 0, 0, 0, false)
  assert.equal(audio.oneshots.length, 0)
  const h = e.audioLoop('a', 0.5, 1)
  assert.ok(h > 0)
  assert.equal(e.audioLoop('nope', 1, 1), 0)
  e.audioSetLoop(h, -1, 0, 1, 2, 3, true)
  e.audioStop(h)
  assert.equal(audio.loops.size, 0)
  assert.equal(host.unsupported.size, 0, '音频方法都已实现')
  assert.equal(host.logs.length, 0)
})

test('一次性声音：节点链 source → gain → master → destination，池满 24 个时停最早的，结束后出池', () => {
  const ctx = fakeContext()
  const audio = new (web().WebAudio)(() => ctx)
  const e = fakeHost(audio).engine
  e.audioClip('a', 44100, 1, pcm([1, 2, 3, 4]))
  e.audioPlay('a', 0.7, 0, 0, 0, 0, false)
  const src = ctx.sources[0]
  assert.equal(src.started, true)
  assert.equal(src.loop, false)
  assert.equal(src.playbackRate.value, 1, 'pitch ≤ 0 视为 1')
  const gain = src.outputs[0]
  assert.equal(gain.gain.value, 0.7)
  const master = gain.outputs[0]
  assert.equal(master.outputs[0], ctx.destination)
  assert.equal(ctx.buffers.length, 1)
  for (let i = 0; i < 30; i++) e.audioPlay('a', 1, 1, 0, 0, 0, false)
  assert.equal(audio.oneshots.length, 24)
  assert.equal(ctx.buffers.length, 1, '片段缓冲只上传一次')
  assert.equal(ctx.sources.filter((s) => s.stopped).length, 7)
  const last = audio.oneshots[audio.oneshots.length - 1].source
  last.onended()
  assert.equal(audio.oneshots.length, 23)
})

test('空间声音：线性衰减 2 到 70 米，Unity 的 z 取反；监听者跟随相机', () => {
  const ctx = fakeContext()
  const audio = new (web().WebAudio)(() => ctx)
  const e = fakeHost(audio).engine
  e.audioClip('a', 44100, 1, pcm([1, 2]))
  e.audioPlay('a', 1, 1, 1, 2, 3, true)
  const p = ctx.panners[0]
  assert.equal(p.distanceModel, 'linear')
  assert.equal(p.refDistance, 2)
  assert.equal(p.maxDistance, 70)
  assert.deepEqual([p.positionX.value, p.positionY.value, p.positionZ.value], [1, 2, -3])
  const gain = ctx.sources[0].outputs[0]
  assert.equal(gain.outputs[0], p)
  audio.listen([4, 5, 6], [0, 0, 1], [0, 1, 0])
  const l = ctx.listener
  assert.deepEqual([l.positionX.value, l.positionY.value, l.positionZ.value], [4, 5, -6])
  assert.deepEqual([l.forwardX.value, l.forwardY.value, l.forwardZ.value], [0, 0, -1])
  assert.deepEqual([l.upX.value, l.upY.value, l.upZ.value], [0, 1, -0])
})

test('循环声音：setLoop 的负音量与非正 pitch 表示不变，可在空间与非空间之间切换，stop 后句柄失效', () => {
  const ctx = fakeContext()
  const audio = new (web().WebAudio)(() => ctx)
  const e = fakeHost(audio).engine
  e.audioClip('a', 44100, 1, pcm([1, 2]))
  const h = e.audioLoop('a', 0.4, 1.5)
  const src = ctx.sources[0]
  const gain = src.outputs[0]
  assert.equal(src.loop, true)
  assert.equal(src.playbackRate.value, 1.5)
  e.audioSetLoop(h, -1, 0, 0, 0, 0, false)
  assert.equal(gain.gain.value, 0.4)
  assert.equal(src.playbackRate.value, 1.5)
  e.audioSetLoop(h, 0.9, 2, 1, 1, 1, true)
  assert.equal(gain.gain.value, 0.9)
  assert.equal(src.playbackRate.value, 2)
  assert.equal(gain.outputs[0], ctx.panners[0])
  e.audioSetLoop(h, -1, 0, 0, 0, 0, false)
  assert.notEqual(gain.outputs[0], ctx.panners[0], '切回非空间时绕过声像')
  assert.equal(ctx.panners[0].outputs.length, 0)
  src.onended?.()
  assert.equal(audio.loops.size, 1, '循环声音不因 onended 出表')
  e.audioStop(h)
  assert.equal(src.stopped, true)
  assert.equal(audio.loops.size, 0)
  e.audioStop(h)
  e.audioSetLoop(h, 1, 1, 0, 0, 0, false)
})

test('主音量夹到 0 到 1，暂停挂起上下文，暂停中手势不恢复；clear 停声保留片段', async () => {
  const ctx = fakeContext()
  const audio = new (web().WebAudio)(() => ctx)
  const e = fakeHost(audio).engine
  e.audioVolume(3)
  assert.equal(audio.volume, 1)
  e.audioVolume(-1)
  assert.equal(audio.volume, 0)
  e.audioClip('a', 44100, 1, pcm([1, 2]))
  e.audioPlay('a', 1, 1, 0, 0, 0, false)
  const master = ctx.sources[0].outputs[0].outputs[0]
  assert.equal(master.gain.value, 0, '上下文创建时沿用已设的主音量')
  e.audioVolume(0.25)
  assert.equal(master.gain.value, 0.25)
  e.audioPause(true)
  assert.equal(ctx.suspended, 1)
  audio.unlock()
  assert.equal(ctx.resumed, 0)
  e.audioPause(false)
  assert.equal(ctx.resumed, 1)
  const h = e.audioLoop('a', 1, 1)
  audio.clear()
  assert.equal(audio.loops.size, 0)
  assert.equal(audio.oneshots.length, 0)
  assert.equal(audio.volume, 1)
  assert.equal(e.audioHas('a'), true)
  assert.ok(h > 0)
})
