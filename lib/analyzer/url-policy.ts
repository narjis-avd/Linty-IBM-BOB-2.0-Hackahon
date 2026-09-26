export const URL_REJECTION_REASONS = [
  "invalid_url",
  "unsupported_protocol",
  "localhost",
  "private_ipv4",
  "private_ipv6",
  "link_local",
  "metadata_service",
  "blocked_hostname",
  "dns_resolution_failed",
] as const;

export type UrlRejectionReason = (typeof URL_REJECTION_REASONS)[number];

export interface UrlSecurityResult {
  accepted: boolean;
  url: URL | null;
  reason: UrlRejectionReason | null;
  message: string | null;
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "instance-data",
  "instance-data.ec2.internal",
]);

const METADATA_IPV4 = new Set(["169.254.169.254", "100.100.100.200"]);

function ipv4ToNumber(value: string): number {
  return value.split(".").reduce((total, part) => total * 256 + Number(part), 0);
}

function ipv4InRange(value: string, start: string, end: string): boolean {
  const number = ipv4ToNumber(value);
  return number >= ipv4ToNumber(start) && number <= ipv4ToNumber(end);
}

function isPrivateIpv4(hostname: string): boolean {
  return (
    ipv4InRange(hostname, "0.0.0.0", "0.255.255.255") ||
    ipv4InRange(hostname, "10.0.0.0", "10.255.255.255") ||
    ipv4InRange(hostname, "100.64.0.0", "100.127.255.255") ||
    ipv4InRange(hostname, "127.0.0.0", "127.255.255.255") ||
    ipv4InRange(hostname, "169.254.0.0", "169.254.255.255") ||
    ipv4InRange(hostname, "172.16.0.0", "172.31.255.255") ||
    ipv4InRange(hostname, "192.0.0.0", "192.0.0.255") ||
    ipv4InRange(hostname, "192.168.0.0", "192.168.255.255") ||
    ipv4InRange(hostname, "198.18.0.0", "198.19.255.255") ||
    ipv4InRange(hostname, "224.0.0.0", "255.255.255.255")
  );
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") ||
    normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb") ||
    (normalized.startsWith("::ffff:") && isPrivateIpv4(normalized.slice(7)));
}

function ipVersion(hostname: string): 0 | 4 | 6 {
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) return 4;
  if (hostname.includes(":")) return 6;
  return 0;
}

function result(accepted: boolean, url: URL | null, reason: UrlRejectionReason | null = null, message: string | null = null): UrlSecurityResult {
  return { accepted, url, reason, message };
}

export function inspectPublicUrl(value: string | URL): UrlSecurityResult {
  let url: URL;
  try {
    url = value instanceof URL ? new URL(value.href) : new URL(value);
  } catch {
    return result(false, null, "invalid_url", "The value is not a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return result(false, url, "unsupported_protocol", "Only HTTP and HTTPS URLs are allowed.");

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost")) return result(false, url, "localhost", "Localhost and local hostnames are not allowed.");
  if (hostname.endsWith(".internal")) return result(false, url, "metadata_service", "Cloud metadata and internal hostnames are not allowed.");

  const version = ipVersion(hostname);
  if (version === 4 && isPrivateIpv4(hostname)) {
    if (METADATA_IPV4.has(hostname)) return result(false, url, "metadata_service", "Metadata service IPv4 addresses are not allowed.");
    if (ipv4InRange(hostname, "169.254.0.0", "169.254.255.255")) return result(false, url, "link_local", "Link-local IPv4 addresses are not allowed.");
    return result(false, url, "private_ipv4", "Private IPv4 addresses are not allowed.");
  }
  if (version === 6 && isPrivateIpv6(hostname)) {
    if (/^fe[89a-f]/.test(hostname)) return result(false, url, "link_local", "Link-local IPv6 addresses are not allowed.");
    return result(false, url, "private_ipv6", "Private IPv6 addresses are not allowed.");
  }
  return result(true, url);
}
