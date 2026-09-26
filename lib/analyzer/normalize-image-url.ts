import { normalizeUrl, type NormalizedUrlResult } from "./normalize-url";

export function normalizeImageUrl(value: string, sourceUrl?: string): NormalizedUrlResult {
  return normalizeUrl(value, sourceUrl);
}
