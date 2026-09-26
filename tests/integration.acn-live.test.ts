import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/analyzer/analyze";
import type { AnalyzerResult } from "@/lib/analyzer/types";

const liveEnabled = process.env.RUN_LIVE_TESTS === "true";

describe("optional ACN live analyzer integration", () => {
  it.skipIf(!liveEnabled)(
    "analyzes acn.com.pk without violating analyzer invariants",
    async () => {
      const result = await analyze("https://acn.com.pk/", {
        render: "auto",
        fetch: {
          timeout_ms: 20_000,
          max_response_bytes: 5_000_000,
        },
        render_options: {
          timeout_ms: 20_000,
        },
      });

      expect(isAnalyzerResultShape(result)).toBe(true);
      expect(["completed", "failed"]).toContain(result.status);

      if (result.status === "failed") {
        expect(result.debug.extraction_warnings.some((warning) => warning.code === "analysis_failed")).toBe(true);
        console.warn(`ACN live analysis returned a controlled failure: ${failureSummary(result)}`);
        return;
      }

      const counters = new Map(result.debug.counters.map((counter) => [counter.name, counter.value]));
      const summary = {
        products_detected: counters.get("products_detected") ?? result.products.length,
        images_scanned: counters.get("images_scanned") ?? 0,
        valid_images: counters.get("images_valid") ?? result.images.length,
        rejected_images: counters.get("images_rejected") ?? 0,
        products_with_images: counters.get("products_with_images") ?? result.products.filter((product) => product.image_ids.length > 0).length,
        products_without_images: counters.get("products_without_images") ?? result.products.filter((product) => product.image_ids.length === 0).length,
      };
      console.info("ACN live analysis summary", summary);
      console.info("ACN live image diagnostics", {
        raw_image_candidates: counters.get("raw_image_candidates") ?? 0,
        valid_image_urls: counters.get("valid_image_urls") ?? result.images.length,
        rejected_image_urls: counters.get("rejected_image_urls") ?? 0,
        product_cards_with_image_markup: counters.get("product_cards_with_image_markup") ?? 0,
        product_images_associated: counters.get("product_images_associated") ?? 0,
        global_images_not_assigned_to_products: counters.get("global_images_not_assigned_to_products") ?? 0,
        source_counts: result.debug.raw_image_source_counts ?? {},
        warnings: result.debug.extraction_warnings.map((warning) => warning.code),
        extraction_phases: [...new Set(result.images.map((image) => image.extraction_phase).filter(Boolean))],
      });

      expect(summary.products_detected).toBeGreaterThanOrEqual(0);
      expect(summary.images_scanned).toBeGreaterThanOrEqual(0);
      expect(summary.valid_images).toBeGreaterThanOrEqual(0);
      expect(summary.rejected_images).toBeGreaterThanOrEqual(0);
      expect(summary.products_with_images).toBeGreaterThanOrEqual(0);
      expect(summary.products_without_images).toBeGreaterThanOrEqual(0);

      for (const image of result.images) {
        expect(["http:", "https:"].includes(new URL(image.url).protocol)).toBe(true);
        expect(image.rejection).toBeNull();
      }

      for (const rejection of result.debug.rejection_records ?? []) {
        if (!rejection.source_value) continue;
        let sourceUrl: URL;
        try {
          sourceUrl = new URL(rejection.source_value);
        } catch {
          continue;
        }
        if (rejection.reason === "unsupported_protocol") {
          expect(["http:", "https:"].includes(sourceUrl.protocol)).toBe(false);
        }
      }
    },
    60_000,
  );
});

function isAnalyzerResultShape(value: AnalyzerResult): boolean {
  return Boolean(value.website)
    && Boolean(value.metadata)
    && Boolean(value.navigation)
    && Boolean(value.debug)
    && Array.isArray(value.sections)
    && Array.isArray(value.products)
    && Array.isArray(value.images)
    && Array.isArray(value.links)
    && Array.isArray(value.debug.counters)
    && Array.isArray(value.debug.rejection_reasons)
    && Array.isArray(value.debug.extraction_warnings);
}

function failureSummary(result: AnalyzerResult): string {
  return result.debug.extraction_warnings
    .filter((warning) => warning.code === "analysis_failed")
    .map((warning) => warning.message)
    .join("; ") || "No failure detail reported.";
}
