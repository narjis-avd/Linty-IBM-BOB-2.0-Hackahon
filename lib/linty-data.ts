export type Language = 'javascript' | 'typescript'

export type Severity = 'high' | 'medium' | 'low'

export type CodeSnippet = {
  startLine: number
  lines: string[]
  highlight: number[]
}

export type Issue = {
  id: string
  line: number
  title: string
  summary: string
  severity: Severity
  original: CodeSnippet
  fixed: CodeSnippet
  explanation: {
    problem: string
    whyItMatters: string
    whatChanged: string
    tip: string
  }
}

export type TestCase = {
  id: string
  name: string
  issueId: string
  code: string[]
}

export type ScoreBreakdown = {
  bugScore: number
  complexityScore: number
  securityScore: number
  testScore: number
  maintainabilityScore: number
}

export type Report = {
  summary: string
  overallScore: number
  scoreBreakdown: ScoreBreakdown
  recommendations: string[]
  conclusion: string
}

export type AnalysisResult = {
  id: string
  fileName: string
  language: 'javascript' | 'typescript'
  originalCode: string
  fixedCode: string
  issues: Issue[]
  tests: TestCase[]
  report: Report
  confidence: number
}

export type AnalysisError = {
  code: string
  message: string
  details: string[]
}

export type AnalysisApiResponse =
  | { ok: true; result: AnalysisResult }
  | { ok: false; error: AnalysisError; result: null }

export const DEFAULT_FILE = 'cart.js'

export const DEFAULT_CODE = `// cart.js — a small shopping-cart service
const STRIPE_SECRET = "sk_live_51H8xQ2fakeKEY";

var db = require("./db");

function getOrder(orderId) {
  const query = "SELECT * FROM orders WHERE id = " + orderId;
  return db.query(query);
}

function loadCart(userId) {
  fetch(\`/api/cart/\${userId}\`)
    .then((res) => res.json())
    .then(renderCart);
}

function isFreeShipping(total) {
  if (total == "0") return false;
  return total >= 50;
}

function logTotal(total) {
  console.log("Cart total:", total);
}
`

export const ANALYSIS_STEPS = [
  'Reading code',
  'Detecting issues',
  'Generating fixes',
  'Creating tests',
  'Finalizing',
]

export function detectLanguage(fileName: string, code: string): Language {
  if (/\.(ts|tsx|mts|cts)$/i.test(fileName)) return 'typescript'
  if (/\.(js|jsx|mjs|cjs)$/i.test(fileName)) return 'javascript'
  if (
    /\b(interface|type|enum|namespace)\s+\w+/.test(code) ||
    /:\s*(string|number|boolean|any|unknown|void)\b/.test(code) ||
    /\bas\s+(const|string|number|boolean)\b/.test(code)
  ) {
    return 'typescript'
  }
  return 'javascript'
}
