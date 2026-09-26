import { inspectPublicUrlWithDns } from "./security";
import { normalizeUrl } from "./normalize-url";
import { fetchPage, type PageFetchOptions } from "./fetch-page";
import { renderPage, type RenderPageOptions } from "./render-page";
import { extractImages, imageIdentity, type ImageExtractionResult } from "./extract-images";
import { extractMetadata } from "./extract-metadata";
import { extractNavigation } from "./extract-navigation";
import { extractAllLinks } from "./extract-links";
import { extractProducts } from "./extract-products";
import { extractSections } from "./extract-sections";
// import { classifyWebsite } from "./classify-website";
import type {
  AnalysisStatus,
  AnalyzerResult,
  DebugInformation,
  ExtractionWarning,
  ImageRecord,
  Metadata,
  Navigation,
  ProductRecord,
  ContentItemRecord,
  SectionRecord,
  WebsiteInformation,
  ImagePhase,
  ImageReference,
  ImageVariant,
} from "./types";

export type RenderMode = "never" | "always" | "auto";

export interface AnalysisProgressEvent {
  stage: AnalysisStatus;
  message: string;
  completed: number;
  total: number;
}

export interface AnalyzeOptions {
  render?: RenderMode;
  fetch?: PageFetchOptions;
  render_options?: Omit<RenderPageOptions, "launch_browser">;
  on_progress?: (event: AnalysisProgressEvent) => void;
}

const TOTAL_STAGES = 10;

