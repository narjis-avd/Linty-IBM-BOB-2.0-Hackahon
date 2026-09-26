import { describe, expect, it } from "vitest";
import { extractSections } from "@/lib/analyzer/extract-sections";

describe("extractSections", () => {
  it("extracts ordered semantic sections and associates images and products", () => {
    const result = extractSections(
      `<header><h1>Forge</h1></header>
       <main>
         <section id="hero" class="hero"><h2>Build faster</h2><img src="/hero.png"><p>Useful hero copy.</p></section>
         <section class="product-grid"><h2>Featured products</h2><article class="product-card" data-product-id="p1"><a href="/p1"><img src="/p1.png"><h3>Product one</h3></a></article></section>
         <section class="pricing"><h2>Plans</h2><p>Choose a plan for your team.</p></section>
       </main><footer><p>Footer links</p></footer>`,
      {
        images: [
          { id: "i-hero", url: "https://example.com/hero.png", normalized_url: "https://example.com/hero.png", original_source_value: "/hero.png" } as never,
          { id: "i-product", url: "https://example.com/p1.png", normalized_url: "https://example.com/p1.png", original_source_value: "/p1.png" } as never,
        ],
        products: [{ id: "p1", url: "https://example.com/p1" } as never],
      },
    );
    expect(result.sections.map((section) => section.type)).toEqual(["header", "hero", "product_grid", "pricing", "footer"]);
    expect(result.sections.find((section) => section.type === "hero")?.image_ids).toEqual(["i-hero"]);
    expect(result.sections.find((section) => section.type === "product_grid")?.product_ids).toEqual(["p1"]);
  });

  it("does not produce hundreds of tiny meaningless sections and handles empty HTML", () => {
    const html = `<main>${"<div></div>".repeat(300)}</main>`;
    expect(extractSections(html).sections).toEqual([]);
    expect(extractSections("").sections).toEqual([]);
  });

  it("deduplicates nested wrappers and hidden responsive or carousel clones", () => {
    const result = extractSections(
      `<main>
        <section id="features" class="features"><div class="wrapper"><h2>Features</h2><p>One meaningful feature section with enough copy.</p></div></section>
        <section id="features-mobile" class="features mobile-only" aria-hidden="true"><h2>Features</h2><p>One meaningful feature section with enough copy.</p></section>
        <section class="swiper-slide-duplicate"><h2>Features</h2><p>One meaningful feature section with enough copy.</p></section>
        <div class="empty-section"></div>
      </main>`,
    );
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]).toMatchObject({
      id: "features",
      section_id: "features",
      source_selector: "#features",
      content_item_ids: [],
      order: 0,
    });
  });

  it("keeps canonical section relationships and supported grid types", () => {
    const result = extractSections(
      `<main><section class="service-grid"><h2>Services</h2><p>Services for teams and operators.</p></section><section class="solution-grid"><h2>Solutions</h2><p>Solutions for complex workflows.</p></section></main>`,
    );
    expect(result.sections.map((section) => section.type)).toEqual(["service_grid", "solution_grid"]);
    expect(result.sections.map((section) => section.order)).toEqual([0, 1]);
    expect(result.sections.every((section) => section.section_id === section.id)).toBe(true);
  });
});
