/**
 * 菜单（界面树，004 第 19.5 节第 9 步）：标题、暂停、阵亡、结算简报，以及设置、操作说明、项目介绍面板。
 * 鼠标锁定、Esc 暂停与继续、失焦暂停也在这里（ui.input 判断，ui.emit 发流程事件）；改设置走 ui.emit('slSet')。
 * 打开的面板记在 ui.local.panel。
 *
 * 四个画面：
 * - 标题：大字 SALTLINE 和一句任务简介，开始行动、设置、项目介绍；背后是导演的巡游镜头
 * - 暂停：“已暂停”，继续游戏、设置、操作说明、重新开始任务
 * - 阵亡：“信号中断”，生存时间与已切断中继数，重试（也可以按回车）
 * - 结算：“Saltline 港区已解除封锁”，行动评级（险象环生到完美突击）与用时、命中率、击毁、弱点命中、重新部署次数，
 *   再次出击或返回标题
 */
import type { GameUI, UIService, World } from '@pot/core'
import { formatTime } from '@pot/kit/realistic/math'
import { sfx } from '@pot/kit/realistic/sfx'
import { C } from './palette'
import { phaseOf, type FlowEvent, type Settings, type Sl } from './state'

/** 操作说明面板的键位表 */
const CONTROLS: [string, string][] = [
  ['W A S D', '移动'], ['鼠标', '视角'], ['鼠标左键', '射击'], ['鼠标右键', '瞄准'], ['R', '换弹'],
  ['空格', '跳跃'], ['左 Shift', '冲刺'], ['C / 左 Ctrl', '蹲伏'], ['E（按住）', '切断中继'], ['Esc', '暂停'],
]

/** 原版 m-legend 的两行操作速览（宽度 ≥ 1180 时显示） */
const LEGEND: [string, string][][] = [
  [['W A S D', '移动'], ['鼠标', '视角'], ['左键', '开火'], ['右键', '瞄准'], ['R', '换弹']],
  [['E', '切断中继'], ['Space', '跳跃'], ['Shift', '冲刺'], ['C', '蹲伏'], ['Esc', '暂停']],
]

/** 项目介绍面板的三段文字 */
const ABOUT = [
  '《Saltline》是一部单关卡第一人称射击短篇，原作由 Felix Rieseberg 使用 Claude Fable 5.2 制作。',
  '你将潜入暴雨中的港区，切断堆场、仓库与码头的三处中继，在机械飞鸥与机械猎犬的围攻中撤离。',
  '本版本使用 pot 框架重制：关卡、数值与流程全部来自数据文件，几何、音效均由代码生成，支持热重载。',
]

/** 原版 CSS 变量里没进 palette 的几个色 */
const SIGNAL_HOT = '#ffc977'
const BONE_DIM = '#e8e4daa3'

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)

/**
 * 评级：用时、命中率、是否无重试。用时 4 分半内 2 分、6 分 40 秒内 1 分；命中率 50% 以上 2 分、30% 以上 1 分；
 * 没重试过 1 分。共 0 到 5 分，对应 flow.json 的六个评级名（险象环生、火力全开、稳扎稳打、干净利落、精准果断、完美突击）
 */
function rating(g: Sl, ratings: string[]) {
  const acc = g.stats.shots ? g.stats.hits / g.stats.shots : 0
  const score = (g.time < 270 ? 2 : g.time < 400 ? 1 : 0) + (acc >= 0.5 ? 2 : acc >= 0.3 ? 1 : 0) + (g.retries === 0 ? 1 : 0)
  return { acc, score, label: ratings[Math.min(ratings.length - 1, score)] }
}

/** flow.json（评级名）与画质档位名只读一次（界面每帧求值） */
let cached: { flow: any; qualityNames: string[] } | undefined
function data(ui: GameUI) {
  return (cached ??= { flow: ui.data.load('flow.json'), qualityNames: ui.data.load('tuning.json').quality.names })
}

type Box = { x: number; y: number; w: number; h: number; alpha: number }
type Act = { id: string; label: string; primary?: boolean; run: () => void }