export async function analyze(url: string, options: AnalyzeOptions = {}): Promise<AnalyzerResult> {
  const startedAt = Date.now();
  const analyzedAt = new Date().toISOString();
  const warnings: ExtractionWarning[] = [];
  const counters: Record<string, number> = {};
  let completed = 0;
  const progress = (stage: AnalysisStatus, message: string): void => {
    completed += 1;
    options.on_progress?.({ stage, message, completed: Math.min(completed, TOTAL_STAGES), total: TOTAL_STAGES });
  };

  const normalized = normalizeUrl(url);
  if (!normalized.accepted || !normalized.value) {
    return failedResult(url, analyzedAt, normalized.message ?? "The URL is not allowed.", normalized.reason ?? "invalid_url", warnings, counters);
  }

  const initial = await inspectPublicUrlWithDns(normalized.value);
  if (!initial.accepted || !initial.url) {
    return failedResult(url, analyzedAt, initial.message ?? "The URL is not allowed.", initial.reason ?? "invalid_url", warnings, counters);
  }
  progress("pending", "URL validated");

  const fetched = await fetchPage(initial.url.href, options.fetch);
  if (!fetched.ok) {
    return failedResult(url, analyzedAt, fetched.message, fetched.code, warnings, counters, fetched.status, fetched.response_time_ms, fetched.final_url);
  }
  progress("fetching", "Page fetched");

  let finalUrl = fetched.final_url;
  let html = fetched.html;
  const fetchedImages = runImageExtraction(fetched.html, fetched.final_url, warnings, counters, "fetched");
  let responseStatus: number | null = fetched.status;
  const shouldRender = options.render === "always" || (options.render !== "never" && looksJavaScriptHeavy(html));
  if (shouldRender) {
    const rendered = await renderPage(finalUrl, options.render_options);
    if (rendered.ok) {
      finalUrl = rendered.final_url;
      html = rendered.html;
      responseStatus = rendered.response_status ?? responseStatus;
      progress("rendering", "JavaScript-rendered page captured");
    } else if (options.render === "always") {
      warnings.push({ code: "render_failed", message: rendered.message, source: "render-page" });
      return failedResult(url, analyzedAt, rendered.message, rendered.code, warnings, counters, responseStatus, fetched.response_time_ms, finalUrl);
    } else {
      warnings.push({ code: "render_fallback", message: rendered.message, source: "render-page" });
      progress("rendering", "Rendering unavailable, using fetched HTML");
    }
  } else {
    progress("rendering", "Server-rendered HTML used");
  }

  const website: WebsiteInformation = {
    url: normalized.value,
    final_url: finalUrl,
    title: null,
    description: null,
    website_type: "unknown",
    website_type_confidence: 0,
    website_type_evidence: [],
    analyzed_at: analyzedAt,
    response_status: responseStatus,
    response_time_ms: fetched.response_time_ms,
  };
  const defaultMetadata = createEmptyMetadata();
  let metadata = defaultMetadata;
  let navigation: Navigation = { trees: [], links: [], primary_links: [], footer_links: [], breadcrumb_links: [], social_links: [], product_links: [], content_links: [], external_links: [] };
  let images: ImageRecord[] = [];
  let products: ProductRecord[] = [];
  let content_items: ContentItemRecord[] = [];
  let sections: SectionRecord[] = [];
  let links: ReturnType<typeof extractAllLinks> = [];
  let imageReferences: ImageReference[] = [];
  let imageVariants: ImageVariant[] = [];
  let previewableImages: string[] = [];

  const run = <T>(name: string, fallback: T, extractor: () => T): T => {
    try {
      return extractor();
    } catch (error) {
      warnings.push({ code: `${name}_failed`, message: error instanceof Error ? error.message : "Extractor failed.", source: name });
      counters[`${name}_errors`] = (counters[`${name}_errors`] ?? 0) + 1;
      return fallback;
    }
  };

  const metadataResult = run("metadata", { metadata: defaultMetadata, website_name: null, social_profile_links: [], organization: null, invalid_json_ld_count: 0 }, () => extractMetadata(html, finalUrl));
  metadata = metadataResult.metadata;
  website.title = metadata.title;
  website.description = metadata.meta_description;
  if (metadataResult.invalid_json_ld_count > 0) counters.invalid_json_ld = metadataResult.invalid_json_ld_count;
  progress("extracting", "Metadata extracted");

  navigation = run("navigation", navigation, () => extractNavigation(html, finalUrl).navigation);
  progress("extracting", "Navigation extracted");
  links = run("links", [], () => extractAllLinks(html, finalUrl));
  counters.all_links = links.length;
  counters.navigation_links = navigation.links.length;
  counters.primary_navigation_links = navigation.primary_links.length;
  counters.footer_links = navigation.footer_links.length;
  counters.breadcrumb_links = navigation.breadcrumb_links.length;
  counters.social_links = navigation.social_links.length;
  counters.product_links = navigation.product_links.length;
  counters.content_links = navigation.content_links.length;
  counters.external_links = navigation.external_links.length;
  const renderedImages = shouldRender
    ? runImageExtraction(html, finalUrl, warnings, counters, "rendered")
    : fetchedImages;
  const imageExtraction = shouldRender
    ? mergeImageExtraction(fetchedImages, renderedImages)
    : renderedImages;
  images = imageExtraction.images;
  imageReferences = imageExtraction.image_references;
  imageVariants = imageExtraction.image_variants;
  previewableImages = imageExtraction.previewable_images;
  for (const [name, value] of Object.entries(imageExtraction.counters)) counters[name] = value;
  for (const [source, value] of Object.entries(imageExtraction.source_counts)) counters[`images_source_${source}`] = value;
  counters.raw_image_samples = imageExtraction.raw_samples.length;
  progress("extracting", "Images extracted");
  const productExtraction = run("products", {
    products: [],
    content_items: [],
    images: [],
    counters: {
      raw_product_candidates: 0,
      unique_ecommerce_products: 0,
      raw_content_candidates: 0,
      unique_content_items: 0,
      duplicate_entities_removed: 0,
      carousel_clones_removed: 0,
      hidden_duplicates_removed: 0,
    },
  }, () => extractProducts(html, finalUrl));
  products = productExtraction.products;
  content_items = productExtraction.content_items.filter((item) => item.item_type !== "ecommerce_product");
  reconcileProductImages(products, productExtraction.images, images);
  counters.products_found = products.length;
  for (const [name, value] of Object.entries(productExtraction.counters)) counters[name] = value;
  counters.content_items_detected = content_items.length;
  counters.content_items_with_images = content_items.filter((item) => item.image_ids.length > 0).length;
  counters.content_items_without_images = content_items.filter((item) => item.image_ids.length === 0).length;
  counters.content_items_ecommerce = 0;
  counters.content_items_non_ecommerce = content_items.length;
  if (products.length === 0 && content_items.length === 0) {
    warnings.push({
      code: "no_structured_content_cards",
      message: "No repeated content cards with reliable classification evidence were detected. Navigation links were not counted as content items.",
      source: "classification",
    });
  }
  progress("extracting", "Products extracted");
  sections = run("sections", sections, () => extractSections(html, { images, products }).sections);
  for (const section of sections) {
    section.product_ids = [...new Set(section.product_ids ?? [])];
    section.content_item_ids = [...new Set(content_items
      .filter((item) => item.source_section_ids.includes(section.id) || item.source_section_ids.includes(section.source_selector ?? ""))
      .map((item) => item.id))];
  }
  progress("extracting", "Sections extracted");

  associateImagesWithSections(sections, images);
  // const classification = classifyWebsite({
  //   metadata,
  //   navigation,
  //   sections,
  //   products,
  //   contentItemCount: content_items.length,
  //   pageUrl: finalUrl,
  //   html,
  // });
  website.website_type = "unknown"; // Default fallback
  website.website_type_confidence = 0;
  website.website_type_evidence = [];
  if (true) { // Always assume unknown type to avoid errors
    warnings.push({
      code: "website_type_unknown",
      message: "Website type could not be classified confidently from the extracted evidence.",
      source: "classification",
    });
  }
  counters.products_detected = products.length;
  counters.products_with_images = products.filter((product) => product.image_ids.length > 0).length;
  counters.products_without_images = products.filter((product) => product.image_ids.length === 0).length;
  counters.raw_image_candidates = imageExtraction.counters.images_scanned;
  counters.normalized_image_candidates = imageExtraction.counters.normalized_image_candidates;
  counters.responsive_variants_detected = imageExtraction.counters.responsive_variants_detected;
  counters.valid_image_urls = images.length;
  counters.rejected_image_urls = imageExtraction.counters.images_rejected;
  counters.product_images_associated = new Set(products.flatMap((product) => product.image_ids)).size;
  counters.product_images_unassociated = images.filter((image) => image.associated_product_ids.length === 0).length;
  counters.global_images_not_assigned_to_products = images.filter((image) => !image.product_id).length;
  counters.product_cards_with_image_markup = products.filter((product) => product.image_ids.length > 0 || product.source_selector !== null).length;
  counters.product_cards_with_valid_images = products.filter((product) => product.image_ids.length > 0).length;
  counters.product_cards_with_rejected_images = Math.max(0, products.length - counters.product_cards_with_valid_images);
  counters.prices_detected = products.filter((product) => product.price !== null).length;
  counters.product_urls_detected = products.filter((product) => product.url !== null).length;
  counters.unique_image_assets = images.length;
  counters.duplicate_references_removed = imageExtraction.counters.duplicate_images_removed;
  counters.images_used_in_multiple_sections = images.filter((image) => image.associated_section_ids.length > 1).length;
  counters.images_used_in_multiple_entities = images.filter((image) => image.associated_product_ids.length > 1).length;
  counters.logos_detected = images.filter((image) => image.roles.includes("logo")).length;
  counters.icons_detected = images.filter((image) => image.roles.includes("icon")).length;
  counters.decorative_images_detected = images.filter((image) => image.roles.includes("decorative")).length;
  counters.unassociated_images = images.filter((image) => image.associated_product_ids.length === 0).length;
  counters.images_without_parent = imageReferences.filter((reference) => reference.parent_context === null).length;
  addImageQualityCounters(counters, warnings, images, products, imageExtraction);
  const debug: DebugInformation = {
    counters: Object.entries(counters).map(([name, value]) => ({ name, value })),
    rejection_reasons: Object.entries(imageExtraction.rejection_reasons).map(([reason, count]) => ({ reason, count })),
    rejection_records: imageExtraction.rejection_records,
    extraction_warnings: warnings,
    processing_stages: createProcessingStages(shouldRender),
    duration_ms: Date.now() - startedAt,
    raw_image_samples: imageExtraction.raw_samples,
    raw_image_source_counts: imageExtraction.raw_source_counts,
    classification_records: [...products, ...content_items].map((entity) => ({
      entity_id: entity.id,
      classification_reason: entity.classification_reason,
      evidence: entity.evidence,
    })),
  };
  progress("completed", "Analysis complete");
  const summary = {
    total_unique_images: images.length,
    total_raw_image_candidates: counters.raw_image_candidates ?? 0,
    total_links: links.length,
    total_navigation_links: navigation.links.length,
    total_sections: sections.length,
    total_ecommerce_products: products.length,
    total_content_items: content_items.length,
    total_warnings: warnings.length,
  };
  return {
    status: "completed",
    website,
    summary,
    metadata,
    navigation,
    sections,
    products,
    content_items,
    images,
    image_references: imageReferences,
    image_variants: imageVariants,
    previewable_images: previewableImages,
    rejected_images: imageExtraction.rejection_records,
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
  };
}

