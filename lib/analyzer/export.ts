import type { AnalyzerResult } from "./types";

export function serializeAnalysis(result: AnalyzerResult): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}

export function analysisExportFilename(result: AnalyzerResult): string {
  const source = result.website.final_url || result.website.url;
  let hostname = "website";
  try {
    hostname = new URL(source).hostname;
  } catch {
    hostname = "website";
  }

  const date = result.website.analyzed_at.slice(0, 10).replace(/[^0-9-]/g, "") || "undated";
  const safeHostname = hostname
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "website";

  return `${safeHostname}-${date}-analysis.json`;
}

export function isImportableAnalysis(value: unknown): value is AnalyzerResult {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AnalyzerResult>;
  return candidate.status === "completed"
    && Boolean(candidate.website)
    && Boolean(candidate.summary)
    && Boolean(candidate.metadata)
    && Boolean(candidate.navigation)
    && Boolean(candidate.debug)
    && Array.isArray(candidate.sections)
    && Array.isArray(candidate.products)
    && Array.isArray(candidate.images)
    && Array.isArray(candidate.links);
}
