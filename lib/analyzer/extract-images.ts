import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import { normalizeImageUrl } from "./normalize-image-url";
import { parseSrcset } from "./parse-srcset";
import type {
  ImageRecord,
  ImageReference,
  ImageRole,
  ImageSource,
  ImageVariant,
  RawImageSample,
  SourceElementInformation,
} from "./types";

/**
 * CDN resize/format parameters describe a variant of the same asset, not a
 * second identity. Keep the original URL for provenance and display.
 */
export function imageIdentity(value: string): string {
  try {
    const url = new URL(value);
    const removable = /^(auto|dpr|fit|fm|format|h|height|q|quality|w|width|widths|ixlib|rect|crop)$/i;
    [...url.searchParams.keys()].forEach((key) => {
      if (removable.test(key)) url.searchParams.delete(key);
    });
    url.hash = "";
    return url.href;
  } catch {
    return value;
  }
}

export type ImageRejectionReason =
  | "url_missing"
  | "unsupported_protocol"
  | "invalid_url"
  | "placeholder_image"
  | "tracking_pixel"
  | "blocked_by_validation"
  | "unknown";

export interface ImageExtractionCounters {
  images_scanned: number;
  images_valid: number;
  images_rejected: number;
  lazy_images_found: number;
  background_images_found: number;
  product_images_found: number;
  category_images_found: number;
  hero_images_found: number;
  blog_images_found: number;
  logos_found: number;
  images_without_parent: number;
  duplicate_images_removed: number;
  normalized_image_candidates: number;
  responsive_variants_detected: number;
}

export interface ImageExtractionResult {
  images: ImageRecord[];
  image_references: ImageReference[];
  image_variants: ImageVariant[];
  previewable_images: string[];
  counters: ImageExtractionCounters;
  rejection_reasons: Record<ImageRejectionReason, number>;
  rejection_records: Array<{
    reason: ImageRejectionReason;
    source_value: string | null;
    normalized_value: string | null;
    extraction_source: ImageSource;
    parent_context: SourceElementInformation | null;
    details: string | null;
  }>;
  source_counts: Record<ImageSource, number>;
  raw_samples: RawImageSample[];
  raw_source_counts: Record<string, number>;
}

export interface ExtractImagesOptions {
  allow_data_urls?: boolean;
}

const emptyCounters = (): ImageExtractionCounters => ({
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
});

const emptySourceCounts = (): Record<ImageSource, number> => ({
  unknown: 0, src: 0, srcset: 0, lazy: 0, background: 0, og_image: 0, twitter_image: 0, json_ld: 0,
});

const sourcePriority: Record<ImageSource, number> = {
  lazy: 5,
  srcset: 4,
  src: 3,
  background: 2,
  og_image: 1,
  twitter_image: 1,
  json_ld: 1,
  unknown: 0,
};