/** 界面上下文：发流程事件（同时关掉面板、响一声按钮音）、开面板、鼠标移到按钮上的轻响、改设置 */
function menuApi(ui: GameUI) {
  const L = ui.local
  return {
    send(name: FlowEvent, payload?: { mode: 'fresh' | 'retry' }) {
      ui.audio.play(sfx('ui'), { volume: 0.5 })
      L.panel = ''
      ui.emit(name, payload)
    },
    open(panel: string) {
      ui.audio.play(sfx('ui'), { volume: 0.5 })
      L.panel = panel
    },
    hover() { ui.audio.play(sfx('ui'), { volume: 0.2, pitch: 1.4 }) },
    set(patch: Partial<Settings>) { ui.emit('slSet', patch) },
  }
}
type Api = ReturnType<typeof menuApi>

export function Menu({ w, ui }: { w: World; ui: GameUI }) {
  const sl: Sl = w.vars.sl
  if (!sl) return null
  const ph = phaseOf(w), L = ui.local, input = ui.input, api = menuApi(ui)
  // 鼠标锁定（只在 intro、playing）：任务中鼠标藏起来用来转视角，菜单里放出来点按钮
  const wantLock = ph === 'playing' || ph === 'intro'
  if (input.cursor() !== wantLock && (wantLock ? input.focused() : true)) input.cursor(wantLock)
  // 暂停：Esc 或失焦；暂停中 Esc 先关面板，没有面板才继续
  const focus = input.focused()
  if (wantLock && (input.pressed('escape') || (L.lastFocus !== false && !focus))) {
    L.lastFocus = focus
    L.panel = ''
    ui.emit('slPause')
    return null
  }
  L.lastFocus = focus
  if (L.panel && input.pressed('escape')) L.panel = ''
  else if (ph === 'paused' && input.pressed('escape')) {
    ui.emit('slResume')
    return null
  }
  // 任务中不画菜单
  if (wantLock) return null
  const W = ui.width, H = ui.height
  if (L.panel) return <Panel w={w} ui={ui} api={api} W={W} H={H} />
  const { flow } = data(ui)

  // 标题画面
  if (ph === 'title') {
    const items: Act[] = [
      { id: 'start', label: '开始行动', primary: true, run: () => api.send('slStart') },
      { id: 'settings', label: '设置', run: () => api.open('settings') },
      { id: 'about', label: '项目介绍', run: () => api.open('about') },
    ]
    // 窄屏放不下右下角的操作速览，改成一个“操作说明”按钮
    if (W < 1180) items.push({ id: 'controls', label: '操作说明', run: () => api.open('controls') })
    const ps = Math.round(clamp(W * 0.0155, 17, 22))
    return <Page W={W} H={H} t={sl.t} a={1} legend={W >= 1180}
      foot="原作 Saltline · Felix Rieseberg × Claude Fable 5.2 · pot 移植版">
      <Heading eyebrow="港务局突击小队" title="SALTLINE" size={Math.round(clamp(W * 0.155, 52, 208))} tag="B4" extra="Saltline 港区 · 05:42" maxW={W - 2 * margin(W)} />
      <column gap={13} pad={[34, 0, 0, 0]} w={Math.min(620, W - margin(W) * 2)}>
        <canvas w={Math.min(620, W - margin(W) * 2)} h={3} draw={(d: UIService, b: Box) => {
          d.rect(b.x, b.y, b.w, 1, C.bone, { alpha: 0.2 * b.alpha })
          d.rect(b.x, b.y, 72, 3, C.signal, { alpha: b.alpha })
        }} />
        <text size={ps} color={C.bone} opacity={0.9}>港区防御系统失控。切断三处中继，突破封锁，登船撤离。</text>
      </column>
      <Buttons items={items} api={api} />
    </Page>
  }

  // 暂停画面（世界冻结在背后）
  if (ph === 'paused') {
    return <Page W={W} H={H} t={1} a={1} foot={`任务用时 ${formatTime(sl.time)}`}>
      <Heading eyebrow="行动暂时中止" title="已暂停" size={Math.round(clamp(W * 0.08, 44, 120))} />
      <Buttons pad={30} api={api} items={[
        { id: 'resume', label: '继续游戏', primary: true, run: () => api.send('slResume') },
        { id: 'settings', label: '设置', run: () => api.open('settings') },
        { id: 'controls', label: '操作说明', run: () => api.open('controls') },
        { id: 'restart', label: '重新开始任务', run: () => api.send('slRestart', { mode: 'fresh' }) },
      ]} />
    </Page>
  }

  // 阵亡画面：倒下 1 秒后浮现，再过 1 秒出现“重试”，此时回车也能重试
  if (ph === 'dead') {
    if (sl.t < 1) return null
    const a = clamp(sl.t - 1, 0, 1)
    if (a >= 1 && input.pressed('return')) api.send('slRetry', { mode: 'retry' })
    const cut = sl.relays.filter((r) => r === 'cut').length
    return <Page W={W} H={H} t={sl.t - 1} a={a}>
      <Heading eyebrow="突击队员倒下" title="信号中断" size={Math.round(clamp(W * 0.08, 44, 120))} tag="!" tagColor={C.alarm} />
      <Stats items={[['生存时间', formatTime(sl.time)], ['已切断中继', `${cut} / ${sl.relays.length}`]]} />
      <Buttons pad={30} hidden={a < 1} api={api} items={[{ id: 'retry', label: '重试', primary: true, run: () => api.send('slRetry', { mode: 'retry' }) }]} />
    </Page>
  }

  // 结算简报：登艇 1.2 秒后浮现，评级用 5 格进度条表示得了几分
  if (ph === 'complete') {
    if (sl.t < 1.2) return null
    const a = clamp((sl.t - 1.2) * 2, 0, 1)
    const r = rating(sl, flow.ratings)
    return <Page W={W} H={H} t={sl.t - 1.2} a={a}>
      <Heading eyebrow="四号泊位 · 行动简报" title="Saltline 港区已解除封锁" size={Math.round(clamp(W * 0.05, 36, 72))} />
      <column gap={2} pad={[30, 0, 0, 0]}>
        <text size={11} weight={500} spacing={0.2} color={C.steel}>行动评级</text>
        <row gap={20} align="center">
          <text size={30} weight={900} color={C.signal}>{r.label}</text>
          <row gap={6}>{[0, 1, 2, 3, 4].map((i) => <panel key={i} w={16} h={6} radius={0} pad={0} bg={i < r.score ? C.signal : C.steel + '59'} />)}</row>
        </row>
      </column>
      <Stats items={[
        ['用时', formatTime(sl.time)], ['命中率', `${Math.round(r.acc * 100)}%`], ['击毁目标', String(sl.stats.kills)],
        ['弱点命中', String(sl.stats.weak)], ['重新部署', `${sl.retries}`],
      ]} />
      <Buttons pad={30} hidden={a < 1} api={api} items={[
        { id: 'again', label: '再次出击', primary: true, run: () => api.send('slRestart', { mode: 'fresh' }) },
        { id: 'title', label: '返回标题', run: () => api.send('slTitle') },
      ]} />
    </Page>
  }
  return null
}

