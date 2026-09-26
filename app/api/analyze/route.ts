import { NextResponse } from "next/server";
import { z } from "zod";
import { analyze, type AnalysisApiError, type AnalysisApiResponse, type AnalyzerResult } from "@/lib/analyzer";
import { normalizeUrl } from "@/lib/analyzer/normalize-url";
import { analysisStore } from "@/lib/store/analysis-store";
import { normalizeAnalysisResult } from "@/lib/analyzer/normalize-result";

export const runtime = "nodejs";
const MAX_REQUEST_BYTES = 16_384;

const requestSchema = z.object({
  url: z.string().trim().min(1, "URL is required.").max(2048, "URL is too long.").transform((value, context) => {
    const normalized = normalizeUrl(value);
    if (!normalized.accepted || !normalized.value) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: normalized.message ?? "Enter a valid public HTTP or HTTPS URL." });
      return z.NEVER;
    }
    return normalized.value;
  }),
});

type AnalyzeRequest = z.infer<typeof requestSchema>;

export async function POST(request: Request): Promise<NextResponse> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "Request body is too large." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    const payload: AnalysisApiResponse = {
      ok: false,
      error: { code: "validation_error", message: "Invalid request.", details: parsed.error.issues.map((issue) => issue.message) },
      result: null,
    };
    return NextResponse.json(
      payload,
      { status: 400 },
    );
  }

  try {
    const analyzed = await analyze((parsed.data as AnalyzeRequest).url, {
      render: "auto",
    });
    const result = analyzed.status === "completed"
      ? normalizeAnalysisResult(analyzed, parsed.data.url)
      : analyzed;
    if (!result) {
      return NextResponse.json(
        { ok: false, error: { code: "analysis_failed", message: "The analysis returned an invalid result.", details: [] }, result: null } satisfies AnalysisApiResponse,
        { status: 500 },
      );
    }
    if (result.status === "completed") {
      const saved = await analysisStore.save(result);
      const payload: AnalysisApiResponse = { ok: true, result };
      return NextResponse.json(payload, {
        status: 200,
        headers: { "x-analysis-id": saved.id },
      });
    }

    const payload: AnalysisApiResponse = {
      ok: false,
      error: { code: errorCodeForFailure(result), message: publicFailureMessage(result), details: [] },
      result,
    };
    return NextResponse.json(
      payload,
      { status: statusForFailure(result) },
    );
  } catch {
    const payload: AnalysisApiResponse = {
      ok: false,
      error: { code: "request_failed", message: "The analysis could not be completed.", details: [] },
      result: null,
    };
    return NextResponse.json(payload, { status: 500 });
  }
}

function statusForFailure(result: AnalyzerResult): number {
  const code = result.debug.extraction_warnings.find((warning) => warning.code === "analysis_failed")?.source;
  if (code === "ssrf_rejected" || code === "blocked_by_validation" || code === "localhost") return 403;
  if (code === "timeout" || code === "navigation_timeout") return 408;
  if (code === "non_html_response") return 422;
  return 500;
}

function publicFailureMessage(result: AnalyzerResult): string {
  const status = statusForFailure(result);
  if (status === 403) return "The requested URL is blocked.";
  if (status === 408) return "The website took too long to respond.";
  if (status === 422) return "The URL did not return supported HTML content.";
  return "The analysis could not be completed.";
}

function errorCodeForFailure(result: AnalyzerResult): AnalysisApiError["code"] {
  const status = statusForFailure(result);
  if (status === 403) return "blocked_url";
  if (status === 408 || status === 422) return "fetch_failed";
  return "analysis_failed";
}
