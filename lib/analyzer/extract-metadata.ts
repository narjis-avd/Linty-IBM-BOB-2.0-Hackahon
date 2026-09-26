import * as cheerio from "cheerio";
import { normalizeUrl } from "./normalize-url";
import type { JsonValue, Metadata, OpenGraphMetadata, TwitterMetadata } from "./types";

export interface OrganizationInformation {
  name: string | null;
  url: string | null;
  logo: string | null;
  same_as: string[];
}

export interface MetadataExtractionResult {
  metadata: Metadata;
  organization: OrganizationInformation | null;
  website_name: string | null;
  social_profile_links: string[];
  invalid_json_ld_count: number;
}

export function extractMetadata(html: string, pageUrl: string): MetadataExtractionResult {
  const $ = cheerio.load(html);
  const jsonLd: JsonValue[] = [];
  let invalidJsonLdCount = 0;

  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const parsed: unknown = JSON.parse($(element).text());
      if (isJsonValue(parsed)) jsonLd.push(parsed);
    } catch {
      invalidJsonLdCount += 1;
    }
  });

  const openGraph: OpenGraphMetadata = {
    title: metaContent($, 'meta[property="og:title"]'),
    description: metaContent($, 'meta[property="og:description"]'),
    url: normalizeMetadataUrl(metaContent($, 'meta[property="og:url"]'), pageUrl),
    image: normalizeMetadataUrl(metaContent($, 'meta[property="og:image"], meta[property="og:image:url"]'), pageUrl),
    type: metaContent($, 'meta[property="og:type"]'),
    site_name: metaContent($, 'meta[property="og:site_name"]'),
    locale: metaContent($, 'meta[property="og:locale"]'),
  };

  const twitter: TwitterMetadata = {
    card: metaContent($, 'meta[name="twitter:card"]'),
    title: metaContent($, 'meta[name="twitter:title"]'),
    description: metaContent($, 'meta[name="twitter:description"]'),
    image: normalizeMetadataUrl(metaContent($, 'meta[name="twitter:image"], meta[name="twitter:image:src"]'), pageUrl),
    site: metaContent($, 'meta[name="twitter:site"]'),
    creator: metaContent($, 'meta[name="twitter:creator"]'),
  };

  const faviconCandidates = $('link[rel~="icon" i], link[rel~="shortcut" i][rel~="icon" i], link[rel~="apple-touch-icon" i]')
    .map((_, element) => normalizeMetadataUrl($(element).attr("href"), pageUrl))
    .get()
    .filter((value): value is string => value !== null);

  const socialProfileLinks = $('a[href]')
    .map((_, element) => normalizeMetadataUrl($(element).attr("href"), pageUrl))
    .get()
    .filter((value): value is string => value !== null && isSocialProfile(value));

  const organization = findOrganization(jsonLd, pageUrl);
  const websiteName = findWebsiteName(jsonLd) ?? openGraph.site_name;

  return {
    metadata: {
      title: $("title").first().text().trim() || null,
      meta_description: metaContent($, 'meta[name="description"]'),
      canonical_url: normalizeMetadataUrl($('link[rel="canonical"]').first().attr("href"), pageUrl),
      language: $("html").attr("lang")?.trim() || null,
      viewport: metaContent($, 'meta[name="viewport"]'),
      favicon_candidates: unique(faviconCandidates),
      open_graph: openGraph,
      twitter,
      json_ld: jsonLd,
      social_links: unique(socialProfileLinks),
    },
    organization,
    website_name: websiteName,
    social_profile_links: unique(socialProfileLinks),
    invalid_json_ld_count: invalidJsonLdCount,
  };
}

function metaContent($: cheerio.CheerioAPI, selector: string): string | null {
  const value = $(selector).first().attr("content")?.trim();
  return value || null;
}

function normalizeMetadataUrl(value: string | undefined | null, pageUrl: string): string | null {
  if (!value) return null;
  const normalized = normalizeUrl(value, pageUrl);
  return normalized.accepted ? normalized.value : null;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function isSocialProfile(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return ["facebook.com", "instagram.com", "linkedin.com", "twitter.com", "x.com", "youtube.com", "tiktok.com", "pinterest.com", "github.com"].some(
      (socialHost) => hostname === socialHost || hostname.endsWith(`.${socialHost}`),
    );
  } catch {
    return false;
  }
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value === "object") return Object.values(value).every(isJsonValue);
  return false;
}

function findOrganization(blocks: JsonValue[], pageUrl: string): OrganizationInformation | null {
  const organization = findJsonLdType(blocks, ["Organization", "Corporation", "LocalBusiness"]);
  if (!organization) return null;
  return {
    name: stringValue(organization.name),
    url: normalizeMetadataUrl(stringValue(organization.url), pageUrl),
    logo: normalizeMetadataUrl(extractImageValue(organization.logo), pageUrl),
    same_as: Array.isArray(organization.sameAs)
      ? organization.sameAs.filter((value): value is string => typeof value === "string").map((value) => normalizeMetadataUrl(value, pageUrl)).filter((value): value is string => value !== null)
      : [],
  };
}

function findWebsiteName(blocks: JsonValue[]): string | null {
  const website = findJsonLdType(blocks, ["WebSite"]);
  return website ? stringValue(website.name) : null;
}

function findJsonLdType(blocks: JsonValue[], types: string[]): Record<string, JsonValue> | null {
  for (const block of blocks) {
    const matches = Array.isArray(block) ? block : [block];
    for (const value of matches) {
      if (typeof value !== "object" || value === null || Array.isArray(value)) continue;
      const type = value["@type"];
      if ((typeof type === "string" && types.includes(type)) || (Array.isArray(type) && type.some((item) => typeof item === "string" && types.includes(item)))) {
        return value;
      }
    }
  }
  return null;
}

function stringValue(value: JsonValue | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function extractImageValue(value: JsonValue | undefined): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return stringValue(value.url) ?? stringValue(value.contentUrl);
  return null;
}
