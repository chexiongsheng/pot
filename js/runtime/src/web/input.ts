/**
 * Web 输入状态（004 第 20.4 节），语义照 PotInput.cs。不碰 DOM：host.ts 把事件喂进来，
 * runtime 每帧 tick 之后调 endFrame() 清空边沿与本帧增量，Node 上可直接测试。
 */
import { keyNameOf, mouseButtonName, normalizeKeyName } from './keys'

/** Unity 输入管理器缺省的鼠标灵敏度：Mouse X/Y = 像素位移 × 0.1 */
export const LOOK_SCALE = 0.1

export class WebInput {
  readonly held = new Set<string>()
  readonly down = new Set<string>()
  readonly up = new Set<string>()
  private lookX = 0
  private lookY = 0
  private wheelDelta = 0
  private typed = ''
  /** 画布内的鼠标位置（CSS 像素，左上角为原点，与界面坐标一致） */
  mouseX = 0
  mouseY = 0

  /** 键盘事件：code 为 KeyboardEvent.code；按住自动重复（repeat）不产生新的按下边沿 */
  keyEvent(code: string, pressed: boolean): string {
    const name = keyNameOf(code)
    if (name) this.press(name, pressed)
    return name
  }

  /** 鼠标按键：button 为 MouseEvent.button */
  buttonEvent(button: number, pressed: boolean): void {
    this.press(mouseButtonName(button), pressed)
  }

  press(name: string, pressed: boolean): void {
    if (pressed) {
      if (!this.held.has(name)) {
        this.held.add(name)
        this.down.add(name)
      }
    } else if (this.held.delete(name)) {
      this.up.add(name)
    }
  }

  /** 鼠标移动：x、y 为画布内 CSS 像素；dx、dy 为本次位移（CSS 像素，DOM 的方向，y 向下） */
  moveEvent(x: number, y: number, dx: number, dy: number): void {
    this.mouseX = x
    this.mouseY = y
    this.lookX += dx * LOOK_SCALE
    this.lookY -= dy * LOOK_SCALE
  }

  /** 滚轮：WheelEvent.deltaY 与 deltaMode 折算成格数，向上为正（Unity 的 mouseScrollDelta.y） */
  wheelEvent(deltaY: number, deltaMode: number): void {
    const notches = deltaMode === 1 ? deltaY / 3 : deltaMode === 2 ? deltaY : deltaY / 100
    this.wheelDelta -= notches
  }

  /** 键入文字：可见字符原样，退格 \b，回车 \n */
  textEvent(text: string): void {
    this.typed += text
  }

  /** 窗口失焦：放开所有按住的键（产生抬起边沿），避免卡键 */
  blur(): void {
    for (const name of this.held) this.up.add(name)
    this.held.clear()
  }

  // ---- Engine 查询 ----

  axis(name: string): [number, number] {
    if (name === 'look') return [this.lookX, this.lookY]
    if (name !== 'move') return [0, 0]
    const h = this.held
    let x = 0, y = 0
    if (h.has('a') || h.has('leftarrow')) x -= 1
    if (h.has('d') || h.has('rightarrow')) x += 1
    if (h.has('s') || h.has('downarrow')) y -= 1
    if (h.has('w') || h.has('uparrow')) y += 1
    return [x, y]
  }

  key(name: string, mode: number): boolean {
    const n = normalizeKeyName(name)
    return mode === 1 ? this.down.has(n) : mode === 2 ? this.up.has(n) : this.held.has(n)
  }

  wheel(): number {
    return this.wheelDelta
  }

  textInput(): string {
    return this.typed
  }

  /** 每帧 tick 之后：清空边沿、本帧鼠标位移、滚轮与键入文字 */
  endFrame(): void {
    this.down.clear()
    this.up.clear()
    this.lookX = this.lookY = 0
    this.wheelDelta = 0
    this.typed = ''
  }
}