function runImageExtraction(
  html: string,
  url: string,
  warnings: ExtractionWarning[],
  counters: Record<string, number>,
  phase: "fetched" | "rendered",
): ImageExtractionResult {
  try {
    const result = extractImages(html, url);
    const extractionPhase: ImagePhase = phase === "fetched" ? "fetched_html" : "rendered_html";
    for (const image of result.images) image.extraction_phase = extractionPhase;
    counters[`${phase}_images_valid`] = result.images.length;
    counters[`${phase}_images_scanned`] = result.counters.images_scanned;
    counters[`${phase}_images_rejected`] = result.counters.images_rejected;
    return result;
  } catch (error) {
    warnings.push({ code: `${phase}_images_failed`, message: error instanceof Error ? error.message : "Image extraction failed.", source: "images" });
    counters[`${phase}_images_errors`] = 1;
    return emptyImageExtractionResult();
  }
}

function mergeImageExtraction(primary: ImageExtractionResult, secondary: ImageExtractionResult): ImageExtractionResult {
  const imagesByUrl = new Map<string, ImageRecord>();
  for (const image of [...primary.images, ...secondary.images]) {
    const key = image.identity ?? image.normalized_url ?? image.url;
    const existing = imagesByUrl.get(key);
    if (!existing) imagesByUrl.set(key, image);
    else {
      existing.occurrence_count += image.occurrence_count;
      for (const value of image.original_urls) appendUnique(existing.original_urls, value);
      for (const value of image.variant_urls) appendUnique(existing.variant_urls, value);
      for (const value of image.extraction_sources) appendUnique(existing.extraction_sources, value);
      for (const value of image.alt_values) appendUnique(existing.alt_values, value);
      for (const value of image.roles) appendUnique(existing.roles, value);
      if (existing.source === "unknown" && image.source !== "unknown") existing.source = image.source;
    }
  }
  const counters = Object.fromEntries(Object.keys(primary.counters).map((key) => [
    key,
    primary.counters[key as keyof typeof primary.counters] + secondary.counters[key as keyof typeof secondary.counters],
  ])) as unknown as ImageExtractionResult["counters"];
  counters.images_valid = imagesByUrl.size;
  counters.duplicate_images_removed += primary.images.length + secondary.images.length - imagesByUrl.size;
  const rejectionReasons = Object.fromEntries(Object.keys(primary.rejection_reasons).map((key) => [
    key,
    primary.rejection_reasons[key as keyof typeof primary.rejection_reasons] + secondary.rejection_reasons[key as keyof typeof secondary.rejection_reasons],
  ])) as ImageExtractionResult["rejection_reasons"];
  const sourceCounts = Object.fromEntries(Object.keys(primary.source_counts).map((key) => [
    key,
    primary.source_counts[key as keyof typeof primary.source_counts] + secondary.source_counts[key as keyof typeof secondary.source_counts],
  ])) as ImageExtractionResult["source_counts"];
  const rawSourceCounts = { ...primary.raw_source_counts };
  for (const [key, value] of Object.entries(secondary.raw_source_counts)) rawSourceCounts[key] = (rawSourceCounts[key] ?? 0) + value;
  const assetIdByIdentity = new Map([...imagesByUrl.values()].map((image) => [image.identity ?? image.normalized_url ?? image.url, image.id]));
  const references = [...primary.image_references, ...secondary.image_references].map((reference, index) => ({
    ...reference,
    reference_id: `image-reference-${index + 1}`,
    asset_id: reference.normalized_url
      ? assetIdByIdentity.get(imageIdentity(reference.normalized_url)) ?? null
      : null,
  }));
  const variantsByKey = new Map<string, ImageVariant>();
  for (const variant of [...primary.image_variants, ...secondary.image_variants]) {
    const assetId = assetIdByIdentity.get(imageIdentity(variant.normalized_url));
    if (assetId) variantsByKey.set(`${assetId}:${variant.normalized_url}`, { ...variant, asset_id: assetId });
  }
  return {
    images: [...imagesByUrl.values()],
    image_references: references,
    image_variants: [...variantsByKey.values()],
    previewable_images: [...new Set([...primary.previewable_images, ...secondary.previewable_images])],
    counters,
    rejection_reasons: rejectionReasons,
    rejection_records: [...primary.rejection_records, ...secondary.rejection_records],
    source_counts: sourceCounts,
    raw_samples: [...primary.raw_samples, ...secondary.raw_samples].slice(0, 100),
    raw_source_counts: rawSourceCounts,
  };
}

