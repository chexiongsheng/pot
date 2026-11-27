/**
 * HUD（界面树，004 第 19.5 节第 9 步）：罗盘、任务目标、生命、弹药、准星与命中标记、击杀信息、无线电字幕、
 * 敌情警告、交互环、渐黑、开场字幕。罗盘与准星用 fps 套件的画法；瞬时提示读 w.vars.slHud（导演的规则写），按 tick 差算年龄。
 *
 * 屏幕布局：左上任务目标（切断中继 n/3、三处中继的清单、任务用时）；顶部中间罗盘（标出没切断的中继、撤离点、
 * 正在交战的敌人）；左下生命（10 格）；右下弹药与枪名；正中准星，准星下方是换弹提示与切断进度环；
 * 右上击杀信息；顶部红框敌情警告；中上消息；底部指挥中心字幕；开场时正中是“行动代号 · 港区突击”。
 */
import type { GameUI, UIService, Vec3, World, EntityData } from '@pot/core'
import { crosshairGap, drawCompass, drawCrosshair } from '@pot/kit/fps/hud'
import { levelPoints, type LevelData } from './level'
import { formatTime } from '@pot/kit/realistic/math'
import { C } from './palette'
import { directorFade } from './director'
import { ageOf, findPlayer, phaseOf, type Settings, type Sl, type SlHud } from './state'

/** 罗盘与交互提示里中继的简称：甲、乙、丙（按 level.json 的顺序） */
const NAMES = ['甲', '乙', '丙', '丁']
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)

/** 数据文件只读一次（界面每帧求值） */
let cached: { tuning: any; points: ReturnType<typeof levelPoints> } | undefined
function data(ui: GameUI) {
  return (cached ??= { tuning: ui.data.load('tuning.json'), points: levelPoints(ui.data.load<LevelData>('level.json')) })
}
const cache = { pid: -1 }

type Box = { x: number; y: number; w: number; h: number; alpha: number }

/** 战斗 HUD：标题画面不画；阵亡、撤离成功时只留字幕和渐黑（菜单盖在上面） */
export function Hud({ w, ui }: { w: World; ui: GameUI }) {
  const ph = phaseOf(w)
  const sl: Sl = w.vars.sl, hud: SlHud = w.vars.slHud
  const p = findPlayer(w, cache)
  if (!sl || !hud || !p || ph === 'title') return null
  const { tuning, points } = data(ui)
  const W = ui.width, H = ui.height
  const fade = directorFade(w)
  const shown = ph === 'playing' || ph === 'intro' || ph === 'paused'
  const g = p.b.gunFps
  // 开场、战斗、暂停时画完整 HUD；准星在暂停时隐去；切断进度环只在战斗中
  return <>
    {shown && <>
      <Compass w={w} p={p} sl={sl} points={points} W={W} />
      <Objectives w={w} sl={sl} points={points} />
      <Health k={p.b.health.hp / p.b.health.max} H={H} />
      {g && <Ammo g={g} name={tuning.weapon.name} W={W} H={H} />}
      {g && ph !== 'paused' && <canvas at={[W / 2 - 60, H / 2 - 60]} w={120} h={120} draw={(d: UIService, b: Box) => drawCrosshair(d, {
        cx: b.x + 60, cy: b.y + 60, gap: crosshairGap(g.spread, (w.vars.slSettings as Settings).fov ?? 74, H), ads: g.ads,
        marker: { age: ageOf(w, hud.marker.at), kill: hud.marker.kill, weak: hud.marker.weak },
        colors: { line: C.bone, dot: C.bone, dotAds: C.alarm, hit: C.bone, weak: C.signal, kill: C.alarm }, alpha: b.alpha,
      })} />}
      {ph === 'playing' && <Interact sl={sl} W={W} H={H} />}
      <Feed w={w} hud={hud} W={W} />
      <Warn w={w} hud={hud} W={W} />
      <Message w={w} hud={hud} W={W} H={H} />
    </>}
    <Radio w={w} hud={hud} W={W} H={H} />
    {/* 全屏渐黑（导演算好的值），开场时再加一行任务字幕 */}
    {fade > 0.001 && <panel at={[0, 0]} w={W} h={H} bg={C.ink} radius={0} pad={0} opacity={fade} />}
    {ph === 'intro' && <column at={[0, H / 2 - 44]} w={W} align="center" gap={6} opacity={clamp(Math.min(sl.t * 2, fade * 2.5), 0, 1)}>
      <text size={34} bold color={C.bone}>行动代号 · 港区突击</text>
      <text size={18} color={C.signal}>{sl.retries > 0 || sl.relays.some((r) => r === 'cut') ? `重新部署 · 第 ${sl.retries} 次` : '切断三处中继 · 撤离港区'}</text>
    </column>}
  </>
}

