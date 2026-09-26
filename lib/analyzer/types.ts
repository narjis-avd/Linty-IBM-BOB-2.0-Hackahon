import type {
  ANALYSIS_STATUSES,
  IMAGE_ROLES,
  IMAGE_SOURCES,
  IMAGE_PHASES,
  IMAGE_PREVIEW_STATUSES,
  PRODUCT_TYPES,
  CONTENT_ITEM_TYPES,
  SECTION_TYPES,
  SOURCE_AREAS,
  LINK_CATEGORIES,
  WEBSITE_TYPES,
} from "./constants";

export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];
export type WebsiteType = (typeof WEBSITE_TYPES)[number];
export type SectionType = (typeof SECTION_TYPES)[number];
export type ProductType = (typeof PRODUCT_TYPES)[number];
export type ContentItemType = (typeof CONTENT_ITEM_TYPES)[number];
export type ImageRole = (typeof IMAGE_ROLES)[number];
export type ImageSource = (typeof IMAGE_SOURCES)[number];
export type ImagePhase = (typeof IMAGE_PHASES)[number];
export type ImagePreviewStatus = (typeof IMAGE_PREVIEW_STATUSES)[number];
export type SourceArea = (typeof SOURCE_AREAS)[number];
export type LinkCategory = (typeof LINK_CATEGORIES)[number];

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface WebsiteInformation {
  url: string;
  final_url: string | null;
  title: string | null;
  description: string | null;
  website_type: WebsiteType;
  website_type_confidence: number;
  website_type_evidence: string[];
  analyzed_at: string;
  response_status: number | null;
  response_time_ms: number | null;
}

export interface OpenGraphMetadata {
  title: string | null;
  description: string | null;
  url: string | null;
  image: string | null;
  type: string | null;
  site_name: string | null;
  locale: string | null;
}

export interface TwitterMetadata {
  card: string | null;
  title: string | null;
  description: string | null;
  image: string | null;
  site: string | null;
  creator: string | null;
}

export interface Metadata {
  title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  language: string | null;
  viewport: string | null;
  favicon_candidates: string[];
  open_graph: OpenGraphMetadata;
  twitter: TwitterMetadata;
  json_ld: JsonValue[];
  social_links: string[];
}

export interface NavigationNode {
  label: string;
  href: string | null;
  children: NavigationNode[];
}

export interface Navigation {
  trees: NavigationNode[];
  links: LinkRecord[];
  primary_links: LinkRecord[];
  footer_links: LinkRecord[];
  breadcrumb_links: LinkRecord[];
  social_links: LinkRecord[];
  product_links: LinkRecord[];
  content_links: LinkRecord[];
  external_links: LinkRecord[];
}

export interface SourceElementInformation {
  tag_name: string | null;
  element_id: string | null;
  class_name: string | null;
  selector: string | null;
  attributes: Record<string, string>;
}

export interface SectionRecord {
  id: string;
  section_id: string;
  heading: string | null;
  text: string | null;
  order: number;
  type: SectionType;
  image_ids: string[];
  source_element: SourceElementInformation | null;
  source_selector: string | null;
  product_ids?: string[];
  content_item_ids: string[];
}

export interface ProductAction {
  label: string;
  href: string | null;
  type: string | null;
}

export interface ProductRecord {
  id: string;
  entity_id: string;
  title: string;
  url: string | null;
  price: number | null;
  old_price: number | null;
  currency: string | null;
  is_on_sale: boolean;
  product_type: ProductType;
  description: string | null;
  image_ids: string[];
  source_selector: string | null;
  source_url: string | null;
  action_buttons: ProductAction[];
  classification_reason: string;
  evidence: string[];
  occurrence_count: number;
  source_selectors: string[];
  source_section_ids: string[];
  original_urls: string[];
}

export interface ContentItemRecord {
  id: string;
  entity_id: string;
  title: string;
  url: string | null;
  description: string | null;
  image_ids: string[];
  source_selector: string | null;
  source_url: string | null;
  item_type: ContentItemType;
  evidence: string[];
  classification_reason: string;
  occurrence_count: number;
  source_selectors: string[];
  source_section_ids: string[];
  original_urls: string[];
}

export interface ImageRejection {
  reason: string;
  details: string | null;
}