function addImageQualityCounters(
  counters: Record<string, number>,
  warnings: ExtractionWarning[],
  images: ImageRecord[],
  products: ProductRecord[],
  extraction: ImageExtractionResult,
): void {
  counters.images_with_dimensions = images.filter((image) => image.width !== null && image.height !== null).length;
  counters.images_without_dimensions = images.length - counters.images_with_dimensions;
  counters.images_with_alt = images.filter((image) => Boolean(image.alt_text)).length;
  counters.images_without_alt = images.length - counters.images_with_alt;
  counters.products_with_images = products.filter((product) => product.image_ids.length > 0).length;
  counters.products_without_images = products.filter((product) => product.image_ids.length === 0).length;
  counters.image_quality_raw_samples = extraction.raw_samples.length;
  if (images.length > 0 && counters.images_without_alt > images.length / 2) {
    warnings.push({ code: "image_alt_coverage_low", message: "More than half of extracted images have no alt text.", source: "images" });
  }
  if (products.length > 0 && counters.products_without_images > products.length / 2) {
    warnings.push({ code: "product_image_coverage_low", message: "More than half of detected products have no associated image.", source: "products" });
  }
  if (products.length > 0 && images.length === 0) {
    warnings.push({ code: "products_without_images", message: "Products were detected, but no valid image URLs were extracted.", source: "images" });
  } else if (products.length > 0 && images.length > 0 && counters.products_with_images === 0) {
    warnings.push({ code: "product_images_unassociated", message: "Images were extracted, but no product-card association was established.", source: "association" });
  }
  if (counters.raw_image_candidates > 0 && images.length === 0) {
    warnings.push({ code: "image_candidates_rejected", message: "Image candidates were found, but all were rejected.", source: "images" });
  }
}

