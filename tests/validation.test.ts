import { describe, expect, it } from "vitest";
import { websiteUrlSchema } from "@/lib/validation";
import { normalizeUrl } from "@/lib/analyzer/normalize-url";

describe("websiteUrlSchema", () => {
  it("normalizes bare domains and preserves explicit protocols", () => {
    expect(websiteUrlSchema.parse(" acn.com.pk ")).toBe("https://acn.com.pk/");
    expect(websiteUrlSchema.parse("www.acn.com.pk")).toBe("https://www.acn.com.pk/");
    expect(websiteUrlSchema.parse("www.example.com/page")).toBe("https://www.example.com/page");
    expect(websiteUrlSchema.parse("https://acn.com.pk/products")).toBe("https://acn.com.pk/products");
    expect(websiteUrlSchema.parse("http://acn.com.pk")).toBe("http://acn.com.pk/");
  });

  it("rejects invalid, unsupported, local, and private values", () => {
    for (const value of ["", "random words", "not-a-url", "javascript:alert(1)", "data:text/plain,hello", "file:///tmp/site", "blob:https://example.com/id", "https://localhost", "https://127.0.0.1", "https://192.168.1.10", "ftp://example.com"]) {
      expect(websiteUrlSchema.safeParse(value).success, value).toBe(false);
    }
  });

  it("returns the normalized value from the shared URL utility", () => {
    expect(normalizeUrl("  https://acn.com.pk/products#details  ").value).toBe("https://acn.com.pk/products");
    expect(normalizeUrl("https://127.0.0.1").reason).toBe("private_ipv4");
  });
});