export function extractImages(
  html: string,
  pageUrl: string,
  options: ExtractImagesOptions = {},
): ImageExtractionResult {
  const $ = cheerio.load(html);
  const counters = emptyCounters();
  const rejectionReasons = createRejectionReasons();
  const rejectionRecords: ImageExtractionResult["rejection_records"] = [];
  const sourceCounts = emptySourceCounts();
  const rawSamples: RawImageSample[] = [];
  const rawSourceCounts: Record<string, number> = {};
  const imagesByUrl = new Map<string, ImageRecord>();
  const imageReferences: ImageReference[] = [];
  const imageVariants: ImageVariant[] = [];
  const previewableImages: string[] = [];
  let nextId = 1;

  const add = (
    rawValue: string | undefined,
    source: ImageSource,
    element: Element | null = null,
    roleHint?: ImageRole,
  ): void => {
    counters.images_scanned += 1;
    const raw = rawValue?.trim();
    if (raw) {
      sourceCounts[source] += 1;
      rawSourceCounts[source] = (rawSourceCounts[source] ?? 0) + 1;
      if (rawSamples.length < 100) rawSamples.push({ source, value: raw, element: element ? sourceInformation(element) : null });
    }
    if (!raw) return reject("url_missing", raw, null, source, element);
    if (!options.allow_data_urls && raw.toLowerCase().startsWith("data:")) return reject("unsupported_protocol", raw, null, source, element);
    if (isPlaceholder(raw)) return reject("placeholder_image", raw, null, source, element);
    if (isTrackingPixel(raw, element)) return reject("tracking_pixel", raw, null, source, element);

    const normalized = normalizeImageUrl(raw, pageUrl);
    if (!normalized.accepted || !normalized.value) {
      const reason = normalized.reason === "unsupported_protocol" ? "unsupported_protocol" : normalized.reason === "invalid_url" ? "invalid_url" : "blocked_by_validation";
      return reject(reason, raw, normalized.message ?? null, source, element, normalized.value);
    }

    counters.normalized_image_candidates += 1;
    const role = roleHint ?? detectRole(element, $, source);
    const identity = imageIdentity(normalized.value);
    const existing = imagesByUrl.get(identity);
    const referenceId = `image-reference-${imageReferences.length + 1}`;
    if (existing) {
      counters.duplicate_images_removed += 1;
      existing.occurrence_count += 1;
      appendUnique(existing.original_urls, raw);
      appendUnique(existing.extraction_sources, source);
      appendUnique(existing.roles, role);
      if (existing.normalized_url && existing.normalized_url !== normalized.value) {
        appendUnique(existing.variant_urls, normalized.value);
        if (!imageVariants.some((variant) => variant.asset_id === existing.id && variant.normalized_url === normalized.value)) {
          imageVariants.push({
            asset_id: existing.id,
            url: normalized.value,
            normalized_url: normalized.value,
            extraction_source: source,
            width: numericAttr(element, "width"),
            height: numericAttr(element, "height"),
          });
          counters.responsive_variants_detected += 1;
        }
      }
      const alt = element ? nullableAttr(element, "alt") : null;
      if (alt) appendUnique(existing.alt_values, alt);
      if (sourcePriority[source] > sourcePriority[existing.source]) {
        existing.source = source;
        existing.original_source_value = raw;
      }
      imageReferences.push({
        reference_id: referenceId,
        asset_id: existing.id,
        source_value: raw,
        normalized_url: normalized.value,
        extraction_source: source,
        role,
        alt_text: alt,
        parent_context: element ? sourceInformation(element) : null,
      });
      return;
    }

    const record: ImageRecord = {
      id: `image-${nextId++}`,
      url: normalized.value,
      canonical_url: normalized.value,
      normalized_url: normalized.value,
      identity,
      alt_text: element ? nullableAttr(element, "alt") : null,
      original_urls: [raw],
      variant_urls: [],
      extraction_sources: [source],
      occurrence_count: 1,
      alt_values: element && nullableAttr(element, "alt") ? [nullableAttr(element, "alt") as string] : [],
      roles: [role],
      associated_section_ids: [],
      associated_product_ids: [],
      preview_status: "not_checked",
      width: numericAttr(element, "width"),
      height: numericAttr(element, "height"),
      role,
      source,
      section_id: null,
      product_id: null,
      original_source_value: raw,
      source_element: element ? sourceInformation(element) : null,
      rejection: null,
    };
    imagesByUrl.set(identity, record);
    counters.images_valid += 1;
    imageReferences.push({
      reference_id: referenceId,
      asset_id: record.id,
      source_value: raw,
      normalized_url: normalized.value,
      extraction_source: source,
      role,
      alt_text: record.alt_text,
      parent_context: element ? sourceInformation(element) : null,
    });
    if (!element) counters.images_without_parent += 1;
    countRole(role, counters);
  };

  const reject = (
    reason: ImageRejectionReason,
    sourceValue?: string,
    details?: string | null,
    source: ImageSource = "unknown",
    element: Element | null = null,
    normalizedValue: string | null = null,
  ): void => {
    counters.images_rejected += 1;
    rejectionReasons[reason] += 1;
    rejectionRecords.push({
      reason,
      source_value: sourceValue ?? null,
      normalized_value: normalizedValue,
      extraction_source: source,
      parent_context: element ? sourceInformation(element) : null,
      details: details ?? null,
    });
  };

  $("img").each((_, element) => {
    const image = element as Element;
    if (/\b(?:woocommerce|product-thumbnail|wp-post-image|attachment)\b/i.test($(image).attr("class") ?? "")) {
      rawSourceCounts.woocommerce_candidates = (rawSourceCounts.woocommerce_candidates ?? 0) + 1;
    }

    const lazyValues = [
      "data-srcset", "data-lazy-srcset", "data-src", "data-lazy-src", "data-original",
      "data-flickity-lazyload", "data-large_image", "data-large-image", "data-thumb", "data-thumbnail",
      "data-background", "data-background-image", "data-image", "data-image-url", "data-bg",
      "bv-data-src", "bv-data-srcset",
    ];
    let lazyFound = false;
    for (const attribute of lazyValues) {
      const value = $(image).attr(attribute);
      if (!value) continue;
      lazyFound = true;
      const counterName = `${attribute.replace(/-/g, "_")}_candidates`;
      rawSourceCounts[counterName] = (rawSourceCounts[counterName] ?? 0) + 1;
      if (attribute.endsWith("srcset")) {
        for (const candidate of parseSrcset(value)) add(candidate.url, "lazy", image);
      } else add(value, "lazy", image);
    }
    if (lazyFound) counters.lazy_images_found += 1;
    const srcset = $(image).attr("srcset");
    if (srcset) {
      rawSourceCounts.img_srcset_candidates = (rawSourceCounts.img_srcset_candidates ?? 0) + 1;
      for (const candidate of parseSrcset(srcset)) add(candidate.url, "srcset", image);
    }
    if ($(image).attr("src")) rawSourceCounts.img_src_candidates = (rawSourceCounts.img_src_candidates ?? 0) + 1;
    add($(image).attr("src"), "src", image);
  });

  $("picture source").each((_, element) => {
    const source = element as Element;
    const srcset = $(source).attr("srcset");
    if (srcset) {
      rawSourceCounts.picture_candidates = (rawSourceCounts.picture_candidates ?? 0) + 1;
      for (const candidate of parseSrcset(srcset)) add(candidate.url, "srcset", source);
    }
    if ($(source).attr("src")) rawSourceCounts.picture_candidates = (rawSourceCounts.picture_candidates ?? 0) + 1;
    add($(source).attr("src"), "src", source);
  });

  $("[style]").each((_, element) => {
    const source = element as Element;
    for (const url of extractCssUrls($(source).attr("style") ?? "")) {
      counters.background_images_found += 1;
      rawSourceCounts.background_candidates = (rawSourceCounts.background_candidates ?? 0) + 1;
      add(url, "background", source, "background");
    }
  });
  $("style").each((_, element) => {
    for (const url of extractCssUrls($(element).text())) {
      counters.background_images_found += 1;
      rawSourceCounts.background_candidates = (rawSourceCounts.background_candidates ?? 0) + 1;
      add(url, "background", element as Element, "background");
    }
  });

  // Noscript commonly contains the server-rendered product image that a lazy
  // loader removes from the live DOM. Parse it as HTML, never as executable JS.
  $("noscript").each((_, element) => {
    const raw = $(element).text();
    if (!raw.trim()) return;
    rawSourceCounts.noscript_candidates = (rawSourceCounts.noscript_candidates ?? 0) + 1;
    const nested = cheerio.load(raw);
    nested("img").each((__, nestedElement) => {
      const image = nestedElement as Element;
      for (const attribute of ["src", "data-src", "data-lazy-src", "data-original"]) {
        const value = nested(image).attr(attribute);
        if (value) add(value, "lazy", element as Element);
      }
      const srcset = nested(image).attr("srcset") ?? nested(image).attr("data-srcset");
      if (srcset) for (const candidate of parseSrcset(srcset)) add(candidate.url, "srcset", element as Element);
    });
    nested("[style]").each((__, nestedElement) => {
      for (const value of extractCssUrls(nested(nestedElement).attr("style") ?? "")) add(value, "background", element as Element, "background");
    });
  });

  const metaImages = [
    { selector: 'meta[property="og:image"], meta[property="og:image:url"]', source: "og_image" as const },
    { selector: 'meta[name="twitter:image"], meta[name="twitter:image:src"]', source: "twitter_image" as const },
  ];
  for (const meta of metaImages) $(meta.selector).each((_, element) => {
    rawSourceCounts[meta.source === "og_image" ? "og_candidates" : "twitter_candidates"] = (rawSourceCounts[meta.source === "og_image" ? "og_candidates" : "twitter_candidates"] ?? 0) + 1;
    add($(element).attr("content"), meta.source);
  });

  $('script[type="application/ld+json"]').each((_, element) => {
    rawSourceCounts.json_ld_candidates = (rawSourceCounts.json_ld_candidates ?? 0) + 1;
    for (const value of findJsonLdImages(parseJson($(element).text()))) add(value, "json_ld", element as Element);
  });

  // A small, key-constrained scan covers framework state blobs without
  // admitting arbitrary strings (or inventing assets from unrelated text).
  $("script:not([type]), script[type='application/json'], script[type='text/javascript']").each((_, element) => {
    const text = $(element).text();
    const pattern = /(?:image|images|src|srcset|thumbnail(?:Url|URL)?|contentUrl|large_image|data-src)\s*['"]?\s*[:=]\s*['"]([^'"]+)['"]/gi;
    for (const match of text.matchAll(pattern)) {
      const value = match[1]?.trim();
      if (value && looksLikeUrlReference(value)) {
        rawSourceCounts.script_image_candidates = (rawSourceCounts.script_image_candidates ?? 0) + 1;
        add(value, "src", element as Element);
      }
    }
  });

  $("[data-image], [data-image-url], [data-bg], [data-background-image], [data-background], [data-lazy], [data-url], [data-src], [data-lazy-src], [data-original], [data-srcset], [data-lazy-srcset]").not("img, source").each((_, element) => {
    const source = element as Element;
    for (const attribute of ["data-image", "data-image-url", "data-bg", "data-background-image", "data-background", "data-lazy", "data-url", "data-src", "data-lazy-src", "data-original"]) {
      const value = $(source).attr(attribute);
      if (value) add(value, "lazy", source);
    }
    for (const attribute of ["data-srcset", "data-lazy-srcset"]) {
      const value = $(source).attr(attribute);
      if (value) for (const candidate of parseSrcset(value)) add(candidate.url, "lazy", source);
    }
  });

  $('link[rel="image_src"], link[as="image"]').each((_, element) => {
    add($(element).attr("href"), "src", element as Element);
  });

  rawSourceCounts.raw_image_candidates = Object.entries(rawSourceCounts).reduce((sum, [key, value]) => key === "raw_image_candidates" ? sum : sum + value, 0);
  return {
    images: [...imagesByUrl.values()],
    image_references: imageReferences,
    image_variants: imageVariants,
    previewable_images: previewableImages,
    counters,
    rejection_reasons: rejectionReasons,
    rejection_records: rejectionRecords,
    source_counts: sourceCounts,
    raw_samples: rawSamples,
    raw_source_counts: rawSourceCounts,
  };
}

