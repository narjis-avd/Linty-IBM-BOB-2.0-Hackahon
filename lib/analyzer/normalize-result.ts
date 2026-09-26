import type {
  AnalysisResult,
  AnalysisSummary,
  DebugInformation,
  Metadata,
  Navigation,
  WebsiteInformation,
  ImageSource,
  ImageRecord,
  ImageReference,
  ImageVariant,
  RejectionRecord,
  SourceElementInformation,
  SectionRecord,
} from "./types";

const emptyMetadata = (): Metadata => ({
  title: null,
  meta_description: null,
  canonical_url: null,
  language: null,
  viewport: null,
  favicon_candidates: [],
  open_graph: { title: null, description: null, url: null, image: null, type: null, site_name: null, locale: null },
  twitter: { card: null, title: null, description: null, image: null, site: null, creator: null },
  json_ld: [],
  social_links: [],
});

const emptyNavigation = (): Navigation => ({ trees: [], links: [], primary_links: [], footer_links: [], breadcrumb_links: [], social_links: [], product_links: [], content_links: [], external_links: [] });
const emptyDebug = (): DebugInformation => ({
  counters: [],
  rejection_reasons: [],
  rejection_records: [],
  extraction_warnings: [],
  processing_stages: [],
  duration_ms: null,
  raw_image_samples: [],
  raw_image_source_counts: {},
  classification_records: [],
});

const emptySummary = (): AnalysisSummary => ({
  total_unique_images: 0,
  total_raw_image_candidates: 0,
  total_links: 0,
  total_navigation_links: 0,
  total_sections: 0,
  total_ecommerce_products: 0,
  total_content_items: 0,
  total_warnings: 0,
});

export function normalizeAnalysisResult(value: unknown, fallbackUrl = ""): AnalysisResult | null {
  if (!isRecord(value) || value.status !== "completed") return null;

  const website = normalizeWebsite(value.website, fallbackUrl);
  const metadata = normalizeMetadata(value.metadata);
  const navigation = normalizeNavigation(value.navigation);
  const debug = normalizeDebug(value.debug);

  const images = arrayOrEmpty(value.images).map((image, index) => normalizeImage(image, index));
  const imageIds = new Set(images.flatMap((image) => isRecord(image) && typeof image.id === "string" ? [image.id] : []));
  const products = arrayOrEmpty(value.products).map((product) => {
    const sanitized = sanitizeAssociation(product, imageIds);
    return isRecord(sanitized)
      ? normalizeEntityFields({ ...sanitized, classification_reason: stringOrEmpty(sanitized.classification_reason), evidence: stringArray(sanitized.evidence) })
      : sanitized;
  });
  const contentItems = arrayOrEmpty(value.content_items).map((item) => {
    const sanitized = sanitizeAssociation(item, imageIds);
    return isRecord(sanitized)
      ? {
        ...sanitized,
        item_type: sanitized.item_type === "ecommerce" ? "ecommerce_product" : sanitized.item_type,
        ...normalizeEntityFields({
          classification_reason: stringOrEmpty(sanitized.classification_reason),
          evidence: stringArray(sanitized.evidence),
        }),
      }
      : sanitized;
  });
  const productIds = new Set(products.flatMap((product) => isRecord(product) && typeof product.id === "string" ? [product.id] : []));
  const nonEcommerceContentItems = contentItems.filter((item) => {
    if (!isRecord(item) || item.item_type === "ecommerce_product") return false;
    return typeof item.id !== "string" || !productIds.has(item.id);
  });
  const sections = deduplicateSections(arrayOrEmpty(value.sections).map((section) => {
    if (!isRecord(section)) return section;
    const sectionId = stringOrEmpty(section.section_id) || stringOrEmpty(section.id);
    return {
      ...section,
      id: sectionId,
      section_id: sectionId,
      source_selector: nullableString(section.source_selector) || (isRecord(section.source_element) ? nullableString(section.source_element.selector) : null),
      image_ids: stringArray(section.image_ids).filter((id) => imageIds.has(id)),
      product_ids: stringArray(section.product_ids).filter((id) => productIds.has(id)),
      content_item_ids: stringArray(section.content_item_ids),
    };
  })) as unknown as SectionRecord[];
  const links = normalizeLinks(arrayOrEmpty(value.all_links, arrayOrEmpty(value.links, navigation.links)));
  const summary = normalizeSummary(value.summary, {
    total_unique_images: images.length,
    total_raw_image_candidates: counterValue(debug, "raw_image_candidates"),
    total_links: links.length,
    total_navigation_links: navigation.links.length,
    total_sections: sections.length,
    total_ecommerce_products: products.length,
    total_content_items: nonEcommerceContentItems.length,
    total_warnings: debug.extraction_warnings.length,
  });
  return {
    status: "completed",
    website,
    summary,
    metadata,
    navigation,
    sections,
    products,
    content_items: nonEcommerceContentItems,
    images,
    image_references: normalizeImageReferences(value.image_references),
    image_variants: normalizeImageVariants(value.image_variants),
    previewable_images: stringArray(value.previewable_images),
    rejected_images: normalizeRejectionRecords(value.rejected_images, debug),
    links,
    all_links: links,
    navigation_links: navigation.links,
    primary_navigation_links: navigation.primary_links,
    footer_links: navigation.footer_links,
    breadcrumb_links: navigation.breadcrumb_links,
    social_links: navigation.social_links,
    product_links: navigation.product_links,
    content_links: navigation.content_links,
    external_links: navigation.external_links,
    debug,
  } as AnalysisResult;
}

