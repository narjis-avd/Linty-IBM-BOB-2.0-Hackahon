import type { Metadata, Navigation, ProductRecord, SectionRecord, WebsiteType } from "./types";

export interface WebsiteClassification {
  type: WebsiteType;
  confidence: number;
  evidence: string[];
}

interface ClassificationContext {
  metadata: Metadata;
  navigation: Navigation;
  sections: SectionRecord[];
  products: ProductRecord[];
  contentItemCount: number;
  pageUrl: string;
  html: string;
}

const supportedTypes: WebsiteType[] = [
  "ecommerce",
  "saas",
  "agency",
  "portfolio",
  "blog",
  "news",
  "encyclopedia",
  "documentation",
  "marketplace",
  "real_estate",
  "education",
  "nonprofit",
  "community",
  "landing_page",
  "content",
];

export function classifyWebsite(context: ClassificationContext): WebsiteClassification {
  const textCorpus = buildTextCorpus(context);
  const normalized = textCorpus.toLowerCase();
  const scores = new Map<WebsiteType, { score: number; evidence: string[] }>();
  for (const type of supportedTypes) scores.set(type, { score: 0, evidence: [] });

  const add = (type: WebsiteType, score: number, reason: string): void => {
    const entry = scores.get(type);
    if (!entry) return;
    entry.score += score;
    if (reason && !entry.evidence.includes(reason)) entry.evidence.push(reason);
  };

  const navLabels = context.navigation.links.map((link) => link.text ?? "").filter(Boolean);
  const navLabelLower = navLabels.map((label) => label.toLowerCase()).join(" ");

  // Extract evidence from metadata
  const metadataSignals = extractMetadataSignals(context.metadata);

  // Check for specific website types based on evidence
  const evidenceSummary = { ...metadataSignals };

  // E-commerce evidence
  const hasProductSchema = context.metadata.json_ld.some((value) => jsonLdTypes(value).some((type) => /product|offer|itemlist/i.test(type)));
  const hasArticleSchema = context.metadata.json_ld.some((value) => jsonLdTypes(value).some((type) => /article|newsarticle|blogposting|scholarlyarticle|faqpage/i.test(type)));
  const structuredProductSignal = context.products.length > 0 || hasProductSchema || context.sections.some((section) => section.type === "product_grid");
  const structuredPricingSignal = context.sections.some((section) => section.type === "pricing") || /pricing|plans|price|cost|subscription|membership|checkout/i.test(normalized);
  const ecommerceSelectors = /\b(shop|store|cart|checkout|buy now|add to cart|collections|catalog|products|featured product|accessories|featured collection|shop now|shop all|shop by category)\b/i.test(normalized);
  const ecommerceContentSignals = context.products.length > 0 || /product|item|shop|cart|checkout|add to cart|featured collection/i.test(normalized);
  const hasEcommerceForm = /<form\b[^>]*(?:product|cart|checkout|order|payment|shipping)\b/i.test(context.html);

  // SaaS evidence
  const saasSignals = /saas|software|platform|api|dashboard|application|web app|saas platform|sign in|sign up|free trial|pricing plans|subscription model/i.test(normalized);
  const hasApiDocs = /api|documentation|developer|integration|sdk|endpoints|authentication|authorization/i.test(normalized);
  const hasSaaSStructure = context.sections.some((section) => section.type === "pricing" || section.type === "features" || section.type === "dashboard");

  // Agency evidence
  const agencySignals = /agency|creative studio|design studio|marketing agency|branding agency|consulting|advertising|marketing services|digital agency|web design/i.test(normalized);
  const hasServiceGrid = context.sections.some((section) => section.type === "service_grid" || section.type === "solution_grid");
  const hasPortfolioSection = context.sections.some((section) => section.type === "portfolio" || /portfolio|work|case study/i.test(section.heading || ""));

  // Portfolio evidence
  const portfolioSignals = /portfolio|case study|case studies|selected work|our work|projects|client work|project showcase/i.test(normalized);
  const hasPortfolioSectionFull = context.sections.some((section) => section.type === "portfolio" || /portfolio|work|case study/i.test(section.heading || ""));
  const hasProjectImages = context.sections.some((section) => section.type === "gallery" || /project|work|case study|portfolio/i.test(section.heading || ""));

  // Blog evidence
  const blogSignals = /blog|journal|posts|stories|insights|latest posts|resources|editorial|newsletter/i.test(normalized);
  const hasBlogSection = context.sections.some((section) => section.type === "blog_grid" || section.type === "blog");
  const hasArticleMarkup = /<article\b/i.test(context.html);
  const hasMainContent = /<main\b[^>]*>[^<]*<\/main>/i.test(context.html);
  const hasBlogArchive = /archive|blog/i.test(navLabelLower);
  const hasBlogCategory = /category/i.test(navLabelLower);

  // News evidence
  const newsSignals = /news|breaking news|headlines|press release|press|world news|current affairs|politics|business|sports|entertainment|finance/i.test(normalized);
  const hasBreakingIndicator = /breaking news|just in|trending|update/i.test(normalized);
  const hasNewsSection = /news|latest stories/i.test(navLabelLower);

  // Encyclopedia evidence
  const wikiSignals = /wiki|wikipedia|encyclopedia|encyclopaedia|reference|knowledge base|topics|articles|facts|history|science|biology|physics|mathematics/i.test(normalized);
  const hasWikiStructure = /wiki|articles|topics|category|navigation/i.test(navLabelLower);
  const hasArticlePage = context.metadata.title?.toLowerCase().includes("wikipedia") ||
    context.metadata.title?.toLowerCase().includes("wiki") ||
    context.metadata.title?.toLowerCase().includes("encyclopedia");

  // Documentation evidence
  const docsSignals = /docs|documentation|developer guide|api reference|reference docs|getting started|tutorial|manual|install|guide|help center|support/i.test(normalized);
  const hasDocsSection = /docs|documentation|api reference|guides|tutorials|api/i.test(navLabelLower);

  // Marketplace evidence
  const marketplaceSignals = /marketplace|vendors|sellers|market|buy from|sell on|vendor directory|multi-seller/i.test(normalized);
  const hasMarketplaceStructure = context.products.length > 0 && /marketplace|listings|seller/i.test(navLabelLower);

  // Real Estate evidence
  const realestateSignals = /real estate|property|properties|homes for sale|apartments|rentals|listing|realtor|mortgage|home for sale|buy a home|sell my home/i.test(normalized);
  const hasPropertySection = context.sections.some((section) => /property|listing|home|apartment|rental/i.test(section.heading || section.text || ""));

  // Education evidence
  const educationSignals = /course|courses|academy|school|college|university|learning|curriculum|students|lesson|training|education|class|workshop|seminar|webinar/i.test(normalized);
  const hasCourseSection = context.sections.some((section) => /course|lesson|academy|school|class|training/i.test(section.heading || section.text || ""));

  // Nonprofit evidence
  const nonprofitSignals = /nonprofit|non-profit|charity|donate|donation|volunteer|foundation|mission|impact|non governmental organization|ngo/i.test(normalized);
  const hasDonationSection = /donate|volunteer|support|contribute|donation/i.test(navLabelLower);

  // Community evidence
  const communitySignals = /community|forum|groups|members|discussion|events|clubs|network|conversations|chat|social|members only|member area/i.test(normalized);
  const hasCommunitySection = /forum|community|groups|members|discussion/i.test(navLabelLower);

  // Landing page evidence
  const landingSignals = /(get started|book a call|contact us|watch demo|join today|request demo|schedule demo|start now|learn more|contact us today)/i.test(normalized);
  const hasHeroSection = context.sections.some((section) => section.type === "hero" || section.type === "cta");
  const hasLeadForm = /<form\b[^>]*(?:contact|request|subscribe|signup|email|lead)/i.test(context.html);

  // Content evidence
  const contentSignals = /article|content|feature|story|post|entry|write-up/i.test(normalized);
  const hasContentSection = context.contentItemCount > 0 && hasArticleMarkup;
  const hasContentArticles = /<article\b/i.test(context.html) || context.contentItemCount > 0;
  const hasContentWithNoWikiSignals = hasContentArticles && !wikiSignals && !blogSignals && !newsSignals && !docsSignals;

  // Scoring based on strong evidence
  if (context.products.length > 0) {
    add("ecommerce", 7, `ecommerce products detected: ${context.products.length}`);
    if (context.products.length > 3) add("ecommerce", 2, "multiple products suggest a catalog");
  }
  if (structuredProductSignal) add("ecommerce", 6, "ecommerce product structure detected (schema or product grid)");
  if (ecommerceSelectors || ecommerceContentSignals) add("ecommerce", 4, "commerce language and selectors detected");
  if (hasEcommerceForm) add("ecommerce", 3, "ecommerce checkout or order form detected");

  if (hasArticleSchema && (blogSignals || newsSignals)) add("blog", 5, "Article schema indicates blog or news content");
  if (hasBlogSection && blogSignals) add("blog", 5, "dedicated blog section detected");
  if (blogSignals || hasBlogSection || hasArticleMarkup || hasMainContent) add("blog", 3, "blog or article content markers detected");
  if (hasBlogArchive) add("blog", 2, "blog archive or category navigation detected");

  if (newsSignals && hasBreakingIndicator) add("news", 7, "breaking news indicator detected");
  if (newsSignals) add("news", 5, "news content language detected");
  if (hasNewsSection) add("news", 3, "news section detected in navigation");

  if (wikiSignals && hasWikiStructure) add("encyclopedia", 6, "wiki structure and navigation detected");
  if (wikiSignals && hasArticlePage) add("encyclopedia", 5, "Wikipedia/encyclopedia title detected");
  if (wikiSignals) add("encyclopedia", 4, "wiki reference language detected");

  if (hasArticleMarkup && !wikiSignals && !blogSignals && !newsSignals) add("content", 3, "article markup without blog/news/wiki signals");

  if (docsSignals && hasDocsSection) add("documentation", 6, "documentation section detected");
  if (docsSignals) add("documentation", 4, "documentation and developer guide language detected");

  if (marketplaceSignals && hasMarketplaceStructure) add("marketplace", 6, "marketplace structure with listings detected");
  if (marketplaceSignals) add("marketplace", 4, "marketplace language detected");

  if (realestateSignals && hasPropertySection) add("real_estate", 5, "property or real-estate listing section detected");
  if (realestateSignals) add("real_estate", 3, "real-estate language detected");

  if (educationSignals && hasCourseSection) add("education", 5, "course or learning section detected");
  if (educationSignals) add("education", 3, "education and learning language detected");

  if (nonprofitSignals && hasDonationSection) add("nonprofit", 5, "donation or volunteer section detected");
  if (nonprofitSignals) add("nonprofit", 3, "nonprofit or charity language detected");

  if (communitySignals && hasCommunitySection) add("community", 4, "community or forum section detected");
  if (communitySignals) add("community", 2, "community structure detected");

  if (agencySignals && hasServiceGrid) add("agency", 5, "service or solution grid detected");
  if (agencySignals) add("agency", 4, "agency or studio language detected");
  if (hasPortfolioSectionFull) add("agency", 3, "portfolio evidence suggests agency work");

  if (portfolioSignals && hasPortfolioSectionFull) add("portfolio", 6, "portfolio or case-study section detected");
  if (portfolioSignals) add("portfolio", 3, "portfolio language detected");
  if (hasProjectImages) add("portfolio", 2, "project images detected");

  if (saasSignals && hasSaaSStructure && !structuredProductSignal) add("saas", 6, "SaaS pricing and features structure detected");
  if (saasSignals && hasApiDocs) add("saas", 4, "API documentation suggests SaaS platform");
  if (saasSignals && !structuredProductSignal) add("saas", 3, "software platform language detected");

  if (landingSignals && hasHeroSection && !structuredProductSignal && !blogSignals && !newsSignals && !wikiSignals && !docsSignals) {
    add("landing_page", 5, "marketing hero section and call-to-action detected");
  }
  if (hasHeroSection && hasLeadForm) add("landing_page", 3, "hero section with lead-capture form detected");
  if (hasLeadForm && !structuredProductSignal && !ecommerceSelectors && !saasSignals) add("landing_page", 2, "lead-capture form detected");

  if (contentSignals && hasContentWithNoWikiSignals) add("content", 3, "content articles detected without blog/news/wiki signals");

  // Weak evidence from URL patterns (minimum score)
  const pageUrlLower = context.pageUrl.toLowerCase();
  const urlSignals = {
    product: /\/(product|shop|store|cart|checkout|item)/.test(pageUrlLower),
    docs: /\/(docs|documentation|guide|tutorial|api|reference|learn|article|knowledge)/.test(pageUrlLower),
    blog: /\/(blog|articles|news|post)/.test(pageUrlLower),
    real_estate: /\/(property|home|apartment|rental|listing)/.test(pageUrlLower),
    course: /\/(course|lesson|learn|training)/.test(pageUrlLower),
  };

  if (urlSignals.product) add("ecommerce", 1, "URL path indicates product browsing");
  if (urlSignals.docs) add("documentation", 1, "URL path suggests documentation");
  if (urlSignals.blog) add("blog", 1, "URL path suggests blog content");
  if (urlSignals.real_estate) add("real_estate", 1, "URL path suggests real estate");
  if (urlSignals.course) add("education", 1, "URL path suggests education");

  // Apply scoring thresholds and return result
  const ranked = [...scores.entries()]
    .filter(([, entry]) => entry.score > 0)
    .sort((left, right) => right[1].score - left[1].score);
  const winner = ranked[0];
  const runnerUp = ranked[1];

  // Wikipedia special handling
  if (context.metadata.title?.toLowerCase().includes("wikipedia") && wikiSignals) {
    return {
      type: "encyclopedia",
      confidence: 0.95,
      evidence: ["Wikipedia title detected", "wiki structure evidence", "encyclopedia navigation"],
    };
  }

  // Unknown handling
  if (!winner) {
    return {
      type: "unknown",
      confidence: 0,
      evidence: [
        "Insufficient evidence to determine website type.",
        "Consider checking metadata, navigation, and page structure.",
      ],
    };
  }

  // Require minimum score of 3 for confident classification
  if (winner[1].score < 3) {
    return {
      type: "unknown",
      confidence: 0,
      evidence: [
        "Insufficient classification evidence (score below 3).",
        `Observed signals: ${winner[1].evidence.slice(0, 3).join(", ")}`,
        "Review metadata, navigation, and page content for more definitive signals.",
      ],
    };
  }

  // Check if winner has clear margin over second place
  const margin = Math.max(0, winner[1].score - (runnerUp?.[1].score ?? 0));
  const confidenceThreshold = margin >= 4 ? 0.9 : margin >= 2 ? 0.75 : 0.6;

  const confidence = Math.min(0.95, Math.max(0.35, confidenceThreshold));
  const evidence = winner[1].evidence.slice(0, 8);
  return {
    type: winner[0],
    confidence,
    evidence,
  };
}

