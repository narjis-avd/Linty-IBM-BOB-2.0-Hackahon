import { describe, expect, it } from "vitest";
import { normalizeImageUrl } from "@/lib/analyzer/normalize-image-url";
import { normalizeUrl } from "@/lib/analyzer/normalize-url";
import { inspectPublicUrl } from "@/lib/analyzer/security";

describe("URL security and normalization", () => {
  it("accepts public HTTP URLs and removes fragments", () => {
    const result = normalizeUrl("https://example.com/page#section");
    expect(result.accepted).toBe(true);
    expect(result.value).toBe("https://example.com/page");
  });

  it("resolves relative and protocol-relative URLs", () => {
    expect(normalizeUrl("/assets/site.css", "https://example.com/docs").value).toBe("https://example.com/assets/site.css");
    expect(normalizeUrl("//cdn.example.com/image?id=42", "https://example.com").value).toBe("https://cdn.example.com/image?id=42");
  });

  it("rejects dangerous schemes and local targets", () => {
    expect(inspectPublicUrl("data:text/plain,hello").reason).toBe("unsupported_protocol");
    expect(inspectPublicUrl("file:///etc/passwd").reason).toBe("unsupported_protocol");
    expect(inspectPublicUrl("http://localhost:3000").reason).toBe("localhost");
    expect(inspectPublicUrl("http://127.0.0.1").reason).toBe("private_ipv4");
    expect(inspectPublicUrl("http://192.168.1.10").reason).toBe("private_ipv4");
    expect(inspectPublicUrl("http://169.254.169.254/latest").reason).toBe("metadata_service");
    expect(inspectPublicUrl("http://[fd00::1]").reason).toBe("private_ipv6");
  });

  it("keeps CDN query strings and accepts extensionless image URLs", () => {
    const result = normalizeImageUrl("https://images.example-cdn.com/render?id=abc&width=1200", "https://example.com");
    expect(result.accepted).toBe(true);
    expect(result.value).toContain("?id=abc&width=1200");
  });
});
