const test = require('node:test')
const assert = require('node:assert')
const vm = require('vm')
const { loadPot } = require('./helpers')

test('portable：屏蔽层里名单上的全局对象为 undefined，清单上的仍可用', () => {
  const pot = loadPot()
  const code = `module.exports = { w: typeof window, d: typeof document, p: typeof process, f: typeof fetch, t: typeof setTimeout, m: typeof Math, e: typeof TextEncoder }`
  const sandbox = { window: {}, document: {}, process: {}, fetch() {}, setTimeout, TextEncoder, Math }
  const factory = vm.runInNewContext(pot.shieldModuleSource(code), sandbox)
  const module = { exports: {} }
  factory(module.exports, () => null, module, 'bundle.cjs')
  assert.deepStrictEqual(JSON.parse(JSON.stringify(module.exports)), { w: 'undefined', d: 'undefined', p: 'undefined', f: 'undefined', t: 'function', m: 'object', e: 'function' })
})

test('portable：清单与名单不重叠', () => {
  const pot = loadPot()
  const blocked = new Set(pot.BLOCKED_GLOBALS)
  for (const name of pot.PORTABLE_HOST_GLOBALS) assert.ok(!blocked.has(name), name)
})