interface MetadataSignals {
  title?: string;
  description?: string;
  openGraph?: { type?: string; site_name?: string };
}

function extractMetadataSignals(metadata: Metadata): MetadataSignals {
  return {
    title: metadata.title,
    description: metadata.meta_description,
    openGraph: {
      type: metadata.open_graph.type,
      site_name: metadata.open_graph.site_name,
    },
  };
}

function buildTextCorpus(context: ClassificationContext): string {
  const values = [
    context.metadata.title,
    context.metadata.meta_description,
    context.metadata.open_graph.title,
    context.metadata.open_graph.description,
    context.metadata.open_graph.type,
    context.metadata.open_graph.site_name,
    ...context.navigation.links.map((link) => link.text),
    ...context.sections.map((section) => `${section.type} ${section.heading ?? ""} ${section.text ?? ""}`),
    ...context.metadata.json_ld.flatMap((value) => jsonLdText(value)),
    sectionText(context.sections),
  ];
  return values.filter(Boolean).join(" ");
}

function sectionText(sections: SectionRecord[]): string {
  return sections.map((section) => `${section.type} ${section.heading ?? ""} ${section.text ?? ""}`).join(" ");
}

function jsonLdTypes(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const type = (value as { "@type"?: unknown })["@type"];
  return Array.isArray(type) ? type.filter((item): item is string => typeof item === "string") : typeof type === "string" ? [type] : [];
}

function jsonLdText(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(jsonLdText);
  return Object.entries(value).flatMap(([key, nested]) => [key, ...jsonLdText(nested)]);
}
