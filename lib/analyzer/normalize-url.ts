import { inspectPublicUrl, type UrlSecurityResult } from "./url-policy";

export interface NormalizedUrlResult extends UrlSecurityResult {
  value: string | null;
}

export function normalizeUrl(value: string, sourceUrl?: string): NormalizedUrlResult {
  const input = value.trim();
  if (!input) {
    return { accepted: false, url: null, value: null, reason: "invalid_url", message: "A URL is required." };
  }

  const hasExplicitScheme = /^[a-z][a-z\d+.-]*:/i.test(input);
  if (!sourceUrl && !hasExplicitScheme && !looksLikeHostname(input)) {
    return { accepted: false, url: null, value: null, reason: "invalid_url", message: "Enter a valid domain name or URL." };
  }

  const candidate = !sourceUrl && !hasExplicitScheme ? `https://${input}` : input;
  let resolved: URL;
  try {
    resolved = new URL(candidate, sourceUrl);
  } catch {
    return { accepted: false, url: null, value: null, reason: "invalid_url", message: "The URL could not be resolved." };
  }

  resolved.hash = "";
  const inspected = inspectPublicUrl(resolved);
  return { ...inspected, value: inspected.accepted && inspected.url ? inspected.url.href : null };
}

function looksLikeHostname(value: string): boolean {
  const hostCandidate = value.split(/[/?#]/, 1)[0].replace(/\.$/, "");
  if (!hostCandidate || hostCandidate.includes("..") || hostCandidate.includes(":")) return false;
  if (hostCandidate.split(".").length < 2) return false;
  return hostCandidate.split(".").every((label) => /^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(label));
}
