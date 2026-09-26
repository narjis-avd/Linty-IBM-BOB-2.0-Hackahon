import { describe, expect, it } from "vitest";
import { extractImages } from "@/lib/analyzer/extract-images";

describe("extractImages", () => {
  it("extracts prioritized, relative, CDN, metadata, background, and extensionless images", () => {
    const result = extractImages(
      `<picture><source srcset="/picture.webp 1x"></picture>
       <img class="hero" src="/fallback.jpg" srcset="/small.jpg 480w, https://cdn.test/render?id=1 1024w" data-src="/lazy.webp" data-lazy-srcset="/lazy-large.webp 2x" width="unknown">
       <div style="background-image:url('/bg')"></div>
       <meta property="og:image" content="/og.png"><meta name="twitter:image" content="https://cdn.test/social?id=2">
       <script type="application/ld+json">{"@type":"Article","image":"https://cdn.test/article"}</script>`,
      "https://example.com/page",
    );
    expect(result.images.map((image) => image.url)).toContain("https://example.com/lazy.webp");
    expect(result.images.map((image) => image.url)).toContain("https://cdn.test/render?id=1");
    expect(result.images.map((image) => image.url)).toContain("https://example.com/bg");
    expect(result.images.map((image) => image.url)).toContain("https://cdn.test/social?id=2");
    expect(result.counters.lazy_images_found).toBe(1);
    expect(result.counters.hero_images_found).toBeGreaterThanOrEqual(1);
    expect(result.images.find((image) => image.url === "https://example.com/lazy.webp")?.source_element?.tag_name).toBe("img");
    expect(result.images.map((image) => image.url)).toContain("https://example.com/picture.webp");
  });

  it("rejects data and malformed URLs, and removes duplicates without requiring dimensions", () => {
    const result = extractImages(
      `<img src="data:image/png;base64,abc"><img src="/same.png"><img data-src="https://cdn.test/same.png?width=2"><img src="/same.png"><img src="http://[">`,
      "https://example.com",
    );
    expect(result.images).toHaveLength(2);
    expect(result.counters.duplicate_images_removed).toBe(1);
    expect(result.rejection_reasons.unsupported_protocol).toBe(1);
    expect(result.rejection_reasons.invalid_url).toBe(1);
    expect(result.images[0]?.width).toBeNull();
    const dataRejection = result.rejection_records.find((record) => record.reason === "unsupported_protocol");
    expect(dataRejection).toMatchObject({
      source_value: "data:image/png;base64,abc",
      extraction_source: "src",
      normalized_value: null,
    });
    expect(dataRejection?.parent_context?.tag_name).toBe("img");
    expect(result.images.find((image) => image.url === "https://example.com/same.png")).toMatchObject({
      canonical_url: "https://example.com/same.png",
      original_urls: ["/same.png"],
      variant_urls: [],
      occurrence_count: 2,
      extraction_sources: ["src"],
      preview_status: "not_checked",
    });
    expect(result.image_references).toHaveLength(3);
    expect(result.counters.normalized_image_candidates).toBe(3);
  });

  it("keeps one asset for HTML, Open Graph, and responsive references while preserving variants", () => {
    const result = extractImages(
      `<img src="/hero.jpg" srcset="/hero.jpg 1x, /hero.jpg?width=1200 2x" alt="Hero">
       <meta property="og:image" content="https://example.com/hero.jpg?width=800">`,
      "https://example.com/",
    );
    expect(result.images).toHaveLength(1);
    expect(result.images[0]?.occurrence_count).toBe(4);
    expect(result.images[0]?.roles).toContain("hero");
    expect(result.images[0]?.extraction_sources).toEqual(expect.arrayContaining(["src", "srcset", "og_image"]));
    expect(result.images[0]?.variant_urls).toEqual(expect.arrayContaining([
      "https://example.com/hero.jpg?width=1200",
      "https://example.com/hero.jpg?width=800",
    ]));
    expect(result.image_variants).toHaveLength(2);
    expect(result.counters.responsive_variants_detected).toBe(2);
    expect(result.counters.duplicate_images_removed).toBe(3);
  });

  it("only treats JSON-LD image fields as image sources", () => {
    const result = extractImages(
      `<script type="application/ld+json">{"@type":"Product","url":"https://example.com/product","sameAs":"https://social.example/profile","image":{"contentUrl":"https://cdn.example/product.webp"}}</script>`,
      "https://example.com",
    );
    expect(result.images.map((image) => image.url)).toEqual(["https://cdn.example/product.webp"]);
  });

  it("extracts lazy attributes, CSS, noscript, and image references in state scripts with diagnostics", () => {
    const result = extractImages(
      `<img data-large_image="/large.webp" data-background="https://cdn.example/bg?id=1">
       <div style="background:url(&quot;/css-image.webp&quot;)"></div>
       <noscript><img src="/noscript.webp"></noscript>
       <script>window.state={image:"/state.webp", unrelated:"not-an-image"}</script>`,
      "https://example.com/catalog",
    );
    const urls = result.images.map((image) => image.url);
    expect(urls).toEqual(expect.arrayContaining([
      "https://example.com/large.webp",
      "https://cdn.example/bg?id=1",
      "https://example.com/css-image.webp",
      "https://example.com/noscript.webp",
      "https://example.com/state.webp",
    ]));
    expect(result.source_counts.lazy).toBeGreaterThanOrEqual(2);
    expect(result.raw_samples.some((sample) => sample.value === "/state.webp")).toBe(true);
  });

  it("extracts WordPress optimizer lazy attributes used by WooCommerce themes", () => {
    const result = extractImages(
      `<li class="product"><img class="attachment-woocommerce_thumbnail" bv-data-src="/wp-content/uploads/item-300x300.webp" bv-data-srcset="/wp-content/uploads/item-300x300.webp 300w, /wp-content/uploads/item.webp 800w"></li>`,
      "https://example.com/shop",
    );
    expect(result.images.map((image) => image.url)).toEqual(expect.arrayContaining([
      "https://example.com/wp-content/uploads/item-300x300.webp",
      "https://example.com/wp-content/uploads/item.webp",
    ]));
    expect(result.raw_source_counts["bv_data_src_candidates"]).toBe(1);
    expect(result.raw_source_counts["bv_data_srcset_candidates"]).toBe(1);
    expect(result.raw_source_counts.woocommerce_candidates).toBe(1);
  });
});
