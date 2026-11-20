/**
 * sucrase 的 imports 转换对“一条 export 声明多个变量”处理有误：
 *   export const a = 1, b = 2   →   const a = 1; exports.a = a, b = 2
 * 只有第一个变量被导出，其余变成对未声明变量的赋值（运行时报 “b is not defined”，tsc 不报错）。
 *
 * 转译前把这类顶层声明改写为“声明 + export 子句”：
 *   export const a = 1, b = 2   →   const a = 1, b = 2;export { a, b };
 * 只删 `export` 关键字（换成等长空格）并在语句末尾同一行追加子句，行号与列号都不变，报错栈仍指向源码行。
 * 只处理顶层（花括号外）的 const / let / var；单个声明（含解构）sucrase 本身处理正确，不改。
 */

const ID = /[A-Za-z0-9_$\u00a0-\uffff]/
/** 这些字符之后的 `/` 是正则字面量开头，否则是除号 */
const REGEX_AFTER = '(,=:[!&|?{};+-*%<>~^'
/** 换行前的最后一个有效字符是这些时，语句未结束 */
const CONT_BEFORE = ',=+-*/%&|^<>?:.!~(['
/** 换行后的第一个有效字符是这些时，语句未结束（JS 不在 ( [ ` 前自动插分号） */
const CONT_AFTER = ',.=+-*/%&|^?:)]([`'

function skipTemplate(code: string, i: number) {
  let k = i + 1
  while (k < code.length) {
    const c = code[k]
    if (c === '\\') k += 2
    else if (c === '`') return k + 1
    else if (c === '$' && code[k + 1] === '{') k = skipExpr(code, k + 2)
    else k++
  }
  return k
}

/** 从 `${` 之后扫到匹配的 `}` 之后 */
function skipExpr(code: string, i: number) {
  let depth = 1
  let k = i
  let last = '('
  while (k < code.length) {
    const j = skipLiteral(code, k, last)
    if (j > k) {
      if (!isComment(code, k)) last = 'a'
      k = j
      continue
    }
    const c = code[k]
    if (c === '{') depth++
    else if (c === '}' && --depth === 0) return k + 1
    if (!/\s/.test(c)) last = c
    k++
  }
  return k
}

function isComment(code: string, i: number) {
  return code[i] === '/' && (code[i + 1] === '/' || code[i + 1] === '*')
}

/** i 处是注释、字符串、模板或正则字面量时返回其结束位置，否则返回 i。last 为之前最后一个有效字符 */
function skipLiteral(code: string, i: number, last: string) {
  const c = code[i]
  if (c === '/' && code[i + 1] === '/') {
    const e = code.indexOf('\n', i)
    return e < 0 ? code.length : e
  }
  if (c === '/' && code[i + 1] === '*') {
    const e = code.indexOf('*/', i + 2)
    return e < 0 ? code.length : e + 2
  }
  if (c === '"' || c === "'") {
    let k = i + 1
    while (k < code.length && code[k] !== c && code[k] !== '\n') k += code[k] === '\\' ? 2 : 1
    return k + 1
  }
  if (c === '`') return skipTemplate(code, i)
  if (c === '/' && (last === '' || REGEX_AFTER.includes(last))) {
    let k = i + 1
    let cls = false
    while (k < code.length && code[k] !== '\n') {
      const d = code[k]
      if (d === '\\') { k += 2; continue }
      if (d === '[') cls = true
      else if (d === ']') cls = false
      else if (d === '/' && !cls) break
      k++
    }
    k++
    while (k < code.length && ID.test(code[k])) k++
    return k
  }
  return i
}

/** 跳过空白与注释，返回下一个有效字符的位置 */
function skipTrivia(code: string, i: number) {
  for (;;) {
    while (i < code.length && /\s/.test(code[i])) i++
    if (!isComment(code, i)) return i
    i = skipLiteral(code, i, '')
  }
}

function readWord(code: string, i: number) {
  let k = i
  while (k < code.length && ID.test(code[k])) k++
  return code.slice(i, k)
}

/** 按顶层分隔符切分（忽略括号内与字面量内的分隔符） */
function splitTop(s: string, sep: string) {
  const parts: string[] = []
  let depth = 0
  let start = 0
  let last = ''
  for (let k = 0; k < s.length; ) {
    const j = skipLiteral(s, k, last)
    if (j > k) { last = 'a'; k = j; continue }
    const c = s[k]
    if ('([{'.includes(c)) depth++
    else if (')]}'.includes(c)) depth--
    else if (c === sep && depth === 0) { parts.push(s.slice(start, k)); start = k + 1 }
    if (!/\s/.test(c)) last = c
    k++
  }
  parts.push(s.slice(start))
  return parts
}

/** 去掉顶层默认值（`a = 1` → `a`） */
function stripDefault(s: string) {
  const parts = splitTop(s, '=')
  return parts[0].trim()
}