function deduplicateSections(sections: unknown[]): Array<Record<string, unknown>> {
  const seen = new Map<string, Record<string, unknown>>();
  for (const value of sections) {
    if (!isRecord(value)) continue;
    const key = stringOrEmpty(value.section_id) || stringOrEmpty(value.id);
    if (!key) continue;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, value);
      continue;
    }
    existing.image_ids = [...new Set([...stringArray(existing.image_ids), ...stringArray(value.image_ids)])];
    existing.product_ids = [...new Set([...stringArray(existing.product_ids), ...stringArray(value.product_ids)])];
    existing.content_item_ids = [...new Set([...stringArray(existing.content_item_ids), ...stringArray(value.content_item_ids)])];
  }
  return [...seen.values()].map((section, index) => ({ ...section, order: index }));
}

function normalizeImage(value: unknown, index: number): ImageRecord {
  const source = isRecord(value) ? value : {};
  const url = stringOrEmpty(source.url) || stringOrEmpty(source.normalized_url);
  const original = stringArray(source.original_urls);
  const role = typeof source.role === "string" ? source.role : "unknown";
  const sourceType = typeof source.source === "string" ? source.source : "unknown";
  return {
    id: stringOrEmpty(source.id) || `image-${index + 1}`,
    url,
    canonical_url: stringOrEmpty(source.canonical_url) || url,
    normalized_url: nullableString(source.normalized_url) || (url || null),
    identity: stringOrEmpty(source.identity) || url,
    alt_text: nullableString(source.alt_text),
    original_urls: original.length ? original : (url ? [url] : []),
    variant_urls: stringArray(source.variant_urls),
    extraction_sources: stringArray(source.extraction_sources) as ImageSource[],
    occurrence_count: positiveNumber(source.occurrence_count),
    alt_values: stringArray(source.alt_values),
    roles: stringArray(source.roles) as ImageRecord["roles"],
    associated_section_ids: stringArray(source.associated_section_ids),
    associated_product_ids: stringArray(source.associated_product_ids),
    preview_status: source.preview_status === "previewable" || source.preview_status === "failed" || source.preview_status === "blocked" ? source.preview_status : "not_checked",
    width: nullableNumber(source.width),
    height: nullableNumber(source.height),
    role: role as ImageRecord["role"],
    source: sourceType as ImageSource,
    extraction_phase: source.extraction_phase as ImageRecord["extraction_phase"],
    section_id: nullableString(source.section_id),
    product_id: nullableString(source.product_id),
    original_source_value: nullableString(source.original_source_value),
    source_element: normalizeParentContext(source.source_element),
    rejection: normalizeImageRejection(source.rejection),
  };
}

function normalizeImageReferences(value: unknown): ImageReference[] {
  return arrayOrEmpty(value).filter(isRecord).map((source, index) => ({
    reference_id: stringOrEmpty(source.reference_id) || `image-reference-${index + 1}`,
    asset_id: nullableString(source.asset_id),
    source_value: nullableString(source.source_value),
    normalized_url: nullableString(source.normalized_url),
    extraction_source: stringOrEmpty(source.extraction_source) as ImageSource || "unknown",
    role: stringOrEmpty(source.role) as ImageRecord["role"] || "unknown",
    alt_text: nullableString(source.alt_text),
    parent_context: normalizeParentContext(source.parent_context),
  }));
}

