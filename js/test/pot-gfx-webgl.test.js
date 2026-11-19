const test = require('node:test')
const assert = require('node:assert/strict')
const { diff } = require('../../native/pot_gfx/sync-webgl.js')

test('Plugins/WebGL/pot_gfx 与 native/pot_gfx/src 一致', () => {
  assert.deepEqual(diff(), [], '执行 node native/pot_gfx/sync-webgl.js 同步')
})