const margin = (W: number) => Math.round(Math.max(24, W * 0.055))

/** 页面骨架（原版 m-veil、m-bars）：渐变遮罩、上下黑边，内容左下对齐；foot 为底部小字 */
function Page({ W, H, t, a, foot, legend, children }: { W: number; H: number; t: number; a: number; foot?: string; legend?: boolean; children?: any }) {
  const bar = clamp(H * 0.055, 14, 52)
  const x = margin(W), bottom = H - bar - Math.max(24, H * 0.07)
  return <>
    <canvas at={[0, 0]} w={W} h={H} draw={(d: UIService) => {
      // 原版 linear-gradient(90deg, ink .82 0%, .5 38%, 0 72%), linear-gradient(0deg, ink .7 0%, 0 46%)；CSS 先列的在上层
      d.gradient(0, 0, W, H, [['rgba(6,8,10,.7)', 0], ['rgba(6,8,10,0)', 0.46]], { angle: 0, alpha: a })
      d.gradient(0, 0, W, H, [['rgba(6,8,10,.82)', 0], ['rgba(6,8,10,.5)', 0.38], ['rgba(6,8,10,0)', 0.72]], { angle: 90, alpha: a })
      const k = clamp(t / 0.7, 0, 1), e = 1 - (1 - k) ** 3
      d.rect(0, 0, W, bar * e, '#000000')
      d.rect(0, H - bar * e, W, bar * e, '#000000')
    }} />
    <column at={[0, 0]} w={W} h={H} justify="end" pad={[0, x, H - bottom, x]} opacity={a}>
      {children}
      {foot && <text size={11} color={C.steel} pad={[8, 0, 0, 0]}>{foot}</text>}
    </column>
    {legend && <column at={[0, 0]} w={W} h={H} justify="end" align="end" gap={8} pad={[0, x, H - bottom, x]}>
      {LEGEND.map((line, i) => <row key={i} gap={18}>{line.map(([k, v]) => <row key={k} gap={6}>
        <text size={12} weight={500} spacing={0.16} color={C.signal} opacity={0.78}>{k}</text>
        <text size={12} weight={500} spacing={0.16} color={C.bone} opacity={0.78}>{v}</text>
      </row>)}</row>)}
    </column>}
  </>
}

