import { describe, expect, it } from "vitest";
import { extractMetadata } from "@/lib/analyzer/extract-metadata";

describe("extractMetadata", () => {
  it("extracts ordinary, Open Graph, Twitter, favicon, and normalized canonical metadata", () => {
    const result = extractMetadata(
      `<html lang="en"><head>
        <title>Replica Shop</title><meta name="description" content="A useful shop">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="canonical" href="/catalog"><link rel="icon" href="/favicon.ico"><link rel="apple-touch-icon" href="https://cdn.test/icon.png">
        <meta property="og:title" content="Replica Shop OG"><meta property="og:image" content="/social.png"><meta property="og:site_name" content="Replica Shop">
        <meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="https://cdn.test/card">
      </head></html>`,
      "https://example.com/page",
    );
    expect(result.metadata).toMatchObject({
      title: "Replica Shop",
      meta_description: "A useful shop",
      canonical_url: "https://example.com/catalog",
      language: "en",
      viewport: "width=device-width, initial-scale=1",
      open_graph: { title: "Replica Shop OG", image: "https://example.com/social.png", site_name: "Replica Shop" },
      twitter: { card: "summary_large_image", image: "https://cdn.test/card" },
    });
    expect(result.metadata.favicon_candidates).toEqual(["https://example.com/favicon.ico", "https://cdn.test/icon.png"]);
  });

  it("preserves valid JSON-LD, extracts organization and social profiles, and ignores malformed JSON-LD", () => {
    const result = extractMetadata(
      `<script type="application/ld+json">{"@type":"Organization","name":"Forge Labs","url":"/about","logo":{"url":"/logo.svg"},"sameAs":["https://github.com/forge"]}</script>
       <script type="application/ld+json">{bad json</script>
       <script type="application/ld+json">{"@type":"WebSite","name":"Forge Site"}</script>
       <a href="https://github.com/forge">GitHub</a><a href="/internal">Internal</a>`,
      "https://example.com",
    );
    expect(result.metadata.json_ld).toHaveLength(2);
    expect(result.invalid_json_ld_count).toBe(1);
    expect(result.organization).toMatchObject({
      name: "Forge Labs",
      url: "https://example.com/about",
      logo: "https://example.com/logo.svg",
      same_as: ["https://github.com/forge"],
    });
    expect(result.website_name).toBe("Forge Site");
    expect(result.social_profile_links).toEqual(["https://github.com/forge"]);
  });

  it("handles incomplete malformed HTML without throwing", () => {
    expect(() => extractMetadata("<head><title>Unclosed", "https://example.com")).not.toThrow();
  });
});
