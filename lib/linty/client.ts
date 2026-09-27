import type { AnalysisApiResponse, AnalysisResult, Language } from '@/lib/linty-data'

export type { AnalysisResult, Language } from '@/lib/linty-data'

export async function requestCodeAnalysis(
  code: string,
  fileName: string,
  language: Language,
): Promise<AnalysisResult> {
  const response = await fetch('/api/code-analyzer', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, fileName, language }),
  })

  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok || !isSuccess(payload)) {
    const message = isFailure(payload) ? payload.error.message : 'The analysis request failed.'
    throw new Error(message)
  }

  return payload.result
}

function isSuccess(value: unknown): value is Extract<AnalysisApiResponse, { ok: true }> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    value.ok === true &&
    'result' in value &&
    value.result !== null &&
    typeof value.result === 'object'
  )
}

function isFailure(value: unknown): value is Extract<AnalysisApiResponse, { ok: false }> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    value.ok === false &&
    'error' in value &&
    typeof value.error === 'object' &&
    value.error !== null &&
    'message' in value.error &&
    typeof value.error.message === 'string'
  )
}
