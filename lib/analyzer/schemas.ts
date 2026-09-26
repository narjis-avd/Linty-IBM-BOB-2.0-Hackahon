import { z } from "zod";
import {
  ANALYSIS_STATUSES,
  DEFAULT_ANALYSIS_STATUS,
  DEFAULT_IMAGE_ROLE,
  DEFAULT_IMAGE_SOURCE,
  DEFAULT_PRODUCT_TYPE,
  DEFAULT_SECTION_TYPE,
  DEFAULT_SOURCE_AREA,
  DEFAULT_WEBSITE_TYPE,
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
import type { NavigationNode } from "./types";

const nullableString = z.string().nullable().default(null);
const nullableNumber = z.number().finite().nullable().default(null);
const nonNegativeNumber = z.number().finite().nonnegative();
const jsonValue: z.ZodType<unknown> = z.unknown();
const defaultOpenGraphMetadata = {
  title: null,
  description: null,
  url: null,
  image: null,
  type: null,
  site_name: null,
  locale: null,
};
const defaultTwitterMetadata = {
  card: null,
  title: null,
  description: null,
  image: null,
  site: null,
  creator: null,
};

export const websiteInformationSchema = z.object({
  url: z.string().url(),
  final_url: z.string().url().nullable().default(null),
  title: nullableString,
  description: nullableString,
  website_type: z.enum(WEBSITE_TYPES).default(DEFAULT_WEBSITE_TYPE),
  website_type_confidence: z.number().finite().min(0).max(1).default(0),
  website_type_evidence: z.array(z.string()).default([]),
  analyzed_at: z.string().datetime(),
  response_status: z.number().int().min(100).max(599).nullable().default(null),
  response_time_ms: nonNegativeNumber.nullable().default(null),
});

export const openGraphMetadataSchema = z.object({
  title: nullableString,
  description: nullableString,
  url: z.string().url().nullable().default(null),
  image: z.string().url().nullable().default(null),
  type: nullableString,
  site_name: nullableString,
  locale: nullableString,
});

export const twitterMetadataSchema = z.object({
  card: nullableString,
  title: nullableString,
  description: nullableString,
  image: z.string().url().nullable().default(null),
  site: nullableString,
  creator: nullableString,
});

export const metadataSchema = z.object({
  title: nullableString,
  meta_description: nullableString,
  canonical_url: z.string().url().nullable().default(null),
  language: nullableString,
  viewport: nullableString,
  favicon_candidates: z.array(z.string().url()).default([]),
  open_graph: openGraphMetadataSchema.default(defaultOpenGraphMetadata),
  twitter: twitterMetadataSchema.default(defaultTwitterMetadata),
  json_ld: z.array(jsonValue).default([]),
  social_links: z.array(z.string().url()).default([]),
});

export const navigationNodeSchema: z.ZodType<NavigationNode> = z.lazy(() =>
  z.object({
    label: z.string(),
    href: z.string().url().nullable().default(null),
    children: z.array(navigationNodeSchema).default([]),
  }),
);

export const sourceElementInformationSchema = z.object({
  tag_name: nullableString,
  element_id: nullableString,
  class_name: nullableString,
  selector: nullableString,
  attributes: z.record(z.string(), z.string()).default({}),
});

export const linkSchema = z.object({
  url: z.string().url(),
  text: nullableString,
  rel: z.array(z.string()).default([]),
  type: nullableString,
  source_area: z.enum(SOURCE_AREAS).default(DEFAULT_SOURCE_AREA),
  category: z.enum(LINK_CATEGORIES).default("all"),
  parent_selector: nullableString,
  depth: z.number().int().nonnegative().default(0),
  is_external: z.boolean().default(false),
});

export const navigationSchema = z.object({
  trees: z.array(navigationNodeSchema).default([]),
  links: z.array(linkSchema).default([]),
  primary_links: z.array(linkSchema).default([]),
  footer_links: z.array(linkSchema).default([]),
  breadcrumb_links: z.array(linkSchema).default([]),
  social_links: z.array(linkSchema).default([]),
  product_links: z.array(linkSchema).default([]),
  content_links: z.array(linkSchema).default([]),
  external_links: z.array(linkSchema).default([]),
});

export const sectionSchema = z.object({
  id: z.string().min(1),
  section_id: z.string().min(1).default(""),
  heading: nullableString,
  text: nullableString,
  order: z.number().int().nonnegative(),
  type: z.enum(SECTION_TYPES).default(DEFAULT_SECTION_TYPE),
  image_ids: z.array(z.string()).default([]),
  product_ids: z.array(z.string()).default([]),
  source_element: sourceElementInformationSchema.nullable().default(null),
  source_selector: nullableString,
  content_item_ids: z.array(z.string()).default([]),
});

export const productActionSchema = z.object({
  label: z.string(),
  href: z.string().url().nullable().default(null),
  type: nullableString,
});

export const productSchema = z.object({
  id: z.string().min(1),
  entity_id: z.string().min(1).default(""),
  title: z.string(),
  url: z.string().url().nullable().default(null),
  price: nullableNumber,
  old_price: nullableNumber,
  currency: nullableString,
  is_on_sale: z.boolean().default(false),
  product_type: z.enum(PRODUCT_TYPES).default(DEFAULT_PRODUCT_TYPE),
  description: nullableString,
  image_ids: z.array(z.string()).default([]),
  source_selector: nullableString,
  source_url: z.string().url().nullable().default(null),
  action_buttons: z.array(productActionSchema).default([]),
  classification_reason: z.string().default(""),
  evidence: z.array(z.string()).default([]),
  occurrence_count: z.number().int().positive().default(1),
  source_selectors: z.array(z.string()).default([]),
  source_section_ids: z.array(z.string()).default([]),
  original_urls: z.array(z.string().url()).default([]),
});

export const contentItemSchema = z.object({
  id: z.string().min(1),
  entity_id: z.string().min(1).default(""),
  title: z.string(),
  url: z.string().url().nullable().default(null),
  description: nullableString,
  image_ids: z.array(z.string()).default([]),
  source_selector: nullableString,
  source_url: z.string().url().nullable().default(null),
  item_type: z.enum(CONTENT_ITEM_TYPES).default("unknown"),
  evidence: z.array(z.string()).default([]),
  classification_reason: z.string().default(""),
  occurrence_count: z.number().int().positive().default(1),
  source_selectors: z.array(z.string()).default([]),
  source_section_ids: z.array(z.string()).default([]),
  original_urls: z.array(z.string().url()).default([]),
});

export const imageRejectionSchema = z.object({
  reason: z.string(),
  details: nullableString,
});

export const imageSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  canonical_url: z.string().url(),
  normalized_url: z.string().url().nullable().default(null),
  identity: z.string().min(1).default(""),
  alt_text: nullableString,
  original_urls: z.array(z.string()).default([]),
  variant_urls: z.array(z.string().url()).default([]),
  extraction_sources: z.array(z.enum(IMAGE_SOURCES)).default([]),
  occurrence_count: z.number().int().positive().default(1),
  alt_values: z.array(z.string()).default([]),
  roles: z.array(z.enum(IMAGE_ROLES)).default([]),
  associated_section_ids: z.array(z.string()).default([]),
  associated_product_ids: z.array(z.string()).default([]),
  preview_status: z.enum(IMAGE_PREVIEW_STATUSES).default("not_checked"),
  width: nonNegativeNumber.int().nullable().default(null),
  height: nonNegativeNumber.int().nullable().default(null),
  role: z.enum(IMAGE_ROLES).default(DEFAULT_IMAGE_ROLE),
  source: z.enum(IMAGE_SOURCES).default(DEFAULT_IMAGE_SOURCE),
  extraction_phase: z.enum(IMAGE_PHASES).optional(),
  section_id: nullableString,
  product_id: nullableString,
  original_source_value: nullableString,
  source_element: sourceElementInformationSchema.nullable().default(null),
  rejection: imageRejectionSchema.nullable().default(null),
});

