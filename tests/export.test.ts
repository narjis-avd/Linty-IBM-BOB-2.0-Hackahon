import { describe, expect, it } from "vitest";
import type { AnalyzerResult } from "@/lib/analyzer/types";
import { analysisExportFilename, isImportableAnalysis, serializeAnalysis } from "@/lib/analyzer/export";

const result: AnalyzerResult = {
  status: "completed",
  website: {
    url: "https://www.example.com/shop",
    final_url: "https://www.example.com/shop/",
    title: "Example Shop",
    description: "A test storefront.",
    website_type: "ecommerce",
    website_type_confidence: 0.8,
    website_type_evidence: ["fixture product evidence"],
    analyzed_at: "2026-09-16T02:03:00.000Z",
    response_status: 200,
    response_time_ms: 120,
  },
  summary: {
    total_unique_images: 1,
    total_raw_image_candidates: 1,
    total_links: 0,
    total_navigation_links: 0,
    total_sections: 0,
    total_ecommerce_products: 1,
    total_content_items: 0,
    total_warnings: 0,
  },
  metadata: {
    title: "Example Shop",
    meta_description: "A test storefront.",
    canonical_url: "https://www.example.com/shop/",
    language: "en",
    viewport: "width=device-width",
    favicon_candidates: [],
    open_graph: { title: null, description: null, url: null, image: null, type: null, site_name: null, locale: null },
    twitter: { card: null, title: null, description: null, image: null, site: null, creator: null },
    json_ld: [],
    social_links: [],
  },
  navigation: { trees: [], links: [], primary_links: [], footer_links: [], breadcrumb_links: [], social_links: [], product_links: [], content_links: [], external_links: [] },
  sections: [],
  products: [{ id: "product-1", entity_id: "ecommerce_product:https://www.example.com/item", title: "Item", url: "https://www.example.com/item", price: 10, old_price: null, currency: "USD", is_on_sale: false, product_type: "physical", description: null, image_ids: ["image-1"], source_selector: null, source_url: null, action_buttons: [], classification_reason: "fixture product", evidence: ["fixture"], occurrence_count: 1, source_selectors: [], source_section_ids: [], original_urls: ["https://www.example.com/item"] }],
  content_items: [],
  images: [{ id: "image-1", url: "https://cdn.example.com/item.webp?width=640", canonical_url: "https://cdn.example.com/item.webp?width=640", normalized_url: "https://cdn.example.com/item.webp?width=640", identity: "https://cdn.example.com/item.webp", original_urls: ["/item.webp?width=640"], variant_urls: [], extraction_sources: ["src"], occurrence_count: 1, alt_values: ["Item"], roles: ["product"], associated_section_ids: [], associated_product_ids: ["product-1"], preview_status: "not_checked", alt_text: "Item", width: null, height: null, role: "product", source: "src", section_id: null, product_id: "product-1", original_source_value: "/item.webp?width=640", rejection: null }],
  image_references: [],
  image_variants: [],
  previewable_images: [],
  rejected_images: [],
  all_links: [],
  navigation_links: [],
  primary_navigation_links: [],
  footer_links: [],
  breadcrumb_links: [],
  social_links: [],
  product_links: [],
  content_links: [],
  external_links: [],
  links: [],
  debug: { counters: [], rejection_reasons: [], rejection_records: [], extraction_warnings: [], processing_stages: [], duration_ms: 120 },
};

describe("analysis export", () => {
  it("round-trips the complete analyzer result without dropping relationships", () => {
    const parsed: unknown = JSON.parse(serializeAnalysis(result));
    expect(isImportableAnalysis(parsed)).toBe(true);
    if (isImportableAnalysis(parsed)) {
      expect(parsed.products[0]?.image_ids).toEqual(["image-1"]);
      expect(parsed.images[0]?.product_id).toBe("product-1");
    }
  });

  it("uses the hostname and analysis date in a safe filename", () => {
    expect(analysisExportFilename(result)).toBe("www-example-com-2026-09-16-analysis.json");
  });
});
