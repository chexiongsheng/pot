/**
 * DOM KeyboardEvent.code → Unity KeyCode 名的小写（004 第 20.4 节）。
 * 游戏里的键名与 PotInput.cs 一致：不区分大小写，单个数字等同 alpha 数字。
 */

const TABLE: Record<string, string> = {
  Space: 'space', Escape: 'escape', Enter: 'return', Tab: 'tab', Backspace: 'backspace', Delete: 'delete', Insert: 'insert',
  Home: 'home', End: 'end', PageUp: 'pageup', PageDown: 'pagedown', CapsLock: 'capslock', Pause: 'pause', PrintScreen: 'print', ScrollLock: 'scrolllock', NumLock: 'numlock',
  ArrowUp: 'uparrow', ArrowDown: 'downarrow', ArrowLeft: 'leftarrow', ArrowRight: 'rightarrow',
  ShiftLeft: 'leftshift', ShiftRight: 'rightshift', ControlLeft: 'leftcontrol', ControlRight: 'rightcontrol',
  AltLeft: 'leftalt', AltRight: 'rightalt', MetaLeft: 'leftmeta', MetaRight: 'rightmeta', ContextMenu: 'menu',
  Minus: 'minus', Equal: 'equals', BracketLeft: 'leftbracket', BracketRight: 'rightbracket', Backslash: 'backslash',
  Semicolon: 'semicolon', Quote: 'quote', Backquote: 'backquote', Comma: 'comma', Period: 'period', Slash: 'slash',
  NumpadAdd: 'keypadplus', NumpadSubtract: 'keypadminus', NumpadMultiply: 'keypadmultiply', NumpadDivide: 'keypaddivide',
  NumpadEnter: 'keypadenter', NumpadDecimal: 'keypadperiod', NumpadEqual: 'keypadequals',
}

/** Unity 里同一个 KeyCode 的别名 → 本表用的名字 */
const ALIASES: Record<string, string> = {
  leftcommand: 'leftmeta', leftapple: 'leftmeta', leftwindows: 'leftmeta',
  rightcommand: 'rightmeta', rightapple: 'rightmeta', rightwindows: 'rightmeta',
  enter: 'return',
}

/** KeyboardEvent.code → 键名；不认识的返回空串 */
export function keyNameOf(code: string): string {
  const hit = TABLE[code]
  if (hit) return hit
  let m = /^Key([A-Z])$/.exec(code)
  if (m) return m[1].toLowerCase()
  m = /^Digit(\d)$/.exec(code)
  if (m) return 'alpha' + m[1]
  m = /^Numpad(\d)$/.exec(code)
  if (m) return 'keypad' + m[1]
  m = /^F(\d{1,2})$/.exec(code)
  if (m) return 'f' + m[1]
  return ''
}

/** MouseEvent.button → 键名：DOM 0 左、1 中、2 右；Unity mouse0 左、mouse1 右、mouse2 中 */
export function mouseButtonName(button: number): string {
  return button === 0 ? 'mouse0' : button === 2 ? 'mouse1' : button === 1 ? 'mouse2' : 'mouse' + button
}

/** 游戏传入的键名规范化：小写、单个数字为 alpha 数字、别名归一 */
export function normalizeKeyName(name: string): string {
  const n = String(name).toLowerCase()
  if (/^\d$/.test(n)) return 'alpha' + n
  return ALIASES[n] ?? n
}

/** 画布有焦点时屏蔽浏览器默认行为的键（滚页、焦点切换、快速查找等） */
export function blocksDefault(code: string): boolean {
  return code === 'Space' || code === 'Tab' || code === 'Backspace' || code === 'Quote' || code === 'Slash' || code.startsWith('Arrow') || code === 'PageUp' || code === 'PageDown' || code === 'Home' || code === 'End' || /^F\d$/.test(code) && code !== 'F5' && code !== 'F12'
}
