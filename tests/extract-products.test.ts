import { describe, expect, it } from "vitest";
import { extractProducts } from "@/lib/analyzer/extract-products";

const pageUrl = "https://shop.example.com/catalog";

describe("extractProducts", () => {
  it("extracts WooCommerce cards, nested lazy images, sale prices, and actions", () => {
    const result = extractProducts(
      `<ul>
        <li class="product sale" data-product-id="sku-1">
          <a class="woocommerce-LoopProduct-link" href="/products/one">
            <div class="media"><img data-lazy-src="/images/one.webp"></div><h2 class="woocommerce-loop-product__title">One Lamp</h2>
          </a>
          <span class="price"><del>$1,200.00</del><ins>$999.50</ins></span>
          <a href="https://wa.me/123?text=Buy">Buy via WhatsApp</a><button>Add to cart</button>
        </li>
      </ul>`,
      pageUrl,
    );
    expect(result.products).toHaveLength(1);
    expect(result.products[0]).toMatchObject({
      id: "sku-1",
      title: "One Lamp",
      price: 999.5,
      old_price: 1200,
      is_on_sale: true,
    });
    expect(result.products[0]?.image_ids).toHaveLength(1);
    expect(result.products[0]?.action_buttons.map((action) => action.type)).toEqual(["buy_via_whatsapp", "add_to_cart"]);
    expect(result.images[0]?.product_id).toBe("sku-1");
    expect(result.products[0]?.classification_reason).toContain("ecommerce_product");
    expect(result.content_items).toEqual([]);
  });

  it("supports products without images, deduplicates cards, and keeps nested associations", () => {
    const html = `<article class="product-card" data-product-id="plain"><a href="/plain"><h3>Plain item</h3></a><span class="price">€ 12,50</span></article>
      <article class="product-card" data-product-id="plain"><a href="/plain"><h3>Plain item</h3></a><span class="price">€ 12,50</span></article>
      <article class="product-card" data-product-id="nested"><a href="/nested"><div><div><img src="https://cdn.example/image?id=1"></div></div><h3>Nested item</h3></a><span class="price">$12</span></article>`;
    const result = extractProducts(html, pageUrl);
    expect(result.products).toHaveLength(2);
    expect(result.products.find((product) => product.id === "plain")?.image_ids).toEqual([]);
    expect(result.products.find((product) => product.id === "nested")?.image_ids).toHaveLength(1);
    expect(result.images[0]?.product_id).toBe("nested");
  });

  it("assigns stable page-wide image IDs across recursively nested WooCommerce cards", () => {
    const result = extractProducts(
      `<ul class="products"><li class="product" data-product-id="one"><div><div><img src="/one.webp"></div></div><h2>One</h2><span class="price">$1</span></li>
      <li class="product" data-product-id="two"><div><div><img src="/two.webp"></div></div><h2>Two</h2><span class="price">$2</span></li></ul>`,
      pageUrl,
    );
    expect(new Set(result.images.map((image) => image.id)).size).toBe(result.images.length);
    expect(result.products.every((product) => product.image_ids.length === 1)).toBe(true);
    expect(result.products[0]?.image_ids[0]).not.toBe(result.products[1]?.image_ids[0]);
  });

  it("deduplicates CDN image variants while retaining the first source URL", () => {
    const result = extractProducts(
      `<article class="product-card" data-product-id="one"><h2>One</h2>
        <img src="/one.webp?w=320&q=60"><img src="/one.webp?width=1200&format=webp"></article>`,
      pageUrl,
    );
    expect(result.images).toHaveLength(1);
    expect(result.products[0]?.image_ids).toHaveLength(1);
    expect(result.images[0]?.identity).toBe("https://shop.example.com/one.webp");
  });

  it("detects linked, service, SaaS, and generic cards without inventing values", () => {
    const result = extractProducts(`
      <section>
        <article class="service-card"><h3>Audit service</h3><p>Real service</p><a href="/audit">Learn more</a></article>
        <article class="saas-card"><h3>Cloud platform</h3><a href="/platform">Explore</a></article>
        <article class="content-card"><h3>Resource</h3><p>Useful guide</p></article>
        <article><h3>Linked story</h3><a href="/story">Read</a></article>
      </section>`, pageUrl);
    expect(result.content_items.map((item) => item.item_type)).toEqual(["service", "generic_content_card", "generic_content_card", "generic_content_card"]);
    expect(result.content_items.every((item) => item.title && item.source_url === pageUrl)).toBe(true);
    expect(result.content_items.every((item) => item.image_ids.every((id) => result.images.some((image) => image.id === id)))).toBe(true);
    expect(result.products).toEqual([]);
    expect(result.content_items.every((item) => item.classification_reason.length > 0)).toBe(true);
  });

  it("deduplicates responsive and hidden references while preserving occurrences", () => {
    const result = extractProducts(`
      <section id="featured">
        <article class="product-card" data-product-id="sku-7"><a href="/products/widget"><h2>Widget</h2></a><span class="price">$10</span></article>
        <article class="product-card mobile"><a href="/products/widget"><h2>Widget</h2></a><span class="price">$10</span></article>
        <article class="product-card" hidden data-product-id="sku-7"><a href="/products/widget"><h2>Widget</h2></a><span class="price">$10</span></article>
        <article class="product-card swiper-slide-duplicate" data-product-id="sku-7"><a href="/products/widget"><h2>Widget</h2></a><span class="price">$10</span></article>
      </section>`, pageUrl);
    expect(result.products).toHaveLength(1);
    expect(result.products[0]?.entity_id).toContain("sku-7");
    expect(result.products[0]?.occurrence_count).toBe(2);
    expect(result.counters.raw_product_candidates).toBeGreaterThanOrEqual(4);
    expect(result.counters.hidden_duplicates_removed).toBe(1);
    expect(result.counters.carousel_clones_removed).toBe(1);
    expect(result.counters.duplicate_entities_removed).toBe(1);
    expect(result.products[0]?.source_selectors.length).toBeGreaterThan(0);
  });
});
