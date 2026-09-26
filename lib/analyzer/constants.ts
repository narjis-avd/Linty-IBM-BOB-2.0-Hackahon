export const ANALYSIS_STATUSES = [
  "pending",
  "fetching",
  "rendering",
  "extracting",
  "completed",
  "failed",
] as const;

export const WEBSITE_TYPES = [
  "unknown",
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
] as const;

export const SECTION_TYPES = [
  "unknown",
  "hero",
  "header",
  "navigation",
  "feature",
  "content",
  "category_grid",
  "service_grid",
  "solution_grid",
  "blog_grid",
  "blog",
  "testimonial",
  "pricing",
  "faq",
  "footer",
  "product_grid",
  "gallery",
  "cta",
] as const;

export const PRODUCT_TYPES = ["unknown", "physical", "digital", "service", "subscription"] as const;
export const CONTENT_ITEM_TYPES = [
  "ecommerce_product",
  "service",
  "solution",
  "feature",
  "portfolio_item",
  "blog_post",
  "course",
  "property",
  "category",
  "event",
  "encyclopedia_article",
  "generic_content_card",
  "unknown",
] as const;

export const IMAGE_ROLES = [
  "unknown",
  "hero",
  "logo",
  "icon",
  "favicon",
  "product",
  "service",
  "feature",
  "category",
  "blog",
  "testimonial",
  "content",
  "background",
  "decorative",
  "thumbnail",
  "avatar",
] as const;

export const IMAGE_PREVIEW_STATUSES = ["not_checked", "previewable", "failed", "blocked"] as const;

export const IMAGE_SOURCES = [
  "unknown",
  "src",
  "srcset",
  "lazy",
  "background",
  "og_image",
  "twitter_image",
  "json_ld",
] as const;

export const IMAGE_PHASES = ["fetched_html", "rendered_html"] as const;

export const SOURCE_AREAS = ["unknown", "header", "main", "footer", "breadcrumb", "sidebar"] as const;
export const LINK_CATEGORIES = ["all", "navigation", "primary_navigation", "footer", "breadcrumb", "social", "product", "content", "external"] as const;

export const DEFAULT_ANALYSIS_STATUS = "pending" as const;
export const DEFAULT_WEBSITE_TYPE = "unknown" as const;
export const DEFAULT_SECTION_TYPE = "unknown" as const;
export const DEFAULT_PRODUCT_TYPE = "unknown" as const;
export const DEFAULT_IMAGE_ROLE = "unknown" as const;
export const DEFAULT_IMAGE_SOURCE = "unknown" as const;
export const DEFAULT_SOURCE_AREA = "unknown" as const;
