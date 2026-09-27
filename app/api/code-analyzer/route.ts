import { NextRequest, NextResponse } from 'next/server'
import { analyzeWithFallback } from '@/lib/linty/analyze'
import type { AnalysisApiResponse, AnalysisError, Language } from '@/lib/linty-data'

export const runtime = 'nodejs'

const MAX_CODE_BYTES = 100_000

interface AnalysisRequest {
  code: string
  fileName?: string
  language?: Language
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: AnalysisRequest
  try {
    body = (await request.json()) as AnalysisRequest
  } catch {
    return failure(400, 'validation_error', 'Request body must be valid JSON.', ['Expected a JSON body.'])
  }

  const { code, fileName, language = 'typescript' } = body ?? {}

  if (typeof code !== 'string' || code.trim().length === 0) {
    return failure(400, 'validation_error', 'Code is required and must be a non-empty string.', ['Code must be provided.'])
  }

  if (code.length > MAX_CODE_BYTES) {
    return failure(400, 'validation_error', 'Code is too large. Maximum size is 100KB.', ['Code must be less than 100KB.'])
  }

  if (language !== 'javascript' && language !== 'typescript') {
    return failure(400, 'validation_error', 'Unsupported language.', ['Language must be "javascript" or "typescript".'])
  }

  const resolvedFileName =
    typeof fileName === 'string' && fileName.trim().length > 0 ? fileName.trim() : `snippet.${language === 'typescript' ? 'ts' : 'js'}`

  try {
    const result = await analyzeWithFallback(code, language, resolvedFileName)
    const payload: AnalysisApiResponse = { ok: true, result }
    return NextResponse.json(payload, { status: 200 })
  } catch (error) {
    console.error('Code analysis error:', error)
    return failure(500, 'server_error', 'An unexpected error occurred during analysis.', [
      error instanceof Error ? error.message : 'Unknown error',
    ])
  }
}

function failure(status: number, code: AnalysisError['code'], message: string, details: string[]): NextResponse {
  const payload: AnalysisApiResponse = {
    ok: false,
    error: { code, message, details },
    result: null,
  }
  return NextResponse.json(payload, { status })
}
