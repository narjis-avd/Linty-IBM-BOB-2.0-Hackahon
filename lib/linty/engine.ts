import type {
  AnalysisResult,
  Issue,
  Language,
  Report,
  ScoreBreakdown,
  Severity,
  TestCase,
} from '@/lib/linty-data'

type RuleCategory = 'bug' | 'security' | 'style'

type Rule = {
  id: string
  severity: Severity
  category: RuleCategory
  title: string
  summary: string
  explanation: {
    problem: string
    whyItMatters: string
    whatChanged: string
    tip: string
  }
}

type Detection = {
  rule: Rule
  startLine: number
  highlight: number[]
  originalLines: string[]
  fixedLines: string[]
  subject?: string
}

const RULES: Rule[] = [
  {
    id: 'secret',
    severity: 'high',
    category: 'security',
    title: 'Hardcoded secret',
    summary: 'A live key or credential is written directly in the source code.',
    explanation: {
      problem:
        'A secret value is typed straight into the file. Anyone who can see the code — teammates, a public repo, or a leaked backup — can copy it.',
      whyItMatters:
        'With a live key an attacker could make charges, read private data, or access your cloud account. Bots scan public code for keys like this within minutes.',
      whatChanged:
        'The fix reads the value from an environment variable instead. The real secret lives in a private settings file or your hosting dashboard, never in the code.',
      tip: 'Treat keys like passwords: store them outside your code and rotate any key that was ever committed.',
    },
  },
  {
    id: 'sql',
    severity: 'high',
    category: 'security',
    title: 'Possible SQL injection',
    summary: 'User input is joined directly into a database query.',
    explanation: {
      problem:
        'A value is glued onto the end of the SQL text. If someone sends something sneaky like "1 OR 1=1", the database treats it as part of the command.',
      whyItMatters:
        'An attacker could read every row, change data, or even drop tables — just by typing a clever value into a form or URL.',
      whatChanged:
        'The fix uses a placeholder ($1) and passes the value separately. The database now always treats it as plain data, never as a command.',
      tip: 'Never build queries by adding strings together. Always use placeholders (parameterized queries).',
    },
  },
  {
    id: 'eval',
    severity: 'high',
    category: 'security',
    title: 'Use of eval()',
    summary: 'eval() runs arbitrary strings as code.',
    explanation: {
      problem:
        'eval() executes whatever string it is given as JavaScript, including strings an attacker can influence.',
      whyItMatters:
        'If any part of the input is untrusted, eval() is a remote-code-execution hole — the most dangerous kind of vulnerability.',
      whatChanged:
        'The fix removes eval() and replaces it with an explicit, safe parser such as JSON.parse or a purpose-built serializer.',
      tip: 'There is almost always a safer, faster, and clearer alternative to eval().',
    },
  },
  {
    id: 'xss',
    severity: 'high',
    category: 'security',
    title: 'Unsafe DOM injection',
    summary: 'Untrusted content is written into the page as HTML.',
    explanation: {
      problem:
        'Content is assigned to innerHTML (or document.write), which the browser interprets as HTML rather than plain text.',
      whyItMatters:
        'If that content ever includes user input, an attacker can inject scripts that run as the logged-in user (XSS).',
      whatChanged:
        'The fix uses textContent so the value is treated as plain text, or sanitizes the HTML before inserting it.',
      tip: 'Prefer textContent over innerHTML whenever you are only showing text.',
    },
  },
  {
    id: 'exec',
    severity: 'high',
    category: 'security',
    title: 'Unsafe shell command',
    summary: 'A shell command is built from input that may be user-controlled.',
    explanation: {
      problem:
        'exec()/spawn() runs a shell command, and string-built commands can be hijacked with special characters.',
      whyItMatters:
        'An attacker could run arbitrary commands on your server — reading files, installing tools, or taking over the machine.',
      whatChanged:
        'The fix switches to execFile() (or spawn with an argument array) so arguments are passed separately and never parsed by the shell.',
      tip: 'Pass arguments as an array and avoid shell string interpolation for command execution.',
    },
  },
  {
    id: 'promise',
    severity: 'medium',
    category: 'bug',
    title: 'Unhandled network error',
    summary: 'If the request fails, the error is silently ignored.',
    explanation: {
      problem:
        'The code asks the network for data but never plans for what happens if the request fails, for example when the user goes offline.',
      whyItMatters:
        'When it fails, the user just sees an empty or frozen screen with no message, and you get no clue in your logs about what went wrong.',
      whatChanged:
        'The fix wraps the request in try / catch (or a .catch handler). If anything goes wrong, the user sees a friendly message.',
      tip: 'Any time you call the network, ask yourself: "What should the user see if this fails?"',
    },
  },
  {
    id: 'equality',
    severity: 'low',
    category: 'bug',
    title: 'Loose equality check',
    summary: 'Using == can compare values in surprising ways.',
    explanation: {
      problem:
        'The == operator quietly converts values before comparing them, so the number 0, the text "0", and even an empty string can all look "equal".',
      whyItMatters:
        'This kind of hidden conversion causes bugs that are hard to spot, like a discount or shipping rule applying when it should not.',
      whatChanged:
        'The fix uses === and compares against a real value. Now both the value and the type must match exactly.',
      tip: 'Default to === and !== in JavaScript. Only use == if you truly want type conversion.',
    },
  },
  {
    id: 'var',
    severity: 'low',
    category: 'style',
    title: 'Use of var',
    summary: 'var is function-scoped and can cause subtle hoisting bugs.',
    explanation: {
      problem:
        'var is scoped to the whole function and is hoisted, which lets you read a variable before the line that declares it.',
      whyItMatters:
        'This leads to confusing bugs and makes the code harder to reason about, especially in loops and closures.',
      whatChanged:
        'The fix uses let (or const when the value never changes) so the variable is block-scoped.',
      tip: 'Default to const, and use let only when you need to reassign the value.',
    },
  },
  {
    id: 'console',
    severity: 'low',
    category: 'style',
    title: 'Leftover console.log',
    summary: 'A debug statement was left in production code.',
    explanation: {
      problem: 'A console.log call was left behind after debugging.',
      whyItMatters:
        'It can leak sensitive data into the browser console and adds noise to your logs in production.',
      whatChanged: 'The fix removes the debug statement.',
      tip: 'Use a logger with levels, and strip console.log before shipping.',
    },
  },
  {
    id: 'any',
    severity: 'medium',
    category: 'style',
    title: 'Loosely typed any',
    summary: 'The any type disables TypeScript checking.',
    explanation: {
      problem:
        'any opts the value out of the type system, so TypeScript can no longer catch mistakes on it.',
      whyItMatters:
        'A single any can quietly spread and hide real type errors, undermining the safety TypeScript is there to provide.',
      whatChanged:
        'The fix narrows any to unknown (or a real type), forcing the code to check the value before using it.',
      tip: 'Prefer unknown over any — it is still safe, but you must narrow it before use.',
    },
  },
]

