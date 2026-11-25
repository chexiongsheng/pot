import { defineGame } from '@pot/core'
import type { GameUI } from '@pot/core'

interface Question { q: string; options: string[]; answer: number }

const questions = (ui: GameUI): Question[] => ui.data.load('questions.json').questions

const Title = ({ ui }: { ui: GameUI }) => {
  const name = String(ui.local.name ?? '').trim()
  return <panel at="center" w={420} align="stretch" gap={14} pad={28}>
    <text size={36} bold align="center">知识问答</text>
    <text align="center" color="#ffffffaa">输入名字，回车或点开始</text>
    <input w="100%" value={ui.local.name ?? ''} max={12} placeholder="你的名字"
      onChange={(v) => { ui.local.name = v }}
      onSubmit={(v) => { if (v.trim()) ui.emit('start', { name: v.trim() }) }} />
    <button emit="start" payload={{ name }} disabled={!name}>开始</button>
  </panel>
}

export default defineGame({
  vars: { name: '', index: 0, answers: [] as number[], best: 0 },
  flow: {
    start: 'title',
    states: {
      title: { on: { start: 'quiz' } },
      quiz: { enter: (w) => { w.vars.name = w.flow.params.name ?? ''; w.vars.index = 0; w.vars.answers = [] } },
      result: { on: { again: 'title' } },
    },
  },
  scene: (s) => {
    const qs: Question[] = s.data.load('questions.json').questions
    return <>
      <stage background="#14213d" sun={false} camera={{ at: [0, 0, -10], look: [0, 0, 0] }} />
      {s.state === 'quiz' && <rule on="answer" do={(w, p) => {
        w.vars.answers.push(p.choice)
        w.vars.index++
        if (w.vars.index >= qs.length) {
          const right = w.vars.answers.filter((a, i) => a === qs[i].answer).length
          w.vars.best = Math.max(w.vars.best, right)
          w.goto('result')
        }
      }} />}
    </>
  },
  ui: (w, ui) => {
    const qs = questions(ui)
    const state = w.flow.state
    if (state === 'title') return <Title ui={ui} />
    if (state === 'quiz') {
      const i = Math.min(w.vars.index, qs.length - 1)
      const q = qs[i]
      return <panel at="center" w={560} align="stretch" gap={14} pad={24}>
        <row justify="between">
          <text color="#ffffffaa">第 {i + 1} / {qs.length} 题</text>
          <text color="#ffffffaa">{w.vars.name}</text>
        </row>
        <bar value={i} max={qs.length} w="100%" h={8} color="#ffd54f" />
        <text size={24} wrap>{q.q}</text>
        <column gap={8} align="stretch">
          {q.options.map((o, k) => <button key={k} emit="answer" payload={{ choice: k }} bg="#2d4a7a">{'ABCD'[k]}. {o}</button>)}
        </column>
        <text size={13} color="#ffffff66" align="center">Tab / 方向键选择，Enter 确认</text>
      </panel>
    }
    const right = w.vars.answers.filter((a, k) => a === qs[k]?.answer).length
    return <panel at="center" w={560} align="stretch" gap={12} pad={24}>
      <text size={30} bold align="center">{w.vars.name}，答对 {right} / {qs.length}</text>
      <bar value={right} max={qs.length} w="100%" h={10} color={right === qs.length ? '#4caf50' : '#ffd54f'} />
      <text color="#ffffffaa">最好成绩 {w.vars.best}　答题回顾（滚轮或拖动）</text>
      <scroll h={240} gap={8} align="stretch">
        {qs.map((q, k) => {
          const mine = w.vars.answers[k]
          const ok = mine === q.answer
          return <panel key={k} bg="#0f1830" pad={10} gap={4}>
            <text wrap>{k + 1}. {q.q}</text>
            <text color={ok ? '#81c784' : '#e57373'}>你的答案：{q.options[mine] ?? '未答'}{ok ? '　✓' : `　正确：${q.options[q.answer]}`}</text>
          </panel>
        })}
      </scroll>
      <button emit="again">再来一次</button>
    </panel>
  },
})
