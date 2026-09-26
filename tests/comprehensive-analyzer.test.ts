import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { extractImages } from "@/lib/analyzer/extract-images";
import { extractMetadata } from "@/lib/analyzer/extract-metadata";
import { extractNavigation } from "@/lib/analyzer/extract-navigation";
import { extractProducts } from "@/lib/analyzer/extract-products";
import { extractSections } from "@/lib/analyzer/extract-sections";
import { fetchPage } from "@/lib/analyzer/fetch-page";
import { inspectPublicUrl } from "@/lib/analyzer/security";

const fixture = (name: string) => readFileSync(path.join(__dirname, "fixtures", name), "utf8");
const pageUrl = "https://fixture.test/catalog/index.html";

function htmlResponse(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", ...init.headers },
    ...init,
  });
}

describe("ReplicaForge fixture extraction suite", () => {
  it("extracts a basic static page, metadata, navigation, and sections", () => {
    const html = fixture("basic-static.html");
    const metadata = extractMetadata(html, "https://fixture.test/home");
    const navigation = extractNavigation(html, "https://fixture.test/home").navigation;
    const sections = extractSections(html, { images: [], products: [] }).sections;

    expect(metadata.metadata.title).toBe("Fixture Studio");
    expect(metadata.metadata.canonical_url).toBe("https://fixture.test/home");
    expect(navigation.trees.length).toBeGreaterThanOrEqual(2);
    expect(sections.some((section) => section.type === "hero")).toBe(true);
  });

  it("covers WooCommerce grids, nested images, sale prices, and associations", () => {
    const result = extractProducts(fixture("woocommerce-grid.html"), pageUrl);
    expect(result.products).toHaveLength(2);
    expect(result.products[0]).toMatchObject({ id: "lamp-1", price: 89, old_price: 120, is_on_sale: true });
    expect(result.products[0]?.image_ids.length).toBeGreaterThan(0);
    expect(result.products[0]?.action_buttons.some((button) => button.type === "buy_via_whatsapp")).toBe(true);
    expect(result.images.some((image) => image.product_id === "lamp-1")).toBe(true);
    expect(result.products[1]?.image_ids.length).toBe(1);
  });

  it("keeps products without images distinct from products with nested images", () => {
    const result = extractProducts(`${fixture("missing-product-images.html")}
      <article class="product-card" data-product-id="nested"><a href="/nested"><div><div><img data-lazy-src="/nested.webp"></div></div><h3>Nested</h3></a></article>`, pageUrl);
    expect(result.products.find((product) => product.id === "empty-1")?.image_ids).toEqual([]);
    expect(result.products.find((product) => product.id === "nested")?.image_ids).toHaveLength(1);
  });

  it("extracts srcset, lazy, background, Open Graph, Twitter, JSON-LD, CDN, and extensionless images", () => {
    const result = extractImages(fixture("image-sources.html"), pageUrl);
    const urls = result.images.map((image) => image.url);
    expect(urls).toContain("https://cdn.fixture.test/hero?width=1400");
    expect(urls).toContain("https://fixture.test/lazy/no-extension");
    expect(urls).toContain("https://cdn.fixture.test/twitter?id=7");
    expect(urls).toContain("https://fixture.test/social/og-image");
    expect(urls).toContain("https://cdn.fixture.test/article?id=8");
    expect(result.counters.lazy_images_found).toBe(1);
    expect(result.counters.background_images_found).toBe(2);
    expect(result.counters.duplicate_images_removed).toBeGreaterThan(0);
    expect(result.images.every((image) => image.rejection === null)).toBe(true);
  });

  it("accepts valid HTTP and HTTPS image URLs instead of misclassifying them as unsupported_protocol", () => {
    const result = extractImages(`<img src="https://cdn.fixture.test/render?id=1"><img src="http://static.fixture.test/image">`, pageUrl);
    expect(result.images).toHaveLength(2);
    expect(result.rejection_reasons.unsupported_protocol).toBe(0);
  });

  it("records invalid image URLs and rejects data URLs while retaining valid sources", () => {
    const result = extractImages(fixture("invalid-images.html"), pageUrl);
    expect(result.images.map((image) => image.url)).toContain("https://fixture.test/valid/no-extension?width=1200");
    expect(result.rejection_reasons.unsupported_protocol).toBe(3);
    expect(result.rejection_reasons.invalid_url).toBe(1);
    expect(result.rejection_records).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: "unsupported_protocol", source_value: "data:image/png;base64,abc" }),
    ]));
  });

  it("extracts metadata and navigation safely from malformed JSON-LD and nested navigation", () => {
    const html = fixture("navigation-metadata.html");
    const metadata = extractMetadata(html, "https://fixture.test/fr");
    const navigation = extractNavigation(html, "https://fixture.test/fr").navigation;
    expect(metadata.invalid_json_ld_count).toBe(1);
    expect(metadata.metadata.json_ld).toHaveLength(1);
    expect(metadata.metadata.open_graph.title).toBe("OG Fixture");
    expect(navigation.trees.some((tree) => tree.children.length > 0)).toBe(true);
    expect(navigation.links.some((link) => link.source_area === "footer")).toBe(true);
  });

  it("handles malformed HTML without throwing and still extracts useful records", () => {
    const html = fixture("malformed.html");
    expect(() => extractMetadata(html, pageUrl)).not.toThrow();
    expect(extractSections(html, { images: [], products: [] }).sections.length).toBeGreaterThan(0);
    expect(extractImages(html, pageUrl).images).toHaveLength(1);
  });
});

describe("ReplicaForge fetch and SSRF fixture suite", () => {
  it("blocks private and metadata targets", () => {
    expect(inspectPublicUrl("http://127.0.0.1:3000").accepted).toBe(false);
    expect(inspectPublicUrl("http://10.0.0.8/internal").accepted).toBe(false);
    expect(inspectPublicUrl("http://169.254.169.254/latest/meta-data").accepted).toBe(false);
    expect(inspectPublicUrl("http://[fd00::1]").accepted).toBe(false);
  });

  it("revalidates redirect targets before fetching them", async () => {
    const fetchMock = vi.fn().mockResolvedValue(htmlResponse("", {
      status: 302,
      headers: { location: "http://169.254.169.254/latest" },
    }));
    const result = await fetchPage("https://fixture.test", { validate_dns: false, fetch_impl: fetchMock });
    expect(result).toMatchObject({ ok: false, code: "ssrf_rejected" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("returns a typed timeout failure", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError"));
    const result = await fetchPage("https://fixture.test", { validate_dns: false, timeout_ms: 1, fetch_impl: fetchMock });
    expect(result).toMatchObject({ ok: false, code: "timeout" });
  });
});
