import { describe, expect, it } from "vitest";
import { normalizeAnalysisResult } from "@/lib/analyzer/normalize-result";

describe("normalizeAnalysisResult", () => {
  it("preserves a complete result", () => {
    const result = normalizeAnalysisResult({
      status: "completed",
      website: { url: "https://example.com", analyzed_at: "2026-01-01T00:00:00.000Z" },
      metadata: { title: "Example", json_ld: [] },
      navigation: { trees: [], links: [] },
      sections: [],
      products: [],
      images: [],
      links: [],
      debug: { counters: [], rejection_reasons: [], extraction_warnings: [], processing_stages: [], duration_ms: 10 },
    });
    expect(result?.website.url).toBe("https://example.com");
    expect(result?.metadata.title).toBe("Example");
    expect(result?.debug.duration_ms).toBe(10);
  });

  it("fills safe arrays and nullable metadata for an empty or partial result", () => {
    const result = normalizeAnalysisResult({ status: "completed", website: { url: "https://example.com" } });
    expect(result).not.toBeNull();
    expect(result?.metadata.title).toBeNull();
    expect(result?.metadata.json_ld).toEqual([]);
    expect(result?.navigation.trees).toEqual([]);
    expect(result?.navigation.links).toEqual([]);
    expect(result?.sections).toEqual([]);
    expect(result?.products).toEqual([]);
    expect(result?.images).toEqual([]);
    expect(result?.links).toEqual([]);
    expect(result?.debug.extraction_warnings).toEqual([]);
  });

  it("preserves missing image dimensions and products without images", () => {
    const result = normalizeAnalysisResult({
      status: "completed",
      website: { url: "https://example.com" },
      products: [{ id: "p1", title: "Product", image_ids: [] }],
      images: [{ id: "i1", url: "https://cdn.example/image", width: null, height: null }],
    });
    expect(result?.products).toHaveLength(1);
    expect(result?.products[0]?.image_ids).toEqual([]);
    expect(result?.images[0]).toMatchObject({ width: null, height: null });
  });

  it("does not normalize failed or invalid payloads into successful results", () => {
    expect(normalizeAnalysisResult({ status: "failed", website: {} })).toBeNull();
    expect(normalizeAnalysisResult(null)).toBeNull();
  });

  it("derives a canonical summary and removes ecommerce duplicates from content items", () => {
    const result = normalizeAnalysisResult({
      status: "completed",
      website: { url: "https://example.com" },
      navigation: { links: [{ url: "https://example.com/a" }] },
      links: [{ url: "https://example.com/a" }, { url: "https://example.com/b" }],
      products: [{ id: "p1", title: "Product", image_ids: [] }],
      content_items: [
        { id: "p1", title: "Product", item_type: "ecommerce", image_ids: [] },
        { id: "c1", title: "Article", item_type: "blog", image_ids: [] },
      ],
      images: [{ id: "i1", url: "https://cdn.example/image.webp" }],
      sections: [{ id: "s1", heading: "Hero", image_ids: [] }],
      debug: { counters: [{ name: "raw_image_candidates", value: 3 }], extraction_warnings: [{ code: "notice", message: "Notice", source: null }] },
    });
    expect(result?.content_items).toHaveLength(1);
    expect(result?.summary).toEqual({
      total_unique_images: 1,
      total_raw_image_candidates: 3,
      total_links: 2,
      total_navigation_links: 1,
      total_sections: 1,
      total_ecommerce_products: 1,
      total_content_items: 1,
      total_warnings: 1,
    });
  });
});
