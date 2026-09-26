import { describe, expect, it } from "vitest";
import { classifyWebsite } from "@/lib/analyzer/classify-website";
import type { Metadata, Navigation, ProductRecord, SectionRecord } from "@/lib/analyzer/types";

const metadata: Metadata = {
  title: "Example",
  meta_description: null,
  canonical_url: null,
  language: null,
  viewport: null,
  favicon_candidates: [],
  open_graph: { title: null, description: null, url: null, image: null, type: null, site_name: null, locale: null },
  twitter: { card: null, title: null, description: null, image: null, site: null, creator: null },
  json_ld: [],
  social_links: [],
};
const navigation: Navigation = {
  trees: [],
  links: [],
  primary_links: [],
  footer_links: [],
  breadcrumb_links: [],
  social_links: [],
  product_links: [],
  content_links: [],
  external_links: [],
};
const section = (type: SectionRecord["type"], heading: string): SectionRecord => ({
  id: heading.toLowerCase(),
  section_id: heading.toLowerCase(),
  type,
  heading,
  text: null,
  order: 0,
  source_selector: null,
  source_element: null,
  image_ids: [],
  product_ids: [],
  content_item_ids: [],
});

describe("classifyWebsite", () => {
  it("classifies ecommerce from products and product structure with evidence", () => {
    const product = { id: "p1" } as ProductRecord;
    const result = classifyWebsite({ metadata, navigation, sections: [section("product_grid", "Shop")], products: [product], contentItemCount: 0, pageUrl: "https://shop.example", html: "<main />" });
    expect(result.type).toBe("ecommerce");
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.evidence.some(e => e.toLowerCase().includes("products detected"))).toBe(true);
  });

  it("classifies encyclopedia from reference and article evidence", () => {
    const result = classifyWebsite({
      metadata: { ...metadata, title: "Reference portal", meta_description: "Articles, topics, and references for everyday learning." },
      navigation: {
        ...navigation,
        links: [
          { url: "https://example.test/articles", text: "Articles", rel: [], type: null, source_area: "header", category: "content", parent_selector: null, depth: 0, is_external: false },
          { url: "https://example.test/topics", text: "Topics", rel: [], type: null, source_area: "header", category: "content", parent_selector: null, depth: 0, is_external: false },
        ],
      },
      sections: [section("content", "Featured topics")],
      products: [],
      contentItemCount: 4,
      pageUrl: "https://knowledge.example",
      html: "<article><h1>History</h1><p>Reference articles and facts.</p></article>",
    });
    expect(result.type).toBe("encyclopedia");
    expect(result.confidence).toBeGreaterThan(0.35);
  });

  it("classifies ecommerce from commerce metadata and product signals", () => {
    const result = classifyWebsite({
      metadata: { ...metadata, title: "Smart accessories store", meta_description: "Fast chargers, audio, and accessories with delivery and checkout." },
      navigation: {
        ...navigation,
        links: [
          { url: "https://example.test/products", text: "Shop", rel: [], type: null, source_area: "header", category: "product", parent_selector: null, depth: 0, is_external: false },
          { url: "https://example.test/checkout", text: "Cart", rel: [], type: null, source_area: "header", category: "product", parent_selector: null, depth: 0, is_external: false },
        ],
      },
      sections: [section("product_grid", "Featured accessories"), section("pricing", "Bundle plans")],
      products: [{ id: "p1" } as ProductRecord],
      contentItemCount: 0,
      pageUrl: "https://shop.example/products",
      html: "<main><section><h2>Featured accessories</h2><button>Add to cart</button></section></main>",
    });
    expect(result.type).toBe("ecommerce");
    expect(result.evidence.some(e => /product|commerce|store/i.test(e))).toBe(true);
  });

  it("returns unknown with an explicit reason when evidence is insufficient", () => {
    const result = classifyWebsite({
      metadata: { ...metadata, title: "Simple Page", meta_description: null },
      navigation,
      sections: [],
      products: [],
      contentItemCount: 0,
      pageUrl: "https://example.test",
      html: "<main><h1>Simple Page</h1></main>",
    });
    expect(result.type).toBe("unknown");
    expect(result.confidence).toBe(0);
    expect(result.evidence.some(e => e.toLowerCase().includes("insufficient"))).toBe(true);
  });

  it("classifies Wikipedia correctly", () => {
    const result = classifyWebsite({
      metadata: { ...metadata, title: "Wikipedia, the free encyclopedia", meta_description: "The free encyclopedia that anyone can edit." },
      navigation: {
        ...navigation,
        links: [{ url: "https://en.wikipedia.org/wiki/Main_Page", text: "Main page", rel: [], type: null, source_area: "header", category: "content", parent_selector: null, depth: 0, is_external: false }],
      },
      sections: [],
      products: [],
      contentItemCount: 0,
      pageUrl: "https://en.wikipedia.org/wiki/Test",
      html: "<article><h1>Test Article</h1><p>Test content.</p></article>",
    });
    expect(result.type).toBe("encyclopedia");
    expect(result.confidence).toBe(0.95);
    expect(result.evidence.some(e => /wikipedia/i.test(e))).toBe(true);
  });

  it("classifies SaaS platform with pricing structure", () => {
    const result = classifyWebsite({
      metadata: { ...metadata, title: "CloudAnalytics Pro - SaaS Platform", meta_description: "Business intelligence dashboard for real-time analytics." },
      navigation: {
        ...navigation,
        links: [{ url: "https://saas.example.com/pricing", text: "Pricing", rel: [], type: null, source_area: "header", category: "content", parent_selector: null, depth: 0, is_external: false }],
      },
      sections: [section("pricing", "Plans"), section("features", "Features")],
      products: [],
      contentItemCount: 0,
      pageUrl: "https://saas.example.com/pricing",
      html: "<main><section><h2>Pricing Plans</h2><p>Choose your plan.</p></section></main>",
    });
    expect(result.type).toBe("saas");
    expect(result.confidence).toBeGreaterThan(0.6);
    expect(result.evidence.some(e => /saas|pricing|platform/i.test(e))).toBe(true);
  });

  it("classifies blog from article content markers", () => {
    const result = classifyWebsite({
      metadata: { ...metadata, title: "DevJournal - Developer Insights", meta_description: "Latest developer posts and tutorials." },
      navigation: {
        ...navigation,
        links: [{ url: "https://blog.example.com/tech", text: "Dev Posts", rel: [], type: null, source_area: "header", category: "content", parent_selector: null, depth: 0, is_external: false }],
      },
      sections: [],
      products: [],
      contentItemCount: 1,
      pageUrl: "https://blog.example.com/tech",
      html: "<article><h1>JavaScript Best Practices</h1><p>Deep dive into modern JavaScript development.</p></article>",
    });
    expect(result.type).toBe("blog");
    expect(result.confidence).toBeGreaterThanOrEqual(0.35);
  });

  it("classifies news from breaking indicators", () => {
    const result = classifyWebsite({
      metadata: { ...metadata, title: "Breaking News - Latest Updates", meta_description: "Stay updated with breaking news and latest stories." },
      navigation: {
        ...navigation,
        links: [{ url: "https://news.example.com/latest", text: "Latest News", rel: [], type: null, source_area: "header", category: "content", parent_selector: null, depth: 0, is_external: false }],
      },
      sections: [],
      products: [],
      contentItemCount: 0,
      pageUrl: "https://news.example.com/latest",
      html: "<main><h1>Breaking News</h1><p>Latest updates.</p></main>",
    });
    expect(result.type).toBe("news");
    expect(result.confidence).toBeGreaterThan(0.6);
    expect(result.evidence.some(e => /breaking|news/i.test(e))).toBe(true);
  });

  it("classifies documentation from API reference structure", () => {
    const result = classifyWebsite({
      metadata: { ...metadata, title: "API Documentation", meta_description: "Complete API reference for developers." },
      navigation: {
        ...navigation,
        links: [{ url: "https://docs.example.com/api", text: "API Reference", rel: [], type: null, source_area: "header", category: "content", parent_selector: null, depth: 0, is_external: false }],
      },
      sections: [],
      products: [],
      contentItemCount: 0,
      pageUrl: "https://docs.example.com/api",
      html: "<main><section><h2>API Reference</h2><p>Documentation content.</p></section></main>",
    });
    expect(result.type).toBe("documentation");
    expect(result.confidence).toBeGreaterThan(0.6);
    expect(result.evidence.some(e => /docs|documentation|api/i.test(e))).toBe(true);
  });

  it("classifies marketplace from listings structure", () => {
    const result = classifyWebsite({
      metadata: { ...metadata, title: "Local Marketplace - Buy and Sell", meta_description: "Buy and sell locally with our marketplace platform." },
      navigation: {
        ...navigation,
        links: [{ url: "https://market.example.com/listings", text: "Listings", rel: [], type: null, source_area: "header", category: "content", parent_selector: null, depth: 0, is_external: false }],
      },
      sections: [],
      products: [],
      contentItemCount: 0,
      pageUrl: "https://market.example.com/listings",
      html: "<main><section><h2>Marketplace Listings</h2><p>Browse products from sellers in your area.</p></section></main>",
    });
    expect(result.type).toBe("marketplace");
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    expect(result.evidence.some(e => /marketplace|listings/i.test(e))).toBe(true);
  });

  it("classifies real estate from property listings", () => {
    const result = classifyWebsite({
      metadata: { ...metadata, title: "RealEstatePro - Find Homes for Sale", meta_description: "Browse thousands of homes for sale and rent." },
      navigation: {
        ...navigation,
        links: [{ url: "https://realestate.example.com/listings", text: "Listings", rel: [], type: null, source_area: "header", category: "content", parent_selector: null, depth: 0, is_external: false }],
      },
      sections: [],
      products: [],
      contentItemCount: 0,
      pageUrl: "https://realestate.example.com/listings",
      html: "<main><section><h2>Properties for Sale</h2><p>View available homes from our property collection.</p></section></main>",
    });
    expect(result.type).toBe("real_estate");
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    expect(result.evidence.some(e => /real estate|property/i.test(e))).toBe(true);
  });

  it("classifies education from course content", () => {
    const result = classifyWebsite({
      metadata: { ...metadata, title: "Online Academy - Courses", meta_description: "Learn new skills with our online courses." },
      navigation: {
        ...navigation,
        links: [{ url: "https://academy.example.com/courses", text: "Courses", rel: [], type: null, source_area: "header", category: "content", parent_selector: null, depth: 0, is_external: false }],
      },
      sections: [],
      products: [],
      contentItemCount: 0,
      pageUrl: "https://academy.example.com/courses",
      html: "<main><section><h2>Courses</h2><p>Start learning today.</p></section></main>",
    });
    expect(result.type).toBe("education");
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    expect(result.evidence.some(e => /course|academy|education/i.test(e))).toBe(true);
  });

  it("classifies nonprofit from donation structure", () => {
    const result = classifyWebsite({
      metadata: { ...metadata, title: "Charity Foundation", meta_description: "Support our cause through donation." },
      navigation: {
        ...navigation,
        links: [{ url: "https://charity.example.com/donate", text: "Donate", rel: [], type: null, source_area: "header", category: "content", parent_selector: null, depth: 0, is_external: false }],
      },
      sections: [],
      products: [],
      contentItemCount: 0,
      pageUrl: "https://charity.example.com/donate",
      html: "<main><section><h2>Donate Now</h2><p>Support our mission.</p></section></main>",
    });
    expect(result.type).toBe("nonprofit");
    expect(result.confidence).toBeGreaterThan(0.6);
    expect(result.evidence.some(e => /donate|charity|nonprofit/i.test(e))).toBe(true);
  });

  it("classifies community from forum structure", () => {
    const result = classifyWebsite({
      metadata: { ...metadata, title: "Community Forum", meta_description: "Join our community and discuss topics." },
      navigation: {
        ...navigation,
        links: [{ url: "https://community.example.com/forum", text: "Forum", rel: [], type: null, source_area: "header", category: "content", parent_selector: null, depth: 0, is_external: false }],
      },
      sections: [],
      products: [],
      contentItemCount: 0,
      pageUrl: "https://community.example.com/forum",
      html: "<main><section><h2>Community Forum</h2><p>Join discussions.</p></section></main>",
    });
    expect(result.type).toBe("community");
    expect(result.confidence).toBeGreaterThan(0.6);
    expect(result.evidence.some(e => /community|forum/i.test(e))).toBe(true);
  });

  it("classifies agency from service grid", () => {
    const result = classifyWebsite({
      metadata: { ...metadata, title: "Creative Agency", meta_description: "Digital marketing and design services." },
      navigation: {
        ...navigation,
        links: [{ url: "https://agency.example.com/services", text: "Services", rel: [], type: null, source_area: "header", category: "content", parent_selector: null, depth: 0, is_external: false }],
      },
      sections: [section("service_grid", "Our Services"), section("solution_grid", "Solutions")],
      products: [],
      contentItemCount: 0,
      pageUrl: "https://agency.example.com/services",
      html: "<main><section><h2>Our Services</h2><p>Web design, branding, and marketing.</p></section></main>",
    });
    expect(result.type).toBe("agency");
    expect(result.confidence).toBeGreaterThan(0.6);
    expect(result.evidence.some(e => /agency|services/i.test(e))).toBe(true);
  });

  it("classifies portfolio from case study evidence", () => {
    const result = classifyWebsite({
      metadata: { ...metadata, title: "Design Portfolio", meta_description: "Selected work and case studies." },
      navigation: {
        ...navigation,
        links: [{ url: "https://portfolio.example.com/case-studies", text: "Case Studies", rel: [], type: null, source_area: "header", category: "content", parent_selector: null, depth: 0, is_external: false }],
      },
      sections: [],
      products: [],
      contentItemCount: 0,
      pageUrl: "https://portfolio.example.com/case-studies",
      html: "<main><section><h2>Case Studies</h2><p>Our portfolio projects.</p></section></main>",
    });
    expect(result.type).toBe("portfolio");
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    expect(result.evidence.some(e => /portfolio|case study/i.test(e))).toBe(true);
  });

  it("classifies landing page from hero section and CTA", () => {
    const result = classifyWebsite({
      metadata: { ...metadata, title: "Get Started Today", meta_description: "Start your journey with us." },
      navigation: {
        ...navigation,
        links: [{ url: "https://landing.example.com", text: "Home", rel: [], type: null, source_area: "header", category: "content", parent_selector: null, depth: 0, is_external: false }],
      },
      sections: [section("hero", "Welcome"), section("cta", "Get Started")],
      products: [],
      contentItemCount: 0,
      pageUrl: "https://landing.example.com",
      html: "<main><section><h2>Get Started</h2><button>Join Today</button></section></main>",
    });
    expect(result.type).toBe("landing_page");
    expect(result.confidence).toBeGreaterThan(0.35);
    expect(result.evidence.some(e => /landing|hero/i.test(e))).toBe(true);
  });

  it("classifies content from article markup", () => {
    const result = classifyWebsite({
      metadata: { ...metadata, title: "Content Hub", meta_description: "Read our latest content pieces." },
      navigation: {
        ...navigation,
        links: [{ url: "https://content.example.com", text: "Content", rel: [], type: null, source_area: "header", category: "content", parent_selector: null, depth: 0, is_external: false }],
      },
      sections: [],
      products: [],
      contentItemCount: 1,
      pageUrl: "https://content.example.com",
      html: "<article><h1>Feature Story</h1><p>Read our latest stories and insights.</p></article>",
    });
    expect(result.type).toBe("content");
    expect(result.confidence).toBeGreaterThan(0.35);
  });
});
