/**
 * Web 宿主输入（004 第 20.4、20.10 节）：键名映射、move 轴合成、边沿只在一帧内为真
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadWebPot } = require('./helpers')

const web = () => loadWebPot().web

test('web-keys：DOM code 到 Unity 键名', () => {
  const { keyNameOf, mouseButtonName, normalizeKeyName } = web()
  const cases = {
    KeyW: 'w', KeyZ: 'z', Digit1: 'alpha1', Digit0: 'alpha0', Numpad3: 'keypad3', F1: 'f1', F12: 'f12',
    Space: 'space', Escape: 'escape', Enter: 'return', Tab: 'tab', Backspace: 'backspace',
    ShiftLeft: 'leftshift', ShiftRight: 'rightshift', ControlLeft: 'leftcontrol', AltRight: 'rightalt',
    ArrowUp: 'uparrow', ArrowDown: 'downarrow', ArrowLeft: 'leftarrow', ArrowRight: 'rightarrow',
    Minus: 'minus', Equal: 'equals', BracketLeft: 'leftbracket', Backquote: 'backquote', NumpadEnter: 'keypadenter',
    IntlRo: '',
  }
  for (const [code, name] of Object.entries(cases)) assert.equal(keyNameOf(code), name, code)
  assert.equal(mouseButtonName(0), 'mouse0')
  assert.equal(mouseButtonName(2), 'mouse1', '右键是 Unity 的 mouse1')
  assert.equal(mouseButtonName(1), 'mouse2', '中键是 Unity 的 mouse2')
  assert.equal(normalizeKeyName('Space'), 'space')
  assert.equal(normalizeKeyName('1'), 'alpha1')
  assert.equal(normalizeKeyName('LeftCommand'), 'leftmeta')
})

test('web-keys：move 轴与 look 轴', () => {
  const { WebInput } = web()
  const input = new WebInput()
  assert.deepEqual(input.axis('move'), [0, 0])
  input.keyEvent('KeyW', true)
  input.keyEvent('KeyD', true)
  assert.deepEqual(input.axis('move'), [1, 1], '不归一化')
  input.keyEvent('ArrowLeft', true)
  assert.deepEqual(input.axis('move'), [0, 1], '左右同时按为 0')
  input.keyEvent('KeyA', true)
  assert.deepEqual(input.axis('move'), [0, 1], 'A 与左方向键同时按仍只减 1')
  input.moveEvent(100, 50, 10, -20)
  input.moveEvent(110, 40, 10, 0)
  assert.deepEqual(input.axis('look'), [2, 2], 'y 向上为正，× 0.1')
  assert.deepEqual([input.mouseX, input.mouseY], [110, 40])
  input.endFrame()
  assert.deepEqual(input.axis('look'), [0, 0])
  assert.deepEqual(input.axis('nope'), [0, 0])
})

test('web-keys：按下、抬起边沿只在一帧内为真；失焦放开所有键', () => {
  const { WebInput } = web()
  const input = new WebInput()
  input.keyEvent('Space', true)
  assert.equal(input.key('space', 1), true)
  assert.equal(input.key('Space', 0), true)
  input.keyEvent('Space', true) // 自动重复
  input.endFrame()
  assert.equal(input.key('space', 1), false)
  assert.equal(input.key('space', 0), true)
  input.keyEvent('Space', true)
  assert.equal(input.key('space', 1), false, '按住时的重复事件不产生新边沿')
  input.keyEvent('Space', false)
  assert.equal(input.key('space', 2), true)
  assert.equal(input.key('space', 0), false)
  input.endFrame()
  assert.equal(input.key('space', 2), false)

  input.keyEvent('Digit2', true)
  assert.equal(input.key('2', 1), true)
  assert.equal(input.key('alpha2', 0), true)
  input.buttonEvent(0, true)
  assert.equal(input.key('mouse0', 0), true)
  input.endFrame()
  input.blur()
  assert.equal(input.key('alpha2', 0), false)
  assert.equal(input.key('mouse0', 2), true)
})

test('web-keys：滚轮格数与键入文字', () => {
  const { WebInput } = web()
  const input = new WebInput()
  input.wheelEvent(-100, 0)
  assert.equal(input.wheel(), 1, '向上一格')
  input.wheelEvent(3, 1)
  assert.equal(input.wheel(), 0)
  input.textEvent('a')
  input.textEvent('\b')
  assert.equal(input.textInput(), 'a\b')
  assert.equal(input.textInput(), 'a\b', '同一帧多次读取相同')
  input.endFrame()
  assert.equal(input.wheel(), 0)
  assert.equal(input.textInput(), '')
})