/** eyebrow（可带标签块）+ 大标题；标题按可用宽度收窄字号 */
function Heading({ eyebrow, title, size, tag, tagColor = C.signal, extra, maxW }: { eyebrow: string; title: string; size: number; tag?: string; tagColor?: string; extra?: string; maxW?: number }) {
  // 原版用窄体显示字体，这里粗估宽度（每字约 0.75 em + 字距），超出可用宽度时收窄字号，避免 SALTLINE 溢出屏幕
  let hs = size
  if (maxW) {
    const est = title.length * hs * (0.75 + 0.15)
    if (est > maxW) hs = Math.max(40, Math.floor(hs * maxW / est))
  }
  return <column gap={4}>
    <row gap={12} align="center">
      {tag && <panel bg={tagColor} radius={0} pad={[2, 8]}><text size={15} weight={900} spacing={0.1} color={C.ink}>{tag}</text></panel>}
      <text size={13} weight={600} spacing={0.24} color={C.bone}>{eyebrow}</text>
      {extra && <text size={13} weight={600} spacing={0.24} color={BONE_DIM}>{extra}</text>}
    </row>
    <text size={hs} weight={900} spacing={0.15} color={C.bone} shadow>{title}</text>
  </column>
}

/** 原版 m-btn：主按钮 signal 底 ink 字 18px 字距 .3em 高 52；次按钮半透明 ink 底 + bone .42 边框 15px 字距 .22em 高 46 */
function Buttons({ items, api, pad = 22, hidden }: { items: Act[]; api: Api; pad?: number; hidden?: boolean }) {
  return <row gap={10} align="center" pad={[pad, 0, 0, 0]} hidden={hidden}>
    {items.map((b) => b.primary
      ? <button key={b.id} h={52} pad={[0, 32]} radius={0} bg={C.signal} hoverBg={SIGNAL_HOT} color={C.ink} size={18} weight={600} spacing={0.3} onHover={api.hover} onPress={b.run}>{b.label}</button>
      : <button key={b.id} h={46} pad={[0, 24]} radius={0} bg={C.ink + '8c'} hoverBg={C.bone + '1f'} border={C.bone + '6b'} color={C.bone} size={15} weight={600} spacing={0.22} onHover={api.hover} onPress={b.run}>{b.label}</button>)}
  </row>
}

/** 统计格：小号 steel 标签 + 大号数值，每格 150 宽 */
function Stats({ items }: { items: [string, string][] }) {
  return <row pad={[30, 0, 0, 0]}>
    {items.map(([k, v]) => <column key={k} w={150} gap={4}>
      <text size={11} weight={500} spacing={0.2} color={C.steel}>{k}</text>
      <text size={26} weight={500} color={C.bone}>{v}</text>
    </column>)}
  </row>
}

