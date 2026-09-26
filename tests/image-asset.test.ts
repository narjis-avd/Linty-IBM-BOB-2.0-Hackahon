import { describe, expect, it } from "vitest";
import { isRealExtractedAsset } from "@/lib/analyzer/image-asset";

describe("isRealExtractedAsset", () => {
  it("accepts public HTTP(S), SVG, extensionless, query, and long URLs", () => {
    expect(isRealExtractedAsset("https://cdn.example.com/image?id=42")).toBe(true);
    expect(isRealExtractedAsset("http://cdn.example.com/logo.svg")).toBe(true);
    expect(isRealExtractedAsset(`https://cdn.example.com/${"a".repeat(500)}`)).toBe(true);
  });

  it("rejects missing, malformed, unsafe, and private URLs", () => {
    expect(isRealExtractedAsset("")).toBe(false);
    expect(isRealExtractedAsset(undefined)).toBe(false);
    expect(isRealExtractedAsset("not a url")).toBe(false);
    expect(isRealExtractedAsset("data:image/png;base64,abc")).toBe(false);
    expect(isRealExtractedAsset("blob:https://example.com/id")).toBe(false);
    expect(isRealExtractedAsset("https://127.0.0.1/image.png")).toBe(false);
  });
});