export interface ImageRecord {
  id: string;
  url: string;
  canonical_url: string;
  normalized_url: string | null;
  identity?: string;
  alt_text: string | null;
  original_urls: string[];
  variant_urls: string[];
  extraction_sources: ImageSource[];
  occurrence_count: number;
  alt_values: string[];
  roles: ImageRole[];
  associated_section_ids: string[];
  associated_product_ids: string[];
  preview_status: ImagePreviewStatus;
  width: number | null;
  height: number | null;
  role: ImageRole;
  source: ImageSource;
  extraction_phase?: ImagePhase;
  section_id: string | null;
  product_id: string | null;
  original_source_value: string | null;
  source_element?: SourceElementInformation | null;
  rejection: ImageRejection | null;
}

export interface ImageReference {
  reference_id: string;
  asset_id: string | null;
  source_value: string | null;
  normalized_url: string | null;
  extraction_source: ImageSource;
  role: ImageRole;
  alt_text: string | null;
  parent_context: SourceElementInformation | null;
}

export interface ImageVariant {
  asset_id: string;
  url: string;
  normalized_url: string;
  extraction_source: ImageSource;
  width: number | null;
  height: number | null;
}

export interface LinkRecord {
  url: string;
  text: string | null;
  rel: string[];
  type: string | null;
  source_area: SourceArea;
  category: LinkCategory;
  parent_selector: string | null;
  depth: number;
  is_external: boolean;
}

export interface DebugCounter {
  name: string;
  value: number;
}

export interface RejectionReason {
  reason: string;
  count: number;
}

export interface RejectionRecord {
  reason: string;
  source_value: string | null;
  normalized_value?: string | null;
  extraction_source?: ImageSource | null;
  parent_context?: SourceElementInformation | null;
  details: string | null;
}

export interface ExtractionWarning {
  code: string;
  message: string;
  source: string | null;
}

export interface ProcessingStage {
  name: string;
  status: AnalysisStatus;
  duration_ms: number | null;
}

export interface DebugInformation {
  counters: DebugCounter[];
  rejection_reasons: RejectionReason[];
  rejection_records?: RejectionRecord[];
  extraction_warnings: ExtractionWarning[];
  processing_stages: ProcessingStage[];
  duration_ms: number | null;
  raw_image_samples?: RawImageSample[];
  raw_image_source_counts?: Record<string, number>;
  classification_records?: ClassificationRecord[];
}

export interface ClassificationRecord {
  entity_id: string;
  classification_reason: string;
  evidence: string[];
}

export interface AnalysisSummary {
  total_unique_images: number;
  total_raw_image_candidates: number;
  total_links: number;
  total_navigation_links: number;
  total_sections: number;
  total_ecommerce_products: number;
  total_content_items: number;
  total_warnings: number;
}

export interface RawImageSample {
  source: ImageSource;
  value: string;
  element: SourceElementInformation | null;
}

export interface AnalysisResult {
  status: AnalysisStatus;
  website: WebsiteInformation;
  summary: AnalysisSummary;
  metadata: Metadata;
  navigation: Navigation;
  sections: SectionRecord[];
  products: ProductRecord[];
  content_items: ContentItemRecord[];
  images: ImageRecord[];
  image_references: ImageReference[];
  image_variants: ImageVariant[];
  previewable_images: string[];
  rejected_images: RejectionRecord[];
  links: LinkRecord[];
  all_links: LinkRecord[];
  navigation_links: LinkRecord[];
  primary_navigation_links: LinkRecord[];
  footer_links: LinkRecord[];
  breadcrumb_links: LinkRecord[];
  social_links: LinkRecord[];
  product_links: LinkRecord[];
  content_links: LinkRecord[];
  external_links: LinkRecord[];
  debug: DebugInformation;
}

/** @deprecated Use AnalysisResult. Kept for compatibility with existing analyzer callers. */
export type AnalyzerResult = AnalysisResult;

export interface AnalysisApiError {
  code: "validation_error" | "blocked_url" | "fetch_failed" | "render_failed" | "analysis_failed" | "request_failed";
  message: string;
  details: string[];
}

export type AnalysisApiResponse =
  | { ok: true; result: AnalysisResult }
  | { ok: false; error: AnalysisApiError; result: AnalysisResult | null };