function normalizeImageVariants(value: unknown): ImageVariant[] {
  return arrayOrEmpty(value).filter(isRecord).map((source) => ({
    asset_id: stringOrEmpty(source.asset_id),
    url: stringOrEmpty(source.url),
    normalized_url: stringOrEmpty(source.normalized_url) || stringOrEmpty(source.url),
    extraction_source: stringOrEmpty(source.extraction_source) as ImageSource || "unknown",
    width: nullableNumber(source.width),
    height: nullableNumber(source.height),
  }));
}

function normalizeRejectionRecords(value: unknown, debug: DebugInformation): RejectionRecord[] {
  const records = arrayOrEmpty(value).filter(isRecord);
  if (records.length === 0) return debug.rejection_records ?? [];
  return records.map((source) => ({
    reason: stringOrEmpty(source.reason),
    source_value: nullableString(source.source_value),
    normalized_value: nullableString(source.normalized_value),
    extraction_source: isImageSource(source.extraction_source) ? source.extraction_source : null,
    parent_context: normalizeParentContext(source.parent_context),
    details: nullableString(source.details),
  }));
}

function normalizeImageRejection(value: unknown): ImageRecord["rejection"] {
  if (!isRecord(value)) return null;
  return { reason: stringOrEmpty(value.reason), details: nullableString(value.details) };
}

function normalizeSummary(value: unknown, derived: AnalysisSummary): AnalysisSummary {
  if (!isRecord(value)) return derived;
  const normalized = { ...emptySummary() };
  for (const key of Object.keys(normalized) as Array<keyof AnalysisSummary>) {
    const candidate = value[key];
    normalized[key] = key === "total_sections"
      ? derived.total_sections
      : typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0
      ? Math.floor(candidate)
      : derived[key];
  }
  return normalized;
}

function counterValue(debug: DebugInformation, name: string): number {
  return debug.counters.find((counter) => counter.name === name)?.value ?? 0;
}

function sanitizeAssociation(value: unknown, validImageIds: Set<string>): unknown {
  if (!isRecord(value)) return value;
  return { ...value, image_ids: stringArray(value.image_ids).filter((id) => validImageIds.has(id)) };
}

function normalizeWebsite(value: unknown, fallbackUrl: string): WebsiteInformation {
  const source = isRecord(value) ? value : {};
  return {
    url: stringOrEmpty(source.url) || fallbackUrl,
    final_url: nullableString(source.final_url),
    title: nullableString(source.title),
    description: nullableString(source.description),
    website_type: isWebsiteType(source.website_type) ? source.website_type : "unknown",
    website_type_confidence: typeof source.website_type_confidence === "number" && Number.isFinite(source.website_type_confidence)
      ? Math.min(1, Math.max(0, source.website_type_confidence))
      : 0,
    website_type_evidence: stringArray(source.website_type_evidence),
    analyzed_at: stringOrEmpty(source.analyzed_at),
    response_status: nullableNumber(source.response_status),
    response_time_ms: nullableNumber(source.response_time_ms),
  };
}

function normalizeMetadata(value: unknown): Metadata {
  const source = isRecord(value) ? value : {};
  const openGraph = isRecord(source.open_graph) ? source.open_graph : {};
  const twitter = isRecord(source.twitter) ? source.twitter : {};
  return {
    ...emptyMetadata(),
    title: nullableString(source.title),
    meta_description: nullableString(source.meta_description),
    canonical_url: nullableString(source.canonical_url),
    language: nullableString(source.language),
    viewport: nullableString(source.viewport),
    favicon_candidates: stringArray(source.favicon_candidates),
    social_links: stringArray(source.social_links),
    json_ld: arrayOrEmpty(source.json_ld),
    open_graph: {
      title: nullableString(openGraph.title),
      description: nullableString(openGraph.description),
      url: nullableString(openGraph.url),
      image: nullableString(openGraph.image),
      type: nullableString(openGraph.type),
      site_name: nullableString(openGraph.site_name),
      locale: nullableString(openGraph.locale),
    },
    twitter: {
      card: nullableString(twitter.card),
      title: nullableString(twitter.title),
      description: nullableString(twitter.description),
      image: nullableString(twitter.image),
      site: nullableString(twitter.site),
      creator: nullableString(twitter.creator),
    },
  };
}

