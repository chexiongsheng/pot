/**
 * 发布用内置字体：按游戏实际用到的字符，从开源中文字体裁出子集，随包分发。
 *
 * 为什么需要：Unity 运行时的文字都走 Font.CreateDynamicFontFromOSFont（系统字体），
 * WebGL 拿不到系统字体（只剩内置 Arial，没有中文字形），Android 各机型字体也不一致。
 * 子集只含用到的字形，通常几百 KB。
 *
 * 字体来源（按顺序，只用可再分发的 OFL 字体；微软雅黑等系统字体不能随包分发）：
 *   1. manifest.release.font（相对游戏目录，ttf/otf）
 *   2. 环境变量 POT_FONT
 *   3. 本机已安装的 Noto Sans SC / 思源黑体（静态字重，不用可变字体）
 * 字符集：暂存目录 game/** 中文本文件出现过的所有字符 + ASCII 可见字符 + 常用中文标点 + manifest.release.fontChars。
 * 运行时拼出来的、源码里没出现过的字（例如玩家输入）不在子集里，会回退到系统字体。
 */
const fs = require('fs')
const path = require('path')
const os = require('os')

const TEXT_EXT = /\.(c?js|mjs|json|txt|md|csv|ya?ml|xml|html?)$/i
// “国”是 PotUI 竖直对齐用的参考字，必须在子集里
const EXTRA = '国，。、：；！？（）《》〈〉“”‘’…—–·【】「」『』％＋－×÷￥～　０１２３４５６７８９'

const FONT_NAMES = [
  'NotoSansSC-Regular.otf', 'NotoSansSC-Regular.ttf', 'Noto Sans SC (TrueType).otf', 'Noto Sans SC.otf',
  'NotoSansCJKsc-Regular.otf', 'NotoSansCJK-Regular.ttc',
  'SourceHanSansSC-Regular.otf', 'SourceHanSansCN-Regular.otf', 'SourceHanSansCN-Normal.ttf', 'SourceHanSansCN-Normal.otf',
]

function fontDirs() {
  const dirs = []
  if (process.platform === 'win32') {
    dirs.push(path.join(process.env.WINDIR ?? 'C:/Windows', 'Fonts'))
    if (process.env.LOCALAPPDATA) dirs.push(path.join(process.env.LOCALAPPDATA, 'Microsoft/Windows/Fonts'))
  } else if (process.platform === 'darwin') {
    dirs.push('/Library/Fonts', path.join(os.homedir(), 'Library/Fonts'))
  } else {
    dirs.push('/usr/share/fonts/opentype/noto', '/usr/share/fonts/noto-cjk', '/usr/share/fonts/truetype', path.join(os.homedir(), '.fonts'))
  }
  return dirs
}

/** 找字体源文件；返回 { file, from } 或 null */
function findSourceFont(manifest, gameDir) {
  const given = manifest?.release?.font
  if (given) {
    const file = path.resolve(gameDir, given)
    if (!fs.existsSync(file)) throw new Error(`manifest.release.font 指定的字体不存在：${file}`)
    return { file, from: 'manifest' }
  }
  if (process.env.POT_FONT) {
    const file = path.resolve(process.env.POT_FONT)
    if (!fs.existsSync(file)) throw new Error(`环境变量 POT_FONT 指定的字体不存在：${file}`)
    return { file, from: 'POT_FONT' }
  }
  for (const dir of fontDirs()) {
    for (const name of FONT_NAMES) {
      const file = path.join(dir, name)
      if (fs.existsSync(file)) return { file, from: 'system' }
    }
  }
  return null
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

/** 游戏用到的字符（排序去重后的字符串） */
function collectChars(gameStageDir, extra = '') {
  const set = new Set()
  for (let c = 0x20; c < 0x7f; c++) set.add(String.fromCharCode(c))
  for (const ch of EXTRA + extra) set.add(ch)
  for (const file of walk(gameStageDir)) {
    if (!TEXT_EXT.test(file)) continue
    const text = fs.readFileSync(file, 'utf8')
    // 源码里的中文常写成 \uXXXX 转义（esbuild 默认 ASCII 输出），一并还原
    const unescaped = text.replace(/\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})/g, (_, a, b) => {
      const cp = parseInt(a ?? b, 16)
      return cp >= 0x80 ? String.fromCodePoint(cp) : ''
    })
    for (const ch of unescaped) {
      const cp = ch.codePointAt(0)
      if (cp >= 0x80 && !(cp >= 0xd800 && cp <= 0xdfff) && cp !== 0xfeff) set.add(ch)
    }
  }
  return [...set].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join('')
}

/**
 * 裁子集写到 stageDir/font.(ttf|otf)。
 * 返回 { file: 相对暂存目录的文件名, source, from, chars, bytes } ；找不到字体源时返回 { file: '', warning }。
 */
async function stageFont(manifest, gameDir, stageDir) {
  const source = findSourceFont(manifest, gameDir)
  if (!source) {
    return {
      file: '',
      warning: '没找到可随包分发的中文字体（Noto Sans SC / 思源黑体），发布包将使用系统字体：WebGL 上中文不显示。' +
        '可安装 Noto Sans SC，或在 manifest.release.font / 环境变量 POT_FONT 指定 ttf/otf',
    }
  }
  const chars = collectChars(path.join(stageDir, 'game'), String(manifest?.release?.fontChars ?? ''))
  const subsetFont = require('subset-font')
  let data = fs.readFileSync(source.file)
  if (data.readUInt32BE(0) === 0x74746366) throw new Error(`暂不支持字体集合 ttc：${source.file}（请换用 ttf/otf）`)
  const subset = await subsetFont(data, chars, { targetFormat: 'sfnt' })
  const ext = subset.readUInt32BE(0) === 0x4f54544f ? '.otf' : '.ttf'
  const file = `font${ext}`
  fs.writeFileSync(path.join(stageDir, file), subset)
  return { file, source: source.file, from: source.from, chars: [...chars].length, bytes: subset.length }
}

module.exports = { stageFont, collectChars, findSourceFont }