/** 罗盘（顶部中间）：随视角转动；橙色标出还没切断的中继（甲乙丙），三处都断后标出绿色“撤”，红点是正在交战的敌人 */
function Compass({ w, p, sl, points, W }: { w: World; p: EntityData; sl: Sl; points: ReturnType<typeof levelPoints>; W: number }) {
  const cw = Math.min(520, W * 0.5)
  const marks = points.relays.flatMap((r, i) => (sl.relays[i] === 'cut' ? [] : [{ pos: r.pos, color: C.signal, label: NAMES[i] ?? r.short }]))
  if (sl.relays.every((r) => r === 'cut')) marks.push({ pos: points.extraction.pos, color: C.ok, label: '撤' })
  const threats: Vec3[] = w.query('enemy').filter((e: EntityData) => e.b.mechFoe?.mode === 'combat').map((e: EntityData) => e.pos)
  return <canvas at={[W / 2 - cw / 2, 16]} w={cw} h={56} draw={(d: UIService, b: Box) => drawCompass(d, {
    x: b.x, y: b.y, w: b.w, yaw: p.b.moveFps.yaw, origin: p.pos, marks, threats, alpha: b.alpha,
    colors: { bg: C.ink, text: C.bone, north: C.signal, major: C.bone, minor: C.steel, threat: C.alarm, pointer: C.signal },
  })} />
}

/** 任务目标（左上）：没断完时是“切断中继 n/3”和三处中继的清单，断完变成“前往码头撤离点”；右边是任务用时 */
function Objectives({ w, sl, points }: { w: World; sl: Sl; points: ReturnType<typeof levelPoints> }) {
  const allCut = sl.relays.every((r) => r === 'cut')
  const n = sl.relays.filter((r) => r === 'cut').length
  const stripe = allCut ? 64 : 34 + points.relays.length * 24
  return <row at={[24, 20]} gap={10}>
    <panel w={4} h={stripe} bg={C.signal} radius={0} pad={0} />
    <column w={236} gap={allCut ? 4 : 2}>
      <row justify="between" w={236}>
        <text size={13} color={C.steel} bold>任务目标</text>
        <text size={13} color={C.steel}>{formatTime(sl.time)}</text>
      </row>
      {allCut ? <>
        <text size={18} color={C.bone} bold shadow>前往码头撤离点</text>
        <text size={13} color={C.ok} shadow>撤离艇已在南端舷梯旁待命</text>
      </> : <>
        <text size={18} color={C.bone} bold shadow pad={[0, 0, 6, 0]}>{`切断中继 ${n}/${points.relays.length}`}</text>
        {points.relays.map((r, i) => <RelayLine key={i} label={r.label} st={sl.relays[i]} />)}
      </>}
    </column>
  </row>
}

/** 清单里的一行：红方块是还在工作，橙方块是正在切断，灰色加删除线是已切断 */
function RelayLine({ label, st }: { label: string; st: string }) {
  const cut = st === 'cut'
  return <canvas w={230} h={24} draw={(d: UIService, b: Box) => {
    d.rect(b.x + 2, b.y + 7, 10, 10, cut ? C.steel : st === 'cutting' ? C.signal : C.alarm, { radius: 2, alpha: (cut ? 0.5 : 1) * b.alpha })
    d.text(label, b.x + 20, b.y + 3, { size: 14, color: cut ? C.steel : C.bone, shadow: true, alpha: (cut ? 0.6 : 1) * b.alpha })
    if (cut) d.line(b.x + 20, b.y + 12, b.x + 20 + d.measure(label, 14).width, b.y + 12, C.steel, 1, 0.8 * b.alpha)
  }} />
}

/** 生命（左下）：10 格，每格 10 点，低于 35% 变红 */
function Health({ k, H }: { k: number; H: number }) {
  return <column at={[24, H - 72]} gap={6}>
    <text size={12} color={C.steel} bold>生命</text>
    <canvas w={218} h={14} draw={(d: UIService, b: Box) => {
      for (let i = 0; i < 10; i++) {
        const fill = clamp(k * 10 - i, 0, 1)
        d.rect(b.x + i * 22, b.y, 18, 14, C.ink, { alpha: 0.5 * b.alpha, radius: 2 })
        if (fill > 0) d.rect(b.x + i * 22, b.y, 18 * fill, 14, k < 0.35 ? C.alarm : C.bone, { radius: 2, alpha: 0.9 * b.alpha })
      }
    }} />
  </column>
}

/** 弹药（右下）：弹匣剩余（6 发及以下变红）/ 备弹，下面是枪名 KR-7；准星下方提示“R · 换弹”“弹药不足”，换弹时有进度条 */
function Ammo({ g, name, W, H }: { g: any; name: string; W: number; H: number }) {
  let hint = ''
  if (g.reloading) hint = '换弹中'
  else if (g.mag === 0 && g.reserve === 0) hint = '弹药不足'
  else if (g.mag <= 6) hint = 'R · 换弹'
  return <>
    <column at={[W - 224, H - 96]} w={200} align="end" gap={0}>
      <row align="end" gap={10}>
        <text size={40} bold shadow color={g.mag <= 6 ? C.alarm : C.bone}>{String(g.mag)}</text>
        <text size={18} shadow color={C.steel} pad={[0, 0, 6, 0]}>{`/ ${g.reserve}`}</text>
      </row>
      <text size={12} bold color={C.steel}>{name}</text>
    </column>
    {hint && <column at={[0, H / 2 + 48]} w={W} align="center" gap={8}>
      <text size={15} bold shadow color={g.reloading ? C.bone : C.alarm}>{hint}</text>
      {g.reloading && <bar w={100} h={3} radius={0} bg={C.ink + '99'} color={C.bone} value={clamp(g.reloadT / g.reloadTotal, 0, 1)} />}
    </column>}
  </>
}