export const debugCounterSchema = z.object({
  name: z.string(),
  value: z.number().finite().nonnegative(),
});

export const rejectionReasonSchema = z.object({
  reason: z.string(),
  count: z.number().int().nonnegative(),
});

export const rejectionRecordSchema = z.object({
  reason: z.string(),
  source_value: nullableString,
  normalized_value: nullableString,
  extraction_source: z.enum(IMAGE_SOURCES).nullable().default(null),
  parent_context: sourceElementInformationSchema.nullable().default(null),
  details: nullableString,
});

export const imageReferenceSchema = z.object({
  reference_id: z.string(),
  asset_id: z.string().nullable().default(null),
  source_value: nullableString,
  normalized_url: nullableString,
  extraction_source: z.enum(IMAGE_SOURCES),
  role: z.enum(IMAGE_ROLES).default("unknown"),
  alt_text: nullableString,
  parent_context: sourceElementInformationSchema.nullable().default(null),
});

export const imageVariantSchema = z.object({
  asset_id: z.string(),
  url: z.string().url(),
  normalized_url: z.string().url(),
  extraction_source: z.enum(IMAGE_SOURCES),
  width: nonNegativeNumber.int().nullable().default(null),
  height: nonNegativeNumber.int().nullable().default(null),
});

export const extractionWarningSchema = z.object({
  code: z.string(),
  message: z.string(),
  source: nullableString,
});

