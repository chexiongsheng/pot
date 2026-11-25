import { defineGame, definePrefab } from '@pot/core'
import topdown from '@pot/kit/topdown'

// 预制件：一组积木的组合，可直接当大写标签用。新积木用 defineBlock 定义后写进 defineGame 的 blocks
const Player = definePrefab('player', { tags: ['player'], shape: { kind: 'cube', color: '#4fc3f7' }, moveTopdown: true, trigger: { radius: 0 } })
const Coin = definePrefab('coin', { tags: ['coin'], shape: { kind: 'sphere', scale: 0.5, color: '#ffd54f' }, trigger: { radius: 0.8 }, spin: true })

export default defineGame({
  kits: [topdown],
  // 运行状态只放这里（和积木状态里）；新变量先写进来再跑 pot check，w.vars 才有类型
  vars: { score: 0 },
  flow: {
    start: 'title',
    states: {
      title: { on: { start: 'play' } },
      play: { enter: (w) => { w.vars.score = 0 } },
    },
  },
  // scene 是纯函数：属性是初值，按流程状态决定放什么；逐帧逻辑写在积木的 step 里
  scene: (s) => <>
    <stage background="#1e2230" sun={{ rot: [50, -30, 0] }} camera={{ at: [0, 12, -10], look: [0, 0, 0] }} />
    <entity name="ground" scale={2} shape={{ kind: 'plane', color: '#3a4a3a' }} />
    {s.state === 'play' && <>
      <Player at={[0, 0.5, 0]} />
      {s.data.load('coins.json').coins.map((at, i) => <Coin key={i} at={at} />)}
      <rule on="touch" a={Player} b={Coin} do={(w, p, c) => { w.destroy(c); w.vars.score++ }} />
    </>}
  </>,
  // 界面每帧求值；回调只改 ui.local 或调 ui.emit，不直接改 World
  ui: (w) => w.flow.state === 'title'
    ? <panel at="center" w={320} align="stretch" gap={12} pad={24}>
        <text size={32} bold align="center">My Game</text>
        <button emit="start">开始</button>
      </panel>
    : <text at="top-left" size={28}>得分 {w.vars.score}</text>,
})