function createRejectionReasons(): Record<ImageRejectionReason, number> {
  return { url_missing: 0, unsupported_protocol: 0, invalid_url: 0, placeholder_image: 0, tracking_pixel: 0, blocked_by_validation: 0, unknown: 0 };
}

function appendUnique<T>(values: T[], value: T): void {
  if (!values.includes(value)) values.push(value);
}

function extractCssUrls(value: string): string[] {
  return [...value.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)]
    .map((match) => match[2]?.trim().replace(/\\(["'])/g, "$1").replace(/\\([()])/g, "$1"))
    .filter((value): value is string => Boolean(value));
}

function looksLikeUrlReference(value: string): boolean {
  return /^(?:https?:|\/{1,2}|\.{1,2}\/)/i.test(value) && !/^javascript:|^data:/i.test(value);
}

function nullableAttr(element: Element, name: string): string | null {
  return cheerio.load(element, { xmlMode: true })(element).attr(name) ?? null;
}

function numericAttr(element: Element | null, name: "width" | "height"): number | null {
  const value = element ? cheerio.load(element, { xmlMode: true })(element).attr(name) : undefined;
  const number = value ? Number(value) : NaN;
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function sourceInformation(element: Element): SourceElementInformation {
  return {
    tag_name: element.name || null,
    element_id: element.attribs.id ?? null,
    class_name: element.attribs.class ?? null,
    selector: element.attribs.id ? `#${element.attribs.id}` : element.name || null,
    attributes: { ...element.attribs },
  };
}

function detectRole(element: Element | null, $: cheerio.CheerioAPI, source: ImageSource): ImageRole {
  if (source === "background") return "background";
  const value = element ? `${$(element).attr("class") ?? ""} ${$(element).attr("id") ?? ""} ${$(element).attr("alt") ?? ""}`.toLowerCase() : "";
  if (/\b(logo|brand|wordmark)\b/.test(value)) return "logo";
  if (/\b(favicon|apple-touch-icon)\b/.test(value)) return "favicon";
  if (/\b(icon|glyph|sprite)\b/.test(value)) return "icon";
  if (/\b(decorative|ornament|divider)\b/.test(value)) return "decorative";
  if (/\b(hero|banner|jumbotron)\b/.test(value)) return "hero";
  if (/\b(product|item|sku)\b/.test(value)) return "product";
  if (/\b(service|solution)\b/.test(value)) return "service";
  if (/\b(feature|benefit|capability)\b/.test(value)) return "feature";
  if (/\b(category|collection)\b/.test(value)) return "category";
  if (/\b(blog|article|post)\b/.test(value)) return "blog";
  if (/\b(testimonial|review|quote)\b/.test(value)) return "testimonial";
  return "content";
}

function countRole(role: ImageRole, counters: ImageExtractionCounters): void {
  if (role === "product") counters.product_images_found += 1;
  if (role === "category") counters.category_images_found += 1;
  if (role === "hero") counters.hero_images_found += 1;
  if (role === "blog") counters.blog_images_found += 1;
  if (role === "logo") counters.logos_found += 1;
}

function isPlaceholder(value: string): boolean {
  return /(?:placeholder|placehold\.co|via\.placeholder\.com|dummyimage\.com|spacer|transparent\.gif|blank\.gif)/i.test(value);
}

function isTrackingPixel(value: string, element: Element | null): boolean {
  const width = element ? Number(element.attribs.width) : NaN;
  const height = element ? Number(element.attribs.height) : NaN;
  return (width === 1 && height === 1) || /(?:pixel|beacon|tracking)/i.test(value);
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function findJsonLdImages(value: unknown): string[] {
  if (typeof value === "string" && /^https?:\/\//i.test(value)) return [value];
  if (Array.isArray(value)) return value.flatMap(findJsonLdImages);
  if (!value || typeof value !== "object") return [];

  const imageKeys = new Set(["image", "images", "contenturl", "thumbnailurl"]);
  return Object.entries(value).flatMap(([key, nested]) => {
    const normalizedKey = key.toLowerCase();
    return imageKeys.has(normalizedKey) ? findJsonLdImages(nested) : [];
  });
}
