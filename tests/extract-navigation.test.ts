import { describe, expect, it } from "vitest";
import { extractNavigation } from "@/lib/analyzer/extract-navigation";

describe("extractNavigation", () => {
  it("extracts nested header navigation, breadcrumbs, external links, and nav buttons", () => {
    const result = extractNavigation(
      `<header><nav><ul><li><a href="/">Home</a></li><li><a href="/shop">Shop</a><ul><li><a href="/shop/lamps">Lamps</a></li></ul></li></ul></nav><button data-nav-href="/contact">Contact</button></header>
       <main><nav aria-label="Breadcrumb"><a href="/">Home</a><a href="/shop">Shop</a></nav><button>Pricing</button></main>
       <footer><nav><a href="https://github.com/example">GitHub</a><a href="/privacy">Privacy</a></nav></footer>`,
      "https://example.com",
    );
    expect(result.navigation.trees[0]).toMatchObject({
      label: "Home",
      href: "https://example.com/",
    });
    expect(result.navigation.trees[1]?.children[0]).toMatchObject({
      label: "Lamps",
      href: "https://example.com/shop/lamps",
    });
    expect(result.navigation.links).toContainEqual(expect.objectContaining({ url: "https://github.com/example", source_area: "footer" }));
    expect(result.navigation.links).toContainEqual(expect.objectContaining({ url: "https://example.com/contact", source_area: "header" }));
    expect(result.navigation.links).toContainEqual(expect.objectContaining({ source_area: "breadcrumb" }));
  });

  it("deduplicates navigation links and safely handles pages without navigation", () => {
    const result = extractNavigation(
      `<header><nav><a href="/about">About</a><a href="/about">About again</a></nav></header><p><a href="/not-navigation">Content link</a></p>`,
      "https://example.com",
    );
    expect(result.navigation.links.filter((link) => link.url === "https://example.com/about")).toHaveLength(1);
    expect(result.navigation.links.some((link) => link.url.endsWith("/not-navigation"))).toBe(false);
    expect(extractNavigation("<main><p>Nothing here</p></main>", "https://example.com").navigation).toMatchObject({ trees: [], links: [], primary_links: [], footer_links: [], breadcrumb_links: [], social_links: [], product_links: [], content_links: [], external_links: [] });
  });
});