export const processingStageSchema = z.object({
  name: z.string(),
  status: z.enum(ANALYSIS_STATUSES),
  duration_ms: nonNegativeNumber.nullable().default(null),
});

export const debugInformationSchema = z.object({
  counters: z.array(debugCounterSchema).default([]),
  rejection_reasons: z.array(rejectionReasonSchema).default([]),
  rejection_records: z.array(rejectionRecordSchema).default([]),
  extraction_warnings: z.array(extractionWarningSchema).default([]),
  processing_stages: z.array(processingStageSchema).default([]),
  duration_ms: nonNegativeNumber.nullable().default(null),
  raw_image_samples: z.array(z.object({
    source: z.enum(IMAGE_SOURCES),
    value: z.string(),
    element: sourceElementInformationSchema.nullable(),
  })).default([]),
  raw_image_source_counts: z.record(z.string(), z.number().int().nonnegative()).default({}),
  classification_records: z.array(z.object({
    entity_id: z.string(),
    classification_reason: z.string(),
    evidence: z.array(z.string()).default([]),
  })).default([]),
});

export const analysisSummarySchema = z.object({
  total_unique_images: z.number().int().nonnegative().default(0),
  total_raw_image_candidates: z.number().int().nonnegative().default(0),
  total_links: z.number().int().nonnegative().default(0),
  total_navigation_links: z.number().int().nonnegative().default(0),
  total_sections: z.number().int().nonnegative().default(0),
  total_ecommerce_products: z.number().int().nonnegative().default(0),
  total_content_items: z.number().int().nonnegative().default(0),
  total_warnings: z.number().int().nonnegative().default(0),
});

const defaultMetadata = {
  title: null,
  meta_description: null,
  canonical_url: null,
  language: null,
  viewport: null,
  favicon_candidates: [],
  open_graph: defaultOpenGraphMetadata,
  twitter: defaultTwitterMetadata,
  json_ld: [],
  social_links: [],
};
const defaultNavigation = { trees: [], links: [], primary_links: [], footer_links: [], breadcrumb_links: [], social_links: [], product_links: [], content_links: [], external_links: [] };
const defaultDebugInformation = {
  counters: [],
  rejection_reasons: [],
  rejection_records: [],
  extraction_warnings: [],
  processing_stages: [],
  duration_ms: null,
  raw_image_samples: [],
  raw_image_source_counts: {},
  classification_records: [],
};

export const analyzerResultSchema = z.object({
  status: z.enum(ANALYSIS_STATUSES).default(DEFAULT_ANALYSIS_STATUS),
  website: websiteInformationSchema,
  summary: analysisSummarySchema.default({
    total_unique_images: 0,
    total_raw_image_candidates: 0,
    total_links: 0,
    total_navigation_links: 0,
    total_sections: 0,
    total_ecommerce_products: 0,
    total_content_items: 0,
    total_warnings: 0,
  }),
  metadata: metadataSchema.default(defaultMetadata),
  navigation: navigationSchema.default(defaultNavigation),
  sections: z.array(sectionSchema).default([]),
  products: z.array(productSchema).default([]),
  content_items: z.array(contentItemSchema).default([]),
  images: z.array(imageSchema).default([]),
  image_references: z.array(imageReferenceSchema).default([]),
  image_variants: z.array(imageVariantSchema).default([]),
  previewable_images: z.array(z.string()).default([]),
  rejected_images: z.array(rejectionRecordSchema).default([]),
  links: z.array(linkSchema).default([]),
  all_links: z.array(linkSchema).default([]),
  navigation_links: z.array(linkSchema).default([]),
  primary_navigation_links: z.array(linkSchema).default([]),
  footer_links: z.array(linkSchema).default([]),
  breadcrumb_links: z.array(linkSchema).default([]),
  social_links: z.array(linkSchema).default([]),
  product_links: z.array(linkSchema).default([]),
  content_links: z.array(linkSchema).default([]),
  external_links: z.array(linkSchema).default([]),
  debug: debugInformationSchema.default(defaultDebugInformation),
});
