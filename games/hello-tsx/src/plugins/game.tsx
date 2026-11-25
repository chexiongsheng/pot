import { defineGame, definePrefab } from '@pot/core'

const Player = definePrefab('player', { tags: ['player'], shape: { kind: 'cube', color: '#4fc3f7' }, moveTopdown: true, trigger: { radius: 0 } })
const Coin = definePrefab('coin', { tags: ['coin'], shape: { kind: 'sphere', scale: 0.5, color: '#ffd54f' }, trigger: { radius: 0.8 }, spin: true })

export default defineGame({
  vars: { score: 0 },
  scene: (s) => <>
    <stage background="#1e2230" sun={{ rot: [50, -30, 0], intensity: 1.1 }} camera={{ at: [0, 12, -10], look: [0, 0, 0] }} />
    <entity name="ground" scale={2} shape={{ kind: 'plane', color: '#3a4a3a' }} />
    <Player at={[0, 0.5, 0]} />
    {s.data.load('coins.json').coins.map((at, i) => <Coin key={i} at={at} />)}
    <rule on="touch" a={Player} b={Coin} do={(w, p, c) => { w.destroy(c); w.vars.score++ }} />
  </>,
  ui: (w) => <text at="top-left" size={28}>得分 {w.vars.score}</text>,
})
