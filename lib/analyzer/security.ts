import { lookup } from "node:dns/promises";
import { inspectPublicUrl, type UrlSecurityResult } from "./url-policy";

export * from "./url-policy";

export async function inspectPublicUrlWithDns(value: string | URL): Promise<UrlSecurityResult> {
  const lexical = inspectPublicUrl(value);
  if (!lexical.accepted || !lexical.url) return lexical;

  try {
    const records = await lookup(lexical.url.hostname, { all: true, verbatim: true });
    for (const record of records) {
      const resolved = inspectPublicUrl(`${lexical.url.protocol}//${record.address}`);
      if (!resolved.accepted) return { ...resolved, url: lexical.url, message: "The hostname resolves to a blocked network address." };
    }
    return lexical;
  } catch {
    return { ...lexical, accepted: false, reason: "dns_resolution_failed", message: "The hostname could not be resolved safely." };
  }
}
