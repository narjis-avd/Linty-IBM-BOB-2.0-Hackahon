import { inspectPublicUrl, inspectPublicUrlWithDns, type UrlRejectionReason } from "./security";

export const DEFAULT_FETCH_TIMEOUT_MS = 15_000;
export const DEFAULT_MAX_RESPONSE_BYTES = 5_000_000;
export const DEFAULT_MAX_REDIRECTS = 5;

export type PageFetchFailureCode =
  | "invalid_url"
  | "ssrf_rejected"
  | "timeout"
  | "network_failure"
  | "redirect_error"
  | "too_many_redirects"
  | "oversized_response"
  | "non_html_response"
  | "http_error";

export interface PageFetchOptions {
  timeout_ms?: number;
  max_response_bytes?: number;
  max_redirects?: number;
  validate_dns?: boolean;
  fetch_impl?: typeof fetch;
}

export interface PageFetchSuccess {
  ok: true;
  requested_url: string;
  final_url: string;
  status: number;
  headers: Record<string, string>;
  html: string;
  response_time_ms: number;
}

export interface PageFetchFailure {
  ok: false;
  requested_url: string;
  final_url: string | null;
  status: number | null;
  headers: Record<string, string>;
  response_time_ms: number;
  code: PageFetchFailureCode;
  message: string;
  rejection_reason?: UrlRejectionReason;
}

export type PageFetchResult = PageFetchSuccess | PageFetchFailure;

function headersToRecord(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries());
}

function failure(
  requested_url: string,
  started_at: number,
  code: PageFetchFailureCode,
  message: string,
  final_url: string | null = null,
  status: number | null = null,
  headers: Record<string, string> = {},
  rejection_reason?: UrlRejectionReason,
): PageFetchFailure {
  return {
    ok: false,
    requested_url,
    final_url,
    status,
    headers,
    response_time_ms: Date.now() - started_at,
    code,
    message,
    ...(rejection_reason ? { rejection_reason } : {}),
  };
}

function isHtmlResponse(contentType: string | null): boolean {
  if (!contentType) return true;
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType === "text/html" || mediaType === "application/xhtml+xml";
}

async function readLimitedBody(response: Response, maxBytes: number): Promise<string | PageFetchFailureCode> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) return "oversized_response";
  if (!response.body) {
    const text = await response.text();
    return new TextEncoder().encode(text).byteLength > maxBytes ? "oversized_response" : text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return "oversized_response";
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

export async function fetchPage(url: string, options: PageFetchOptions = {}): Promise<PageFetchResult> {
  const startedAt = Date.now();
  const timeoutMs = options.timeout_ms ?? DEFAULT_FETCH_TIMEOUT_MS;
  const maxBytes = options.max_response_bytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  const maxRedirects = options.max_redirects ?? DEFAULT_MAX_REDIRECTS;
  const fetchImpl = options.fetch_impl ?? fetch;
  const inspect = options.validate_dns === false
    ? (value: string | URL) => Promise.resolve(inspectPublicUrl(value))
    : inspectPublicUrlWithDns;
  const requested = await inspect(url);

  if (!requested.accepted || !requested.url) {
    return failure(
      url,
      startedAt,
      requested.reason === "invalid_url" ? "invalid_url" : "ssrf_rejected",
      requested.message ?? "The requested URL is not allowed.",
      null,
      null,
      {},
      requested.reason ?? undefined,
    );
  }

  let currentUrl = requested.url;
  const visited = new Set<string>();
  let redirectCount = 0;

  while (true) {
    if (visited.has(currentUrl.href)) {
      return failure(url, startedAt, "redirect_error", "The response redirect loop was detected.", currentUrl.href);
    }
    visited.add(currentUrl.href);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { accept: "text/html,application/xhtml+xml" },
      });
    } catch (error) {
      const isTimeout = error instanceof DOMException && error.name === "AbortError";
      return failure(url, startedAt, isTimeout ? "timeout" : "network_failure", isTimeout ? "The page request timed out." : "The page request failed.", currentUrl.href);
    } finally {
      clearTimeout(timeout);
    }

    const headers = headersToRecord(response.headers);
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400) {
      if (!location) return failure(url, startedAt, "redirect_error", "The redirect response did not include a location.", currentUrl.href, response.status, headers);
      if (redirectCount >= maxRedirects) return failure(url, startedAt, "too_many_redirects", "The maximum number of redirects was exceeded.", currentUrl.href, response.status, headers);
      const next = await inspect(new URL(location, currentUrl));
      if (!next.accepted || !next.url) {
        return failure(url, startedAt, "ssrf_rejected", next.message ?? "The redirect target is not allowed.", currentUrl.href, response.status, headers, next.reason ?? undefined);
      }
      currentUrl = next.url;
      redirectCount += 1;
      continue;
    }

    if (!isHtmlResponse(response.headers.get("content-type"))) {
      return failure(url, startedAt, "non_html_response", "The response is not an HTML document.", currentUrl.href, response.status, headers);
    }
    if (!response.ok) {
      return failure(url, startedAt, "http_error", `The page returned HTTP ${response.status}.`, currentUrl.href, response.status, headers);
    }

    let body: string | PageFetchFailureCode;
    try {
      body = await readLimitedBody(response, maxBytes);
    } catch {
      return failure(url, startedAt, "network_failure", "The response body could not be read.", currentUrl.href, response.status, headers);
    }
    if (body === "oversized_response") {
      return failure(url, startedAt, "oversized_response", "The HTML response exceeded the configured size limit.", currentUrl.href, response.status, headers);
    }
    return {
      ok: true,
      requested_url: url,
      final_url: currentUrl.href,
      status: response.status,
      headers,
      html: body,
      response_time_ms: Date.now() - startedAt,
    };
  }
}
