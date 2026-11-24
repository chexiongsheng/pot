import { defineGame } from '@pot/core'

export default defineGame({
  vars: { score: 0 },
  scene: (s) => <>
    <stage background="#1e2230" sun={{ rot: [50, -30, 0], intensity: 1.1 }} camera={{ at: [0, 12, -10], look: [0, 0, 0] }} />
    <ground scale={2} shape={{ color: '#3a4a3a' }} />
    <player at={[0, 0.5, 0]} shape={{ kind: 'cube', color: '#4fc3f7' }} moveTopdown={{ speed: 5 }} />
    {s.data.load('coins.json').coins.map((at, i) => <coin key={i} at={at} />)}
    <rule on="touch" a="player" b="coin" do={(w, p, c) => { w.destroy(c); w.vars.score++ }} />
  </>,
  ui: (w) => <text at="top-left" size={28}>得分 {w.vars.score}</text>,
})
