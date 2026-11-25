import { defineBlock, defineGame, definePrefab } from '@pot/core'
import topdown from '@pot/kit/topdown'

const Player = definePrefab('player', { tags: ['player'], shape: { kind: 'cube', color: '#4fc3f7' }, moveTopdown: true, trigger: { radius: 0 } })
const Coin = definePrefab('coin', { tags: ['coin'], shape: { kind: 'sphere', scale: 0.5, color: '#ffd54f' }, trigger: { radius: 0.8 }, spin: true })
const pauseKey = defineBlock({ name: 'pauseKey', about: '按 pause 动作暂停', step(me, e, w) { if (w.cmd().pressed('pause')) w.goto('paused') } })

const Menu = (p: { title: string; children?: any }) =>
  <panel at="center" w={320} align="stretch" gap={12} pad={24}>
    <text size={36} bold align="center">{p.title}</text>
    {p.children}
  </panel>

export default defineGame({
  kits: [topdown],
  vars: { score: 0, best: 0 },
  blocks: [pauseKey],
  controls: { actions: { pause: 'escape' } },
  flow: {
    start: 'title',
    states: {
      title: { on: { start: 'play' } },
      play: { on: { pause: 'paused', allCoins: 'over' }, enter: (w) => { w.vars.score = 0 } },
      paused: { pause: true, on: { resume: 'play', quit: 'title' } },
      over: { on: { again: 'play', quit: 'title' } },
    },
  },
  scene: (s) => <>
    <stage background="#1e2230" sun={{ rot: [50, -30, 0], intensity: 1.1 }} camera={{ at: [0, 12, -10], look: [0, 0, 0] }} />
    <entity name="ground" scale={2} shape={{ kind: 'plane', color: '#3a4a3a' }} />
    {s.state === 'play' && <>
      <Player at={[0, 0.5, 0]} pauseKey />
      {s.data.load('coins.json').coins.map((at, i) => <Coin key={i} at={at} />)}
      <rule on="touch" a={Player} b={Coin} do={(w, p, c) => {
        w.destroy(c)
        w.vars.score++
        w.vars.best = Math.max(w.vars.best, w.vars.score)
        if (w.count('coin') === 0) w.emit('allCoins')
      }} />
    </>}
  </>,
  ui: (w) => {
    const f = w.flow.state
    if (f === 'title') return <Menu title="Hello Pot">
      <text align="center" color="#ffffffaa">WASD 移动，吃光金币</text>
      <button emit="start">开始</button>
    </Menu>
    if (f === 'paused') return <Menu title="暂停">
      <button emit="resume">继续</button>
      <button emit="quit" bg="#555a66">回标题</button>
    </Menu>
    if (f === 'over') return <Menu title="吃光了！">
      <text align="center">得分 {w.vars.score}，最好 {w.vars.best}</text>
      <button emit="again">再来一局</button>
      <button emit="quit" bg="#555a66">回标题</button>
    </Menu>
    return <row at="top-left" gap={16} align="center">
      <text size={28}>得分 {w.vars.score}</text>
      <text color="#ffffff88">Esc 暂停</text>
    </row>
  },
})
