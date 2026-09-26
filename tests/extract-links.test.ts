import { describe, expect, it } from "vitest";
import { extractAllLinks } from "@/lib/analyzer/extract-links";
import { extractNavigation } from "@/lib/analyzer/extract-navigation";

describe("link extraction boundaries", () => {
  const html = `
    <header><nav><a href="/">Home</a><a href="/contact">Contact</a></nav></header>
    <main>
      <article><a href="/products/lamp">Lamp product</a></article>
      <p><a href="/guide">Guide content</a></p>
    </main>
    <footer><nav><a href="/privacy">Privacy</a><a href="https://github.com/example" rel="me">GitHub</a></nav></footer>
  `;

  it("keeps all links broader than navigation links", () => {
    const all = extractAllLinks(html, "https://example.com");
    const navigation = extractNavigation(html, "https://example.com").navigation;

    expect(all.length).toBeGreaterThan(navigation.links.length);
    expect(navigation.links.some((link) => link.url.endsWith("/products/lamp"))).toBe(false);
    expect(navigation.primary_links.map((link) => link.url)).toEqual(expect.arrayContaining([
      "https://example.com/",
      "https://example.com/contact",
    ]));
  });

  it("separates footer and social links from primary navigation", () => {
    const navigation = extractNavigation(html, "https://example.com").navigation;

    expect(navigation.footer_links.map((link) => link.url)).toContain("https://example.com/privacy");
    expect(navigation.social_links.map((link) => link.url)).toContain("https://github.com/example");
    expect(navigation.primary_links.map((link) => link.url)).not.toContain("https://github.com/example");
  });

  it("deduplicates repeated links within the same navigation context and preserves provenance", () => {
    const result = extractAllLinks(
      `<header><nav><a href="/docs">Docs</a><a href="/docs">Docs duplicate</a></nav></header>`,
      "https://example.com",
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      url: "https://example.com/docs",
      source_area: "header",
      parent_selector: "nav",
      depth: 0,
      is_external: false,
      category: "all",
    });
  });
});