/** 绑定模式（标识符、对象/数组解构）里声明的变量名 */
export function bindingNames(pattern: string): string[] {
  const s = stripDefault(pattern)
  if (!s) return []
  if (s.startsWith('...')) return bindingNames(s.slice(3))
  if (s.startsWith('{') && s.endsWith('}')) {
    const out: string[] = []
    for (const el of splitTop(s.slice(1, -1), ',')) {
      const e = el.trim()
      if (!e) continue
      if (e.startsWith('...')) { out.push(...bindingNames(e.slice(3))); continue }
      const kv = splitTop(e, ':')
      out.push(...bindingNames(kv.length > 1 ? kv.slice(1).join(':') : kv[0]))
    }
    return out
  }
  if (s.startsWith('[') && s.endsWith(']')) {
    const out: string[] = []
    for (const el of splitTop(s.slice(1, -1), ',')) out.push(...bindingNames(el))
    return out
  }
  const name = readWord(s, 0)
  return name ? [name] : []
}

interface Declaration {
  /** 语句结束位置：分号之后，或换行 / 文件末尾所在位置 */
  end: number
  /** 是否以分号结束 */
  semicolon: boolean
  names: string[]
  count: number
}

/** 从 const/let/var 之后解析一条声明语句 */
function parseDeclaration(code: string, p: number): Declaration {
  const lefts: string[] = []
  let depth = 0
  let angle = 0
  let inType = false
  let seenEq = false
  let declStart = p
  let leftEnd = -1
  let last = ''
  let k = p
  const closeDeclarator = (at: number) => {
    lefts.push(code.slice(declStart, leftEnd >= 0 ? leftEnd : at))
    declStart = at + 1
    leftEnd = -1
    seenEq = false
    inType = false
    angle = 0
  }
  while (k < code.length) {
    const j = skipLiteral(code, k, last)
    if (j > k) {
      if (!isComment(code, k)) last = 'a'
      k = j
      continue
    }
    const c = code[k]
    if ('([{'.includes(c)) depth++
    else if (')]}'.includes(c)) {
      if (depth === 0) break
      depth--
    } else if (depth === 0) {
      if (c === ';') {
        closeDeclarator(k)
        return { end: k + 1, semicolon: true, names: lefts.flatMap(bindingNames), count: lefts.length }
      }
      if (c === ':' && !seenEq && !inType) {
        inType = true
        if (leftEnd < 0) leftEnd = k
      } else if (inType && c === '<') angle++
      else if (inType && c === '>' && code[k - 1] !== '=') angle = Math.max(0, angle - 1)
      else if (c === '=' && !seenEq && code[k + 1] !== '=' && code[k + 1] !== '>' && !'=!<>'.includes(code[k - 1])) {
        seenEq = true
        inType = false
        angle = 0
        if (leftEnd < 0) leftEnd = k
      } else if (c === ',' && angle === 0) {
        closeDeclarator(k)
        last = ','
        k++
        continue
      } else if (c === '\n') {
        const next = skipTrivia(code, k)
        const cont = inType || CONT_BEFORE.includes(last) || (next < code.length && CONT_AFTER.includes(code[next]))
        if (!cont) break
      }
    }
    if (!/\s/.test(c)) last = c
    k++
  }
  closeDeclarator(k)
  return { end: k, semicolon: false, names: lefts.flatMap(bindingNames), count: lefts.length }
}

/** 把顶层多变量 export 声明改写为“声明 + export 子句”；没有需要改写的内容时原样返回 */
export function splitMultiExports(code: string): string {
  if (!/export\s+(const|let|var)\b[\s\S]*?,/.test(code)) return code
  let out = ''
  let copied = 0
  let depth = 0
  let last = ''
  let k = 0
  while (k < code.length) {
    const j = skipLiteral(code, k, last)
    if (j > k) {
      if (!isComment(code, k)) last = 'a'
      k = j
      continue
    }
    const c = code[k]
    if (ID.test(c) && (k === 0 || !ID.test(code[k - 1]))) {
      const word = readWord(code, k)
      if (word === 'export' && depth === 0) {
        const kwAt = skipTrivia(code, k + word.length)
        const kw = readWord(code, kwAt)
        if (kw === 'const' || kw === 'let' || kw === 'var') {
          const after = skipTrivia(code, kwAt + kw.length)
          if (readWord(code, after) !== 'enum') {
            const decl = parseDeclaration(code, kwAt + kw.length)
            if (decl.count > 1 && decl.names.length) {
              const clause = `${decl.semicolon ? '' : ';'}export { ${decl.names.join(', ')} };`
              out += code.slice(copied, k) + ' '.repeat(word.length) + code.slice(k + word.length, decl.end) + clause
              copied = decl.end
              k = decl.end
              last = ';'
              continue
            }
          }
        }
      }
      last = word[word.length - 1]
      k += word.length
      continue
    }
    if ('([{'.includes(c)) depth++
    else if (')]}'.includes(c)) depth = Math.max(0, depth - 1)
    if (!/\s/.test(c)) last = c
    k++
  }
  return copied === 0 ? code : out + code.slice(copied)
}
