import { analyzeCode } from './engine'
import type { AnalysisResult, Issue, Language, Severity } from '@/lib/linty-data'

// ---------------------------------------------------------------------------
// Hybrid analysis entry point.
//
//   deterministic rules  -> always runs, always returns a valid result
//   IBM watsonx (Bob)    -> optional enhancement, added on top when available
//
// This is the single seam that connects the two codebases: the team's
// watsonx/Bob pipeline enriches the deterministic engine, and the engine is
// the guaranteed fallback when watsonx is unconfigured or unreachable.
// ---------------------------------------------------------------------------

export async function analyzeWithFallback(
  code: string,
  language: Language,
  fileName: string,
): Promise<AnalysisResult> {
  // Baseline: deterministic rules. Guaranteed correct, no network, no keys.
  const result = analyzeCode(code, language, fileName)

  // Enhancement: IBM watsonx. Optional — ignored on any failure.
  try {
    const aiIssues = await fetchWatsonxIssues(code, language)
    if (aiIssues && aiIssues.length > 0) {
      result.issues = mergeIssues(result.issues, aiIssues)
    }
  } catch (error) {
    console.warn(
      '[Linty] watsonx unavailable — using deterministic results only:',
      error instanceof Error ? error.message : error,
    )
  }

  return result
}

// ---------------------------------------------------------------------------
// IBM watsonx client. When the team's `backend/watsonx.ts` + `backend/pipeline.ts`
// are merged, replace `fetchWatsonxIssues` with a call to that pipeline and delete
// the inline HTTP helpers below.
// ---------------------------------------------------------------------------

async function fetchWatsonxIssues(code: string, language: Language): Promise<Issue[] | null> {
  const apiKey = process.env.WATSONX_API_KEY
  const projectId = process.env.WATSONX_PROJECT_ID
  if (!apiKey || !projectId) return null // not configured → skip AI

  const modelId = process.env.WATSONX_MODEL_ID ?? 'ibm/granite-3-8b-instruct'
  const baseUrl = process.env.WATSONX_URL ?? 'https://us-south.ml.cloud.ibm.com'

  const token = await fetchIamToken(apiKey)
  const raw = await generateText(baseUrl, token, projectId, modelId, code, language)
  return parseAiIssues(raw, code, language)
}

async function fetchIamToken(apiKey: string): Promise<string> {
  const response = await fetch('https://iam.cloud.ibm.com/identity/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
      apikey: apiKey,
    }),
  })
  if (!response.ok) throw new Error(`watsonx IAM token failed (${response.status})`)
  const data = (await response.json()) as { access_token?: string }
  if (!data.access_token) throw new Error('watsonx IAM token missing access_token')
  return data.access_token
}

async function generateText(
  baseUrl: string,
  token: string,
  projectId: string,
  modelId: string,
  code: string,
  language: Language,
): Promise<string> {
  const prompt = `You are a code reviewer. Analyze the following ${language} code and list any issues the deterministic rules may have missed (logic bugs, subtle security or performance problems, maintainability).

Respond with ONLY a JSON array of objects, each:
{"line": <number>, "title": "<short title>", "severity": "high|medium|low", "message": "<one sentence>"}

Code:
\`\`\`${language}
${code}
\`\`\``

  const response = await fetch(`${baseUrl}/ml/v1/text/generation?version=2023-05-29`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model_id: modelId,
      project_id: projectId,
      input: prompt,
      parameters: { temperature: 0.2, max_new_tokens: 1500, min_new_tokens: 1 },
    }),
  })
  if (!response.ok) throw new Error(`watsonx generation failed (${response.status})`)
  const data = (await response.json()) as { results?: Array<{ generated_text?: string }> }
  return data.results?.[0]?.generated_text ?? ''
}

function parseAiIssues(raw: string, code: string, language: Language): Issue[] | null {
  const lines = code.replace(/\r\n?/g, '\n').split('\n')
  // The model may wrap the JSON in markdown fences or prose — extract the array.
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(match[0])
  } catch {
    return null
  }
  if (!Array.isArray(parsed)) return null

  return parsed
    .filter((item): item is { line?: number; title?: string; severity?: string; message?: string } =>
      Boolean(item) && typeof item === 'object',
    )
    .map((item, index) => {
      const line = typeof item.line === 'number' ? Math.max(1, item.line) : 1
      const source = lines[line - 1] ?? ''
      const severity = toSeverity(item.severity)
      const message = item.message ?? item.title ?? 'Possible issue'
      return {
        id: `ai-${index + 1}`,
        line,
        title: item.title ?? 'AI-detected issue',
        summary: message,
        severity,
        original: { startLine: line, lines: [source], highlight: [line] },
        fixed: { startLine: line, lines: [`// watsonx suggests: ${message}`], highlight: [line] },
        explanation: { problem: message, whyItMatters: '', whatChanged: '', tip: 'Review and apply the suggested fix manually.' },
      } satisfies Issue
    })
}

function toSeverity(value: string | undefined): Severity {
  const v = (value ?? '').toLowerCase()
  if (v === 'high' || v === 'error') return 'high'
  if (v === 'low' || v === 'info') return 'low'
  return 'medium'
}

function mergeIssues(base: Issue[], ai: Issue[]): Issue[] {
  const existingLines = new Set(base.map((issue) => issue.line))
  const extra = ai.filter((issue) => !existingLines.has(issue.line))
  return [...base, ...extra]
}