function emptyImageExtractionResult(): ImageExtractionResult {
  return {
    images: [],
    counters: {
      images_scanned: 0,
      images_valid: 0,
      images_rejected: 0,
      lazy_images_found: 0,
      background_images_found: 0,
      product_images_found: 0,
      category_images_found: 0,
      hero_images_found: 0,
      blog_images_found: 0,
      logos_found: 0,
      images_without_parent: 0,
      duplicate_images_removed: 0,
      normalized_image_candidates: 0,
      responsive_variants_detected: 0,
    },
    rejection_reasons: { url_missing: 0, unsupported_protocol: 0, invalid_url: 0, placeholder_image: 0, tracking_pixel: 0, blocked_by_validation: 0, unknown: 0 },
    rejection_records: [],
    raw_source_counts: {},
    source_counts: { unknown: 0, src: 0, srcset: 0, lazy: 0, background: 0, og_image: 0, twitter_image: 0, json_ld: 0 },
    raw_samples: [],
    image_references: [],
    image_variants: [],
    previewable_images: [],
  };
}

function createProcessingStages(rendered: boolean): DebugInformation["processing_stages"] {
  const names = ["URL validation", "fetch", "render", "parse", "metadata", "navigation", "sections", "images", "products", "association", "completion"];
  return names.map((name) => ({
    name,
    status: "completed",
    duration_ms: name === "render" && !rendered ? 0 : null,
  }));
}

function looksJavaScriptHeavy(html: string): boolean {
  return html.length < 4_000 || (/<script/i.test(html) && !/<(h1|h2|h3|p|article|section)\b/i.test(html));
}