const SECRET_TOKEN_RE =
  /\b(sk_live_[0-9a-zA-Z]+|pk_live_[0-9a-zA-Z]+|sk_test_[0-9a-zA-Z]+|AKIA[0-9A-Z]{16}|ghp_[0-9a-zA-Z]{20,}|AIza[0-9A-Za-z_-]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/

const SECRET_NAME_RE =
  /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*["'][^"']*["']/

export function analyzeCode(
  code: string,
  language: Language,
  fileName: string,
): AnalysisResult {
  const lines = splitLines(code)
  const detections = detectIssues(lines, language)
  const issues = detections.map((detection, index) => toIssue(detection, index + 1))
  const tests = generateTests(issues)
  const fixedCode = applyFixes(lines, language)
  const report = buildReport(lines, issues, tests)

  return {
    id: `analysis-${Date.now()}`,
    fileName,
    language,
    originalCode: code,
    fixedCode,
    issues,
    tests,
    report,
    confidence: confidenceFor(issues),
  }
}

function splitLines(code: string): string[] {
  const normalized = code.replace(/\r\n?/g, '\n')
  return normalized.split('\n')
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

function detectIssues(lines: string[], language: Language): Detection[] {
  const detections: Detection[] = []
  const hasChildProcess = /child_process/.test(lines.join('\n'))

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1
    const line = lines[i]

    detectSecret(line, lineNo, lines, detections)
    detectSql(line, lineNo, lines, detections)
    if (/\beval\s*\(/.test(line)) {
      detections.push(singleLine('eval', line, lineNo, '// eval(...) removed — use an explicit parser such as JSON.parse'))
    }
    if (/\.(innerHTML|outerHTML)\s*=/.test(line)) {
      detections.push(singleLine('xss', line, lineNo, line.replace(/\.innerHTML\s*=/g, '.textContent =').replace(/\.outerHTML\s*=/g, '.textContent =')))
    }
    if (/\bdocument\.write\s*\(/.test(line)) {
      detections.push(singleLine('xss', line, lineNo, '// document.write(...) removed — use DOM APIs such as textContent'))
    }
    if (hasChildProcess && /\b(exec|execSync|spawn|spawnSync)\s*\(/.test(line)) {
      detections.push(singleLine('exec', line, lineNo, '// use execFile(cmd, args) or spawn(cmd, args) with a non-shell command'))
    }
    detectUnhandledPromise(line, lineNo, lines, detections)
    detectLooseEquality(line, lineNo, detections)
    if (/\bvar\s+[a-zA-Z_$]/.test(line)) {
      detections.push(singleLine('var', line, lineNo, line.replace(/\bvar\b/g, 'let')))
    }
    if (/\bconsole\.(log|debug|info)\s*\(/.test(line)) {
      detections.push(singleLine('console', line, lineNo, line.replace(/^(\s*)/, '$1// ')))
    }
    if (language === 'typescript') {
      detectAnyType(line, lineNo, detections)
    }
  }

  return detections
}

function detectSecret(line: string, lineNo: number, lines: string[], out: Detection[]): void {
  const token = line.match(SECRET_TOKEN_RE)
  const nameMatch = line.match(SECRET_NAME_RE)

  if (token) {
    const name = nameMatch ? nameMatch[1] : 'SECRET'
    out.push(singleLine('secret', line, lineNo, fixSecretLine(line, token[0], toEnvName(name))))
    return
  }

  // Sensitive-name assignment with a non-placeholder literal value.
  const sensitive = line.match(/\b(api[_-]?key|secret|password|token|access[_-]?key|secret[_-]?key)\s*[:=]\s*(["'])([^"']{6,})\2/i)
  if (sensitive) {
    const value = sensitive[3]
    if (!/^(example|test|your[_-]?|changeme|password|secret|token|xxxx|\.\.\.)/i.test(value)) {
      const name = nameMatch ? nameMatch[1] : sensitive[1]
      const quoted = `${sensitive[2]}${value}${sensitive[2]}`
      out.push(singleLine('secret', line, lineNo, line.replace(quoted, `process.env.${toEnvName(name)}`)))
    }
  }
}

function detectSql(line: string, lineNo: number, lines: string[], out: Detection[]): void {
  const isQuery = /(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|DROP\s+TABLE)\b/i.test(line)
  if (!isQuery) return

  const concat = line.match(/\+\s*([a-zA-Z_$][\w$]*)/)
  const template = line.match(/\$\{([^}]*)\}/)
  if (!concat && !template) return

  const paramName = concat ? concat[1] : (template?.[1] ?? 'value')
  const fixedQuery = parameterizeQuery(line)

  const originalLines = [line]
  const highlight = [lineNo]
  const nextLine = lines[lineNo] ?? ''
  if (/\.query\s*\(/.test(nextLine) || /\bquery\b/.test(nextLine)) {
    originalLines.push(nextLine)
    highlight.push(lineNo + 1)
    const fixedCall = nextLine.replace(/(\.query\s*\(\s*[a-zA-Z_$][\w$]*)\s*\)/, `$1, [${paramName}])`)
    out.push({ rule: ruleById('sql'), startLine: lineNo, highlight, originalLines, fixedLines: [fixedQuery, fixedCall] })
  } else {
    out.push({ rule: ruleById('sql'), startLine: lineNo, highlight, originalLines, fixedLines: [`${fixedQuery} // pass [${paramName}] separately`] })
  }
}

// Rewrites a concatenated/interpolated query into a parameterized one, preserving
// the original SQL text:
//   "SELECT * FROM users WHERE id = " + id  ->  "SELECT * FROM users WHERE id = $1"
//   `SELECT * FROM users WHERE id = ${id}`   ->  `SELECT * FROM users WHERE id = $1`
function parameterizeQuery(line: string): string {
  if (/\$\{[^}]*\}/.test(line)) {
    return line.replace(/\$\{[^}]*\}/, () => '$1')
  }
  const stripped = line.replace(/\s*\+\s*[a-zA-Z_$][\w$]*(?=\s*;?\s*$)/, '')
  const m = stripped.match(/(["'`])(\s*;?)\s*$/)
  if (m) {
    return stripped.slice(0, m.index) + '$1' + m[1] + m[2]
  }
  return line
}

function detectUnhandledPromise(line: string, lineNo: number, lines: string[], out: Detection[]): void {
  if (!/\.then\s*\(/.test(line)) return

  // Skip chained continuations so a multi-line .then chain is flagged once.
  const prev = lines[lineNo - 2]
  if (prev && /^\s*\./.test(prev)) return

  // Look ahead a few lines for a .catch handler; if absent, flag it.
  const windowEnd = Math.min(lines.length, lineNo + 3)
  let hasCatch = false
  let hasAwait = false
  for (let j = lineNo - 1; j < windowEnd; j++) {
    if (/\.catch\s*\(/.test(lines[j])) hasCatch = true
    if (/\bawait\b/.test(lines[j])) hasAwait = true
  }
  if (hasCatch || hasAwait) return

  // Capture the fetch line and the full .then chain through its terminator.
  const isContinuation = /^\s*\./.test(line)
  const start = isContinuation ? Math.max(0, lineNo - 2) : lineNo - 1
  let end = lineNo - 1
  while (end < lines.length - 1 && !/;\s*$/.test(lines[end])) end += 1

  const originalLines = lines.slice(start, end + 1)
  const fixedLines = originalLines.map((source, index) =>
    index === originalLines.length - 1
      ? source.replace(/;(\s*)$/, '.catch((error) => showError("Something went wrong."));$1')
      : source
  )

  out.push({
    rule: ruleById('promise'),
    startLine: start + 1,
    highlight: [lineNo],
    originalLines,
    fixedLines,
  })
}

function detectLooseEquality(line: string, lineNo: number, out: Detection[]): void {
  const fixed = fixLooseEquality(line)
  if (!fixed) return
  out.push(singleLine('equality', line, lineNo, fixed))
}

// Replaces loose == / != with strict === / !==, but leaves the safe
// `x == null` / `x == undefined` idiom untouched (it checks both null and undefined).
function fixLooseEquality(line: string): string | null {
  const re = /(?<![=!<>])(?:==|!=)(?!=)/g
  let changed = false
  const fixed = line.replace(re, (token, offset, full) => {
    const left = full.slice(0, offset).match(/([\w$]+)\s*$/)?.[1]
    const right = full.slice(offset + token.length).match(/^\s*([\w$]+)/)?.[1]
    if (left === 'null' || left === 'undefined' || right === 'null' || right === 'undefined') {
      return token
    }
    changed = true
    return token === '==' ? '===' : '!=='
  })
  return changed ? fixed : null
}

function detectAnyType(line: string, lineNo: number, out: Detection[]): void {
  if (!/(:\s*any\b|\bas\s+any\b|<any>|\bany\s*\[\s*\])/.test(line)) return
  const fixed = line
    .replace(/:\s*any\b/g, ': unknown')
    .replace(/\bas\s+any\b/g, 'as unknown')
    .replace(/<any>/g, '<unknown>')
    .replace(/\bany\s*\[\s*\]/g, 'unknown[]')
  out.push(singleLine('any', line, lineNo, fixed))
}

function singleLine(ruleId: string, line: string, lineNo: number, fixedLine: string): Detection {
  return {
    rule: ruleById(ruleId),
    startLine: lineNo,
    highlight: [lineNo],
    originalLines: [line],
    fixedLines: [fixedLine],
  }
}

function toIssue(detection: Detection, index: number): Issue {
  const { rule } = detection
  return {
    id: `${rule.id}-${detection.startLine}-${index}`,
    line: detection.startLine,
    title: rule.title,
    summary: rule.summary,
    severity: rule.severity,
    original: { startLine: detection.startLine, lines: detection.originalLines, highlight: detection.highlight },
    fixed: { startLine: detection.startLine, lines: detection.fixedLines, highlight: detection.highlight },
    explanation: rule.explanation,
  }
}

function ruleById(id: string): Rule {
  return RULES.find((rule) => rule.id === id) ?? RULES[0]
}

// ---------------------------------------------------------------------------
// Whole-file fixes
// ---------------------------------------------------------------------------

function applyFixes(lines: string[], language: Language): string {
  const out: string[] = []
  const hasChildProcess = /child_process/.test(lines.join('\n'))

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]

    // SQL injection — parameterize the query and the following .query(...) call.
    if (
      /(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|DROP\s+TABLE)\b/i.test(line) &&
      (/\+\s*[a-zA-Z_$]/.test(line) || /\$\{[^}]*\}/.test(line))
    ) {
      const concat = line.match(/\+\s*([a-zA-Z_$][\w$]*)/)
      const template = line.match(/\$\{([^}]*)\}/)
      const paramName = concat ? concat[1] : (template?.[1] ?? 'value')
      out.push(parameterizeQuery(line))
      const next = lines[i + 1]
      if (next !== undefined && /\.query\s*\(/.test(next)) {
        out.push(next.replace(/(\.query\s*\(\s*[a-zA-Z_$][\w$]*)\s*\)/, `$1, [${paramName}])`))
        i += 1
      }
      continue
    }

    // Unhandled promise chain — append a .catch() handler.
    if (/\.then\s*\(/.test(line)) {
      const prevLine = lines[i - 1]
      if (!(prevLine && /^\s*\./.test(prevLine))) {
        const handled = addCatchToChain(lines, i)
        if (handled) {
          out.push(...handled.lines)
          i = handled.endIndex
          continue
        }
      }
    }

    // Hardcoded secret
    const token = line.match(SECRET_TOKEN_RE)
    if (token) {
      const nameMatch = line.match(SECRET_NAME_RE)
      const name = nameMatch ? toEnvName(nameMatch[1]) : 'SECRET'
      line = fixSecretLine(line, token[0], name)
    }

    line = line.replace(/\bvar\b/g, 'let')
    line = fixLooseEquality(line) ?? line
    line = line.replace(/\.innerHTML\s*=/g, '.textContent =')

    if (/\beval\s*\(/.test(line)) {
      line = commentOut(line, 'eval(...) removed — use an explicit parser such as JSON.parse')
    }
    if (hasChildProcess && /\b(exec|execSync|spawn|spawnSync)\s*\(/.test(line)) {
      line = commentOut(line, 'shell command removed — use execFile(cmd, args) or spawn(cmd, args)')
    }
    if (/\bdocument\.write\s*\(/.test(line)) {
      line = commentOut(line, 'document.write(...) removed — use textContent or createElement')
    }
    if (/\bconsole\.(log|debug|info)\s*\(/.test(line) && !/^\/\//.test(line.trim())) {
      line = line.replace(/^(\s*)/, '$1// ')
    }

    if (language === 'typescript') {
      line = line
        .replace(/:\s*any\b/g, ': unknown')
        .replace(/\bas\s+any\b/g, 'as unknown')
        .replace(/<any>/g, '<unknown>')
        .replace(/\bany\s*\[\s*\]/g, 'unknown[]')
    }

    out.push(line)
  }

  return out.join('\n')
}

// Appends a .catch() handler to the end of a .then() chain (the minimal fix for an
// unhandled promise rejection). Returns null if the chain already has handling.
function addCatchToChain(lines: string[], startIndex: number): { lines: string[]; endIndex: number } | null {
  let end = startIndex
  while (end < lines.length && !/;\s*$/.test(lines[end]) && end - startIndex < 12) {
    if (/\.catch\s*\(/.test(lines[end]) || /\bawait\b/.test(lines[end])) return null
    end += 1
  }

  const terminator = lines[end]
  if (terminator === undefined || /\.catch\s*\(/.test(terminator) || /\bawait\b/.test(terminator)) return null

  const result: string[] = []
  for (let k = startIndex; k <= end; k++) {
    const source = lines[k]
    result.push(k === end ? source.replace(/;(\s*)$/, '.catch((error) => showError("Something went wrong."));$1') : source)
  }
  return { lines: result, endIndex: end }
}

// ---------------------------------------------------------------------------
// Test generation
// ---------------------------------------------------------------------------

function generateTests(issues: Issue[]): TestCase[] {
  const tests: TestCase[] = []
  for (const issue of issues) {
    const rule = issue.id.split('-')[0]
    const template = TEST_TEMPLATES[rule]
    if (!template) continue
    tests.push({
      id: `t${tests.length + 1}`,
      name: template.name(issue),
      issueId: issue.id,
      code: template.code(issue),
    })
  }
  return tests
}

const TEST_TEMPLATES: Record<string, { name: (issue: Issue) => string; code: (issue: Issue) => string[] }> = {
  secret: {
    name: () => 'reads the secret from the environment',
    code: () => ['process.env.STRIPE_SECRET = "test_key";', 'expect(getSecretKey()).toBe("test_key");'],
  },
  sql: {
    name: () => 'uses a parameterized query',
    code: () => ['await getOrder("42");', 'expect(db.query).toHaveBeenCalledWith(', '  expect.stringContaining("$1"), ["42"]', ');'],
  },
  promise: {
    name: () => 'shows an error when the request fails',
    code: () => ['fetch.mockRejectedValue(new Error("offline"));', 'await loadCart("u1");', 'expect(showError).toHaveBeenCalled();'],
  },
  equality: {
    name: () => 'compares values strictly',
    code: () => ['expect(isFreeShipping(0)).toBe(false);', 'expect(isFreeShipping(60)).toBe(true);'],
  },
  eval: {
    name: () => 'parses data without eval',
    code: () => ['const parsed = safeParse(\'{"ok":true}\');', 'expect(parsed.ok).toBe(true);'],
  },
  xss: {
    name: () => 'renders user content as text',
    code: () => ['renderMessage("<img src=x onerror=alert(1)>");', 'expect(el.textContent).toContain("<img");', 'expect(el.innerHTML).not.toContain("<img");'],
  },
  exec: {
    name: () => 'runs commands with argument arrays',
    code: () => ['await runCommand("ls", ["-la"]);', 'expect(execFile).toHaveBeenCalledWith("ls", ["-la"]);'],
  },
  var: {
    name: () => 'declares block-scoped variables',
    code: () => ['const src = readSource();', 'expect(src).not.toMatch(/\\bvar\\s/);'],
  },
  console: {
    name: () => 'ships no debug logging',
    code: () => ['const src = readSource();', 'expect(src).not.toMatch(/console\\.log/);'],
  },
  any: {
    name: () => 'keeps types narrow',
    code: () => ['const value: unknown = parse(input);', 'expect(typeof value).toBe("object");'],
  },
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function buildReport(lines: string[], issues: Issue[], tests: TestCase[]): Report {
  const counts = { security: 0, bug: 0, style: 0 }
  for (const issue of issues) {
    const rule = issue.id.split('-')[0]
    const category = RULES.find((r) => r.id === rule)?.category ?? 'style'
    counts[category] += 1
  }

  const highCount = issues.filter((issue) => issue.severity === 'high').length
  const mediumCount = issues.filter((issue) => issue.severity === 'medium').length

  const scoreBreakdown: ScoreBreakdown = {
    bugScore: clamp(100 - counts.bug * 20, 25),
    complexityScore: complexityScore(lines),
    securityScore: clamp(100 - counts.security * 25, 20),
    testScore: clamp(60 + Math.min(40, tests.length * 6), 0),
    maintainabilityScore: clamp(100 - counts.style * 12, 30),
  }

  const overallScore = Math.round(
    (scoreBreakdown.bugScore + scoreBreakdown.complexityScore + scoreBreakdown.securityScore + scoreBreakdown.testScore + scoreBreakdown.maintainabilityScore) / 5,
  )

  const recommendations = issues.slice(0, 4).map((issue) => {
    const action = issue.id.split('-')[0]
    return RECOMMENDATIONS[action] ?? `Address the "${issue.title}" issue on line ${issue.line}.`
  })
  if (recommendations.length === 0) {
    recommendations.push('Keep this level of quality by adding automated linting and tests to CI.')
  }

  const summary = issues.length
    ? `Linty found ${issues.length} issue${issues.length === 1 ? '' : 's'} in this file${highCount ? `, including ${highCount} high-severity ${highCount === 1 ? 'risk' : 'risks'}` : ''}${mediumCount ? ` and ${mediumCount} medium-severity ${mediumCount === 1 ? 'warning' : 'warnings'}` : ''}. Review the suggestions below to tighten it up.`
    : 'Linty found no issues in this file. The code looks clean — nice work.'

  const conclusion = issues.length
    ? 'The code works but has room for improvement. Start with the high-severity items, then apply the rest and regenerate tests to lock in the fixes.'
    : 'No action needed. Consider adding tests and a linter to keep it this way as the codebase grows.'

  return {
    summary,
    overallScore,
    scoreBreakdown,
    recommendations,
    conclusion,
  }
}

const RECOMMENDATIONS: Record<string, string> = {
  secret: 'Move the secret out of the code and rotate the exposed key.',
  sql: 'Switch every query to parameterized placeholders.',
  eval: 'Replace eval() with a safe, explicit parser.',
  xss: 'Use textContent (or sanitize HTML) before writing to the DOM.',
  exec: 'Pass command arguments as an array via execFile/spawn.',
  promise: 'Add try/catch (or .catch) around network requests.',
  equality: 'Use === / !== instead of loose equality.',
  var: 'Replace var with const/let.',
  console: 'Remove leftover console.log statements.',
  any: 'Narrow any to unknown or a concrete type.',
}

function complexityScore(lines: string[]): number {
  const code = lines.join('\n')
  const functionCount = (code.match(/\bfunction\b/g) ?? []).length + (code.match(/=>/g) ?? []).length
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0).length
  let score = 100
  if (nonEmptyLines > 200) score -= 15
  else if (nonEmptyLines > 100) score -= 8
  if (functionCount > 20) score -= 12
  else if (functionCount > 10) score -= 6
  return clamp(score, 30)
}

function confidenceFor(issues: Issue[]): number {
  return clamp(92 - issues.length * 3, 60)
}

function clamp(value: number, min: number): number {
  return Math.max(min, Math.min(100, Math.round(value)))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toEnvName(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase()
}

function fixSecretLine(line: string, token: string, envName: string): string {
  const quoted = new RegExp(`(["'\`])${escapeRegExp(token)}\\1`)
  return quoted.test(line)
    ? line.replace(quoted, `process.env.${envName}`)
    : line.replace(token, `process.env.${envName}`)
}

function commentOut(line: string, message: string): string {
  const indent = line.match(/^\s*/)?.[0] ?? ''
  return `${indent}// ${message}`
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
