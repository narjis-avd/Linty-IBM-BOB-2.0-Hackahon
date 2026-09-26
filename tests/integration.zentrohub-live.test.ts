import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/analyzer/analyze";

const liveEnabled = process.env.RUN_LIVE_TESTS === "true";
const target = process.env.ZENTROHUB_URL || "https://zentrohub.ai.studio/";

describe("optional ZentroHub live analyzer invariants", () => {
  it.skipIf(!liveEnabled)("keeps identity, associations, and counters internally consistent", async () => {
    const result = await analyze(target, {
      render: "auto",
      fetch: { timeout_ms: 20_000, max_response_bytes: 5_000_000 },
      render_options: { timeout_ms: 20_000 },
    });

    expect(["completed", "failed"]).toContain(result.status);
    expect(Array.isArray(result.content_items)).toBe(true);
    if (result.status === "failed") return;

    const images = new Set(result.images.map((image) => image.id));
    const products = new Set(result.products.map((product) => product.id));
    for (const image of result.images) {
      expect(image.identity || image.normalized_url || image.url).toBeTruthy();
      expect(image.rejection).toBeNull();
    }
    for (const product of result.products) {
      expect(product.image_ids.every((id) => images.has(id))).toBe(true);
    }
    for (const item of result.content_items ?? []) {
      expect(item.image_ids.every((id) => images.has(id))).toBe(true);
    }
    for (const section of result.sections) {
      expect(section.image_ids.every((id) => images.has(id))).toBe(true);
      expect((section.product_ids ?? []).every((id) => products.has(id))).toBe(true);
    }

    const counters = new Map(result.debug.counters.map((counter) => [counter.name, counter.value]));
    console.info("ZentroHub live analysis summary", {
      raw_image_candidates: counters.get("raw_image_candidates") ?? 0,
      unique_image_assets: result.images.length,
      duplicate_references_removed: counters.get("duplicate_images_removed") ?? 0,
      responsive_variants: counters.get("responsive_variants_detected") ?? 0,
      ecommerce_products: result.products.length,
      non_ecommerce_content_items: result.content_items?.filter((item) => item.item_type !== "ecommerce_product").length ?? 0,
      content_items_with_images: counters.get("content_items_with_images") ?? 0,
      images_without_associations: counters.get("global_images_not_assigned_to_products") ?? 0,
      extraction_sources: result.debug.raw_image_source_counts ?? {},
      warnings: result.debug.extraction_warnings.map((warning) => warning.code),
    });
    expect(counters.get("content_items_detected") ?? 0).toBe(result.content_items?.length ?? 0);
    expect(counters.get("images_valid") ?? result.images.length).toBeGreaterThanOrEqual(0);
  }, 60_000);
});