/** 设置（鼠标灵敏度、视野、音量、反转垂直视角、四档画质）、操作说明、项目介绍面板；点“返回”或按 Esc 关闭 */
function Panel({ w, ui, api, W, H }: { w: World; ui: GameUI; api: Api; W: number; H: number }) {
  const L = ui.local
  const pw = Math.min(560, W - 80), cw = pw - 56
  const title = L.panel === 'settings' ? '设置' : L.panel === 'controls' ? '操作说明' : '项目介绍'
  const s: Settings = w.vars.slSettings
  const { qualityNames } = data(ui)
  const close = () => { L.panel = ''; ui.audio.play(sfx('ui'), { volume: 0.5 }) }
  const slider = (label: string, value: number, min: number, max: number, text: string, set: (v: number) => void) => <column key={label} w={cw} gap={8}>
    <row w={cw} justify="between">
      <text size={15} color={C.bone}>{label}</text>
      <text size={15} weight={500} color={C.signal}>{text}</text>
    </row>
    <slider w={cw} h={20} value={value} min={min} max={max} color={C.signal} bg={C.steel + '59'} knob={C.bone} onChange={set} />
  </column>
  return <>
    <panel at={[0, 0]} w={W} h={H} bg={C.ink + '8c'} radius={0} pad={0} />
    <column at="center" w={pw}>
      <panel w={pw} h={4} bg={C.signal} radius={0} pad={0} />
      <panel w={pw} h={436} bg={C.ink + 'eb'} radius={0} pad={[22, 28, 24, 28]} gap={18}>
        <text size={24} weight={600} color={C.bone}>{title}</text>
        <column grow={1} gap={L.panel === 'controls' ? 6 : 18}>
          {L.panel === 'settings' ? <>
            {slider('鼠标灵敏度', s.sensitivity, 0.2, 3, s.sensitivity.toFixed(2), (v) => api.set({ sensitivity: Math.round(v * 100) / 100 }))}
            {slider('视野', s.fov, 60, 100, `${Math.round(s.fov)}°`, (v) => api.set({ fov: Math.round(v) }))}
            {slider('音量', s.volume, 0, 1, `${Math.round(s.volume * 100)}%`, (v) => api.set({ volume: Math.round(v * 100) / 100 }))}
            <row w={cw} justify="between" align="center">
              <text size={15} color={C.bone}>反转垂直视角</text>
              <button w={56} h={26} radius={13} pad={0} size={13} weight={600} bg={s.invertY ? C.signal : C.steel + '66'} color={s.invertY ? C.ink : C.bone}
                onPress={() => { ui.audio.play(sfx('ui'), { volume: 0.4 }); api.set({ invertY: !s.invertY }) }}>{s.invertY ? '开' : '关'}</button>
            </row>
            <row w={cw} justify="between" align="center">
              <text size={15} color={C.bone}>画质</text>
              <row gap={6}>{qualityNames.map((label, i) => {
                const on = (s.quality ?? 2) === i
                return <button key={label} w={64} h={28} radius={3} pad={0} size={14} weight={600} bg={on ? C.signal : C.steel + '40'} color={on ? C.ink : C.bone}
                  onPress={() => { if (!on) { ui.audio.play(sfx('ui'), { volume: 0.4 }); api.set({ quality: i }) } }}>{label}</button>
              })}</row>
            </row>
          </> : L.panel === 'controls' ? CONTROLS.map(([k, v]) => <row key={k} gap={20} align="center">
            <panel w={150} h={24} bg={C.steel + '2e'} radius={3} pad={0} align="center" justify="center">
              <text size={14} weight={500} color={C.signal}>{k}</text>
            </panel>
            <text size={15} color={C.bone}>{v}</text>
          </row>) : ABOUT.map((t, i) => <text key={i} size={15} color={C.bone} wrap w={cw}>{t}</text>)}
        </column>
        <row w={cw} justify="end">
          <button w={140} h={40} radius={3} bg={C.ink + '99'} hoverBg={C.bone} hoverColor={C.ink} border={C.steel + 'b3'} color={C.bone} size={17} weight={600}
            onHover={api.hover} onPress={close}>返回</button>
        </row>
      </panel>
    </column>
  </>
}
