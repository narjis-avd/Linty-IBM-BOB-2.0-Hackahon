import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AnalysisWorkspace } from "@/components/analysis-workspace";
import { analyze } from "@/lib/analyzer/analyze";
import { extractImages } from "@/lib/analyzer/extract-images";
import { extractProducts } from "@/lib/analyzer/extract-products";
import { isRealExtractedAsset } from "@/lib/analyzer/image-asset";
import { normalizeAnalysisResult } from "@/lib/analyzer/normalize-result";
import { normalizeUrl } from "@/lib/analyzer/normalize-url";
import { inspectPublicUrl } from "@/lib/analyzer/url-policy";

const pageUrl = "https://shop.example.com/catalog";
const forbiddenImageServices = [
  "https://placehold.co/600x400",
  "https://via.placeholder.com/600",
  "https://dummyimage.com/600x400",
];

describe("analysis data integrity", () => {
  it("does not admit fake image URLs into extracted assets", () => {
    const result = extractImages(`<img src="/real/product.webp"><img src="https://example.invalid/fake-generated.webp">`, pageUrl);
    expect(result.images.map((image) => image.url)).toEqual([
      "https://shop.example.com/real/product.webp",
      "https://example.invalid/fake-generated.webp",
    ]);
    expect(result.images.every((image) => image.original_source_value !== null)).toBe(true);
    expect(result.images.some((image) => image.url.includes("fake") && image.original_source_value === null)).toBe(false);
  });

  it("rejects placeholder image service URLs instead of extracting them", () => {
    const result = extractImages(forbiddenImageServices.map((url) => `<img src="${url}">`).join(""), pageUrl);
    expect(result.images).toEqual([]);
    expect(result.rejection_reasons.placeholder_image).toBe(forbiddenImageServices.length);
  });

  it("keeps missing images empty and never substitutes a fallback asset", () => {
    const result = extractImages("<main><h1>Products</h1></main>", pageUrl);
    expect(result.images).toEqual([]);
    expect(result.images.some((image) => forbiddenImageServices.includes(image.url))).toBe(false);
  });

  it("keeps missing products empty and never creates demo products", () => {
    const result = extractProducts("<main><h1>Catalog</h1><p>No products here.</p></main>", pageUrl);
    expect(result.products).toEqual([]);
    expect(result.images).toEqual([]);
  });

  it("preserves missing prices as null", () => {
    const result = extractProducts(`<article class="product-card" data-product-id="no-price"><h2>Unpriced item</h2></article>`, pageUrl);
    expect(result.products[0]).toMatchObject({ id: "no-price", title: "Unpriced item", price: null, old_price: null });
  });

  it("does not normalize a failed API result into a successful empty result", () => {
    expect(normalizeAnalysisResult({ status: "failed", website: { url: pageUrl } }, pageUrl)).toBeNull();
    expect(normalizeAnalysisResult({ ok: false, result: { status: "failed" } }, pageUrl)).toBeNull();
  });

  it("accepts valid HTTP and HTTPS image URLs without unsupported_protocol rejection", () => {
    const result = extractImages(`<img src="http://cdn.example/image?id=1"><img src="https://cdn.example/extensionless?id=2">`, pageUrl);
    expect(result.images).toHaveLength(2);
    expect(result.rejection_reasons.unsupported_protocol).toBe(0);
  });

  it("does not reject images when dimensions are unknown", () => {
    const result = extractImages(`<img src="/unknown-size.webp">`, pageUrl);
    expect(result.images[0]).toMatchObject({ width: null, height: null });
    expect(result.rejection_reasons.invalid_url).toBe(0);
  });

  it("associates product images only with the owning product", () => {
    const result = extractProducts(`
      <img class="hero" src="/hero.webp">
      <article class="product-card" data-product-id="one"><h2>One</h2><img src="/one.webp"></article>
      <article class="product-card" data-product-id="two"><h2>Two</h2><img src="/two.webp"></article>
    `, pageUrl);
    const one = result.products.find((product) => product.id === "one");
    const two = result.products.find((product) => product.id === "two");
    expect(one?.image_ids).toHaveLength(1);
    expect(two?.image_ids).toHaveLength(1);
    expect(result.images.find((image) => image.url.endsWith("/hero.webp"))).toBeUndefined();
    expect(result.images.find((image) => image.url.endsWith("/one.webp"))?.product_id).toBe("one");
    expect(result.images.find((image) => image.url.endsWith("/two.webp"))?.product_id).toBe("two");
  });

  it("does not assign a global hero image to every product", async () => {
    const result = await analyze("https://example.com/catalog", {
      render: "never",
      fetch: {
        validate_dns: false,
        fetch_impl: vi.fn().mockResolvedValue(new Response(`
          <main><img class="hero" src="/hero.webp">
          <article class="product-card" data-product-id="one"><h2>One</h2><img src="/one.webp"></article>
          <article class="product-card" data-product-id="two"><h2>Two</h2></article></main>
        `, { status: 200, headers: { "content-type": "text/html" } })),
      },
    });
    expect(result.products.find((product) => product.id === "one")?.image_ids).toHaveLength(1);
    expect(result.products.find((product) => product.id === "two")?.image_ids).toEqual([]);
    expect(result.products.every((product) => !product.image_ids.includes("image-1"))).toBe(true);
  });

  it("rejects invalid image URLs with an explicit reason", () => {
    const result = extractImages(`<img src="data:image/png;base64,abc"><img src="javascript:alert(1)"><img src="http://[">`, pageUrl);
    expect(result.images).toEqual([]);
    expect(result.rejection_records.map((record) => record.reason)).toEqual([
      "unsupported_protocol",
      "unsupported_protocol",
      "invalid_url",
    ]);
  });

  it("renders an empty dashboard workspace without crashing", () => {
    const markup = renderToStaticMarkup(<AnalysisWorkspace />);
    expect(markup).toContain("No analysis performed");
  });

  it("normalizes a partial result to safe arrays for dashboard rendering", () => {
    const result = normalizeAnalysisResult({ status: "completed", website: { url: pageUrl }, metadata: null }, pageUrl);
    expect(result).not.toBeNull();
    expect(result?.products).toEqual([]);
    expect(result?.images).toEqual([]);
    expect(result?.sections).toEqual([]);
    expect(result?.links).toEqual([]);
    expect(result?.navigation.trees).toEqual([]);
    expect(result?.metadata.open_graph.image).toBeNull();
  });

  it("removes dangling image and product associations during normalization", () => {
    const result = normalizeAnalysisResult({
      status: "completed",
      website: { url: pageUrl },
      images: [{ id: "real" }],
      products: [{ id: "product", image_ids: ["real", "missing"] }],
      content_items: [{ id: "item", image_ids: ["missing"] }],
      sections: [{ id: "section", image_ids: ["missing"], product_ids: ["missing"] }],
    }, pageUrl);
    expect(result?.products[0]?.image_ids).toEqual(["real"]);
    expect(result?.content_items?.[0]?.image_ids).toEqual([]);
    expect(result?.sections[0]?.image_ids).toEqual([]);
    expect(result?.sections[0]?.product_ids).toEqual([]);
  });

  it("accepts bare domains while preserving explicit protocols", () => {
    expect(normalizeUrl("acn.com.pk").value).toBe("https://acn.com.pk/");
    expect(normalizeUrl("www.example.com/page").value).toBe("https://www.example.com/page");
    expect(normalizeUrl("http://example.com").value).toBe("http://example.com/");
  });

  it("continues blocking SSRF and private URLs", () => {
    for (const url of ["http://localhost", "http://127.0.0.1", "http://10.0.0.1", "http://169.254.169.254", "http://[::1]"]) {
      expect(inspectPublicUrl(url).accepted, url).toBe(false);
    }
  });

  it("never treats unsafe or fabricated values as renderable extracted assets", () => {
    expect(isRealExtractedAsset("https://cdn.example/image.webp?width=800")).toBe(true);
    expect(isRealExtractedAsset("data:image/png;base64,abc")).toBe(false);
    expect(isRealExtractedAsset("https://placehold.co/600x400")).toBe(false);
    expect(isRealExtractedAsset(undefined)).toBe(false);
  });
});