/** 切断交互（准星下方）：靠近中继时显示 E 键圆环和“按住 E · 切断中继 甲”，按住时圆环按进度填满 */
function Interact({ sl, W, H }: { sl: Sl; W: number; H: number }) {
  const i = sl.interact >= 0 ? sl.interact : sl.hint
  if (i < 0) return null
  return <column at={[0, H / 2 + 86]} w={W} align="center" gap={6}>
    <canvas w={60} h={60} draw={(d: UIService, b: Box) => {
      const cx = b.x + 30, cy = b.y + 30
      d.arc(cx, cy, 24, C.ink, 6, 0, 360, 0.55 * b.alpha)
      if (sl.interact >= 0) d.arc(cx, cy, 24, C.signal, 6, 0, 360 * clamp(sl.progress, 0, 1), b.alpha)
      d.text('E', cx, cy, { size: 18, bold: true, color: C.bone, align: 'center', valign: 'middle', alpha: b.alpha })
    }} />
    <text size={15} bold shadow color={C.bone}>{`${sl.interact >= 0 ? '切断中' : '按住 E · 切断中继'} ${NAMES[i] ?? ''}`}</text>
  </column>
}

/** 击杀信息（右上）：“机械飞鸥 已摧毁”，弱点击杀用橙色，5 秒后淡出 */
function Feed({ w, hud, W }: { w: World; hud: SlHud; W: number }) {
  const items = hud.feed.map((f) => ({ ...f, age: ageOf(w, f.at) })).filter((f) => f.age < 5)
  if (!items.length) return null
  return <column at={[0, 84]} w={W - 14} align="end" gap={4}>
    {items.map((f) => <panel key={f.at + f.text} bg={C.ink + '80'} radius={3} pad={[0, 10, 0, 0]} opacity={clamp((5 - f.age) / 0.6, 0, 1)}>
      <row align="center" gap={7}>
        <panel w={3} h={24} bg={f.weak ? C.signal : C.alarm} radius={0} pad={0} />
        <text size={14} bold color={f.weak ? C.signal : C.bone}>{f.text}</text>
      </row>
    </panel>)}
  </column>
}

/** 敌情警告（顶部）：红框，刚出现时闪烁，2.6 秒后消失 */
function Warn({ w, hud, W }: { w: World; hud: SlHud; W: number }) {
  const t = ageOf(w, hud.warn.at)
  if (t > 2.6 || t < 0 || !hud.warn.text) return null
  const a = clamp(Math.min(t * 6, (2.6 - t) * 3), 0, 1)
  const blink = t < 0.6 ? (Math.sin(t * 30) > 0 ? 1 : 0.5) : 1
  return <column at={[0, 74]} w={W} align="center">
    <panel bg={C.alarm + '33'} border={C.alarm} radius={3} pad={[5, 18]} opacity={a}>
      <text size={16} bold color={C.alarm} opacity={blink}>{hud.warn.text}</text>
    </panel>
  </column>
}

/** 消息（中上）：“甲号中继 · 堆场 已断开”“已从水中获救”，显示 2.4 秒 */
function Message({ w, hud, W, H }: { w: World; hud: SlHud; W: number; H: number }) {
  const t = ageOf(w, hud.message.at)
  if (t > 2.4 || t < 0 || !hud.message.text) return null
  return <column at={[0, H * 0.32 - 13]} w={W} align="center" opacity={clamp(Math.min(t * 5, (2.4 - t) * 2), 0, 1)}>
    <text size={20} bold shadow color={C.bone}>{hud.message.text}</text>
  </column>
}

/** 指挥中心字幕（底部）：每秒打出 40 个字，显示 2.5 秒再加每字 0.09 秒 */
function Radio({ w, hud, W, H }: { w: World; hud: SlHud; W: number; H: number }) {
  const r = hud.radio
  if (!r.text) return null
  const t = ageOf(w, r.at), life = 2.5 + r.text.length * 0.09
  if (t > life || t < 0) return null
  const bw = Math.min(720, W - 80)
  return <column at={[0, H - 150]} w={W} align="center" opacity={clamp(Math.min(t * 4, (life - t) * 2), 0, 1)}>
    <panel w={bw} h={64} bg={C.ink + '9e'} radius={4} pad={0}>
      <row h={64}>
        <panel w={3} h={64} bg={C.signal} radius={0} pad={0} />
        <column pad={[8, 16]} gap={4}>
          <text size={12} bold color={C.signal}>指挥中心</text>
          <text size={15} color={C.bone} wrap w={bw - 35}>{r.text.slice(0, Math.floor(t * 40))}</text>
        </column>
      </row>
    </panel>
  </column>
}