function normalizeNavigation(value: unknown): Navigation {
  if (!isRecord(value)) return emptyNavigation();
  const links = normalizeLinks(value.links);
  return {
    trees: arrayOrEmpty(value.trees),
    links,
    primary_links: normalizeLinks(value.primary_links),
    footer_links: normalizeLinks(value.footer_links),
    breadcrumb_links: normalizeLinks(value.breadcrumb_links),
    social_links: normalizeLinks(value.social_links),
    product_links: normalizeLinks(value.product_links),
    content_links: normalizeLinks(value.content_links),
    external_links: normalizeLinks(value.external_links),
  };
}

function normalizeLinks(value: unknown): NonNullable<Navigation["links"]> {
  return arrayOrEmpty(value).filter(isRecord).map((source) => ({
    url: stringOrEmpty(source.url),
    text: nullableString(source.text),
    rel: stringArray(source.rel),
    type: nullableString(source.type),
    source_area: stringOrEmpty(source.source_area) as Navigation["links"][number]["source_area"] || "unknown",
    category: stringOrEmpty(source.category) as Navigation["links"][number]["category"] || "all",
    parent_selector: nullableString(source.parent_selector),
    depth: typeof source.depth === "number" && source.depth >= 0 ? Math.floor(source.depth) : 0,
    is_external: source.is_external === true,
  }));
}

function normalizeDebug(value: unknown): DebugInformation {
  if (!isRecord(value)) return emptyDebug();
  return {
    counters: arrayOrEmpty(value.counters),
    rejection_reasons: arrayOrEmpty(value.rejection_reasons),
    rejection_records: arrayOrEmpty(value.rejection_records).map((record) => {
      const source = isRecord(record) ? record : {};
      return {
        reason: stringOrEmpty(source.reason),
        source_value: nullableString(source.source_value),
        normalized_value: nullableString(source.normalized_value),
        extraction_source: isImageSource(source.extraction_source) ? source.extraction_source : null,
        parent_context: normalizeParentContext(source.parent_context),
        details: nullableString(source.details),
      };
    }),
    extraction_warnings: arrayOrEmpty(value.extraction_warnings),
    processing_stages: arrayOrEmpty(value.processing_stages),
    duration_ms: nullableNumber(value.duration_ms),
    raw_image_samples: arrayOrEmpty(value.raw_image_samples),
    raw_image_source_counts: isRecord(value.raw_image_source_counts)
      ? Object.fromEntries(Object.entries(value.raw_image_source_counts).filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]) && entry[1] >= 0))
      : {},
    classification_records: arrayOrEmpty(value.classification_records).flatMap((record) => {
      if (!isRecord(record) || typeof record.entity_id !== "string") return [];
      return [{ entity_id: record.entity_id, classification_reason: stringOrEmpty(record.classification_reason), evidence: stringArray(record.evidence) }];
    }),
  };
}

function normalizeEntityFields(value: Record<string, unknown>): Record<string, unknown> {
  return {
    ...value,
    occurrence_count: typeof value.occurrence_count === "number" && value.occurrence_count > 0 ? Math.floor(value.occurrence_count) : 1,
    source_selectors: stringArray(value.source_selectors),
    source_section_ids: stringArray(value.source_section_ids),
    original_urls: stringArray(value.original_urls),
  };
}

function isImageSource(value: unknown): value is ImageSource {
  return ["unknown", "src", "srcset", "lazy", "background", "og_image", "twitter_image", "json_ld"].includes(value as string);
}

function normalizeParentContext(value: unknown): SourceElementInformation | null {
  if (!isRecord(value)) return null;
  return {
    tag_name: nullableString(value.tag_name),
    element_id: nullableString(value.element_id),
    class_name: nullableString(value.class_name),
    selector: nullableString(value.selector),
    attributes: isRecord(value.attributes)
      ? Object.fromEntries(Object.entries(value.attributes).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
      : {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function arrayOrEmpty<T = unknown>(value: unknown, fallback: T[] = []): T[] {
  return Array.isArray(value) ? value as T[] : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function positiveNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

function isWebsiteType(value: unknown): value is WebsiteInformation["website_type"] {
  return ["unknown", "ecommerce", "saas", "agency", "portfolio", "blog", "news", "encyclopedia", "documentation", "marketplace", "real_estate", "education", "nonprofit", "community", "landing_page", "content"].includes(value as string);
}
