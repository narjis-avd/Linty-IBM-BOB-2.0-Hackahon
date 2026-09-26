import { inspectPublicUrl } from "./url-policy";

export function isRealExtractedAsset(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  if (/(?:placeholder|placehold\.co|via\.placeholder\.com|dummyimage\.com|spacer|transparent\.gif|blank\.gif)/i.test(value)) return false;
  const inspected = inspectPublicUrl(value.trim());
  return inspected.accepted && Boolean(inspected.url);
}
