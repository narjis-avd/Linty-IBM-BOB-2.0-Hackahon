import type { AnalysisApiResponse, AnalyzerResult } from "./types";
import { normalizeAnalysisResult } from "./normalize-result";

export interface AnalysisHistoryItem {
  id: string;
  url: string;
  title: string | null;
  analyzed_at: string;
  status: AnalyzerResult["status"];
  summary: {
    total_ecommerce_products: number;
    total_unique_images: number;
    total_links: number;
    total_sections: number;
    total_content_items: number;
  };
  result: AnalyzerResult;
}

export interface AnalyzeApiError {
  error: { code: string; message: string; details: string[] };
  result: AnalyzerResult | null;
}

export async function requestAnalysis(url: string): Promise<AnalyzerResult> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !isApiSuccess(payload)) {
    const message = isApiFailure(payload) ? payload.error.message : "The analysis request failed.";
    throw new Error(message);
  }
  const normalized = normalizeAnalysisResult(payload.result, url);
  if (!normalized) {
    throw new Error("The server returned an invalid analysis response.");
  }
  return normalized;
}

export async function listAnalyses(): Promise<{ analyses: AnalysisHistoryItem[]; persistent: boolean; limitation: string | null }> {
  const response = await fetch("/api/analyses", { cache: "no-store" });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !isHistoryPayload(payload)) throw new Error("Analysis history is unavailable.");
  const analyses = payload.analyses.map((item) => {
    const result = normalizeAnalysisResult(item.result, item.url);
    if (!result) throw new Error("Analysis history contains an invalid result.");
    return { ...item, summary: {
      total_ecommerce_products: result.summary.total_ecommerce_products,
      total_unique_images: result.summary.total_unique_images,
      total_links: result.summary.total_links,
      total_sections: result.summary.total_sections,
      total_content_items: result.summary.total_content_items,
    }, result };
  });
  return { ...payload, analyses };
}

export async function deleteAnalysis(id: string): Promise<void> {
  const response = await fetch(`/api/analyses?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) throw new Error("The saved analysis could not be deleted.");
}

function isApiFailure(value: unknown): value is Extract<AnalysisApiResponse, { ok: false }> {
  return typeof value === "object" && value !== null && "ok" in value && value.ok === false
    && "error" in value && typeof value.error === "object" && value.error !== null
    && "message" in value.error && typeof value.error.message === "string";
}

function isApiSuccess(value: unknown): value is Extract<AnalysisApiResponse, { ok: true }> {
  return typeof value === "object" && value !== null && "ok" in value && value.ok === true && "result" in value;
}

function isHistoryPayload(value: unknown): value is { analyses: AnalysisHistoryItem[]; persistent: boolean; limitation: string | null } {
  return typeof value === "object" && value !== null
    && "analyses" in value && Array.isArray(value.analyses)
    && "persistent" in value && typeof value.persistent === "boolean"
    && "limitation" in value && (typeof value.limitation === "string" || value.limitation === null);
}