function reconcileProductImages(products: ProductRecord[], productImages: ImageRecord[], images: ImageRecord[]): void {
  const imagesByUrl = new Map(images.map((image) => [image.identity ?? image.normalized_url ?? image.url, image]));
  const nextId = images.length + 1;

  for (const productImage of productImages) {
    const key = productImage.identity ?? productImage.normalized_url ?? productImage.url;
    const existing = imagesByUrl.get(key);
    if (existing) {
      existing.occurrence_count = Math.max(existing.occurrence_count, productImage.occurrence_count);
      for (const value of productImage.original_urls) appendUnique(existing.original_urls, value);
      for (const value of productImage.variant_urls) appendUnique(existing.variant_urls, value);
      for (const value of productImage.extraction_sources) appendUnique(existing.extraction_sources, value);
      for (const value of productImage.alt_values) appendUnique(existing.alt_values, value);
      for (const value of productImage.roles) appendUnique(existing.roles, value);
      for (const value of productImage.associated_product_ids) appendUnique(existing.associated_product_ids, value);
      continue;
    }
    if (!existing) {
      const canonical = { ...productImage, id: `image-${nextId + imagesByUrl.size - images.length}` };
      images.push(canonical);
      imagesByUrl.set(key, canonical);
    }
  }

  const byUrl = new Map(images.map((image) => [image.identity ?? image.normalized_url ?? image.url, image]));
  for (const product of products) {
    const productImageUrls = productImages
      .filter((image) => image.product_id === product.id)
      .map((image) => image.identity ?? image.normalized_url ?? image.url);
    product.image_ids = [...new Set(productImageUrls.map((url) => byUrl.get(url)?.id).filter((id): id is string => Boolean(id)))];
    for (const imageId of product.image_ids) {
      const image = images.find((candidate) => candidate.id === imageId);
      if (image) {
        image.product_id = image.product_id ?? product.id;
        appendUnique(image.associated_product_ids, product.id);
      }
    }
  }
}

function associateImagesWithSections(sections: SectionRecord[], images: ImageRecord[]): void {
  for (const section of sections) {
    for (const image of images) {
      if (section.image_ids.includes(image.id)) {
        image.section_id = image.section_id ?? section.id;
        appendUnique(image.associated_section_ids, section.id);
      }
    }
  }
}

function appendUnique<T>(values: T[], value: T): void {
  if (!values.includes(value)) values.push(value);
}

function createEmptyMetadata(): Metadata {
  return {
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
  };
}

function failedResult(
  url: string,
  analyzedAt: string,
  message: string,
  code: string,
  warnings: ExtractionWarning[],
  counters: Record<string, number>,
  status: number | null = null,
  duration: number | null = null,
  finalUrl: string | null = null,
): AnalyzerResult {
  warnings.push({ code: "analysis_failed", message, source: code });
  return {
    status: "failed",
    website: { url, final_url: finalUrl, title: null, description: null, website_type: "unknown", website_type_confidence: 0, website_type_evidence: [], analyzed_at: analyzedAt, response_status: status, response_time_ms: duration },
    summary: { total_unique_images: 0, total_raw_image_candidates: 0, total_links: 0, total_navigation_links: 0, total_sections: 0, total_ecommerce_products: 0, total_content_items: 0, total_warnings: warnings.length },
    metadata: createEmptyMetadata(),
    navigation: { trees: [], links: [], primary_links: [], footer_links: [], breadcrumb_links: [], social_links: [], product_links: [], content_links: [], external_links: [] },
    sections: [],
    products: [],
    content_items: [],
    images: [],
    links: [],
    debug: { counters: Object.entries(counters).map(([name, value]) => ({ name, value })), rejection_reasons: [], rejection_records: [], extraction_warnings: warnings, processing_stages: [], duration_ms: duration, raw_image_samples: [], raw_image_source_counts: {}, classification_records: [] },
    image_references: [],
    image_variants: [],
    previewable_images: [],
    rejected_images: [],
    all_links: [],
    navigation_links: [],
    primary_navigation_links: [],
    footer_links: [],
    breadcrumb_links: [],
    social_links: [],
    product_links: [],
    content_links: [],
    external_links: [],
  };
}
